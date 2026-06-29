import { type CSSProperties, type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { loadAppSettings, type AppSettings } from './services/settings';
import {
  DEFAULT_BRAND_NAME,
  FALLBACK_FILTER_OPTIONS,
  getSourceReadiness,
  buildWorkbenchMockData,
  buildWorkbenchPlaceholderData,
  loadDriveBaseDataPatch,
  loadFunnelDataPatch,
  loadIpDataPatch,
  loadSalesFilterOptions,
  loadTrialOrderDataPatch,
  loadWorkbenchInitialData,
  type FilterOptionRow,
  type StoreFilter,
  type WorkbenchDataPatch,
} from './services/storeDiagnosis';
import type {
  DailyTrendData,
  DiagnosisDomain,
  DiagnosisProblem,
  DiagnosisRecord,
  EvidenceContextStatus,
  EvidenceTurn,
  FunnelMetric,
  ProcessMetric,
  ProcessMetricGroup,
  ProblemNegativeRate,
  TrendDirection,
  WorkbenchData,
} from './types';

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultDateRange(today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 24);
  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
  };
}

const DEFAULT_DATE_RANGE = getDefaultDateRange();
const REQUESTED_DATA_MODE = new URLSearchParams(window.location.search).get('dataMode');

const DEFAULT_FILTER: StoreFilter = {
  brand: DEFAULT_BRAND_NAME,
  region: '1南部区',
  district: '何程',
  dealer: '贵州焱森',
  startDate: DEFAULT_DATE_RANGE.startDate,
  endDate: DEFAULT_DATE_RANGE.endDate,
};

const DOMAIN_META: Record<DiagnosisDomain, { tab: string; panel: string; icon: string; className: string }> = {
  ip: { tab: '电话邀约', panel: '邀约', icon: 'call', className: 'ip' },
  drive: { tab: '试驾接待', panel: '试驾', icon: 'directions_car', className: 'drive' },
};
const DETAIL_PAGE_SIZE = 10;
type PaginationItem = number | 'ellipsis-start' | 'ellipsis-end';

type LoadingState = {
  initial: boolean;
  funnel: boolean;
  ip: boolean;
  drive: boolean;
  trial: boolean;
};

type ProblemRateModuleItem = ProblemNegativeRate;

const IDLE_LOADING_STATE: LoadingState = {
  initial: false,
  funnel: false,
  ip: false,
  drive: false,
  trial: false,
};

function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
}

function LoadingDots({ label = '数据加载中' }: { label?: string }) {
  return (
    <span className="loading-dots" role="status" aria-label={label}>
      <i />
      <i />
      <i />
    </span>
  );
}

function buildPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const edgePage = 1;
  const lastPage = totalPages;
  let rangeStart = Math.max(2, currentPage - 2);
  let rangeEnd = Math.min(totalPages - 1, currentPage + 2);

  if (rangeStart <= 3) rangeStart = 2;
  if (rangeEnd >= totalPages - 2) rangeEnd = totalPages - 1;

  const items: PaginationItem[] = [edgePage];
  if (rangeStart > 2) items.push('ellipsis-start');

  for (let page = rangeStart; page <= rangeEnd; page += 1) {
    items.push(page);
  }

  if (rangeEnd < totalPages - 1) items.push('ellipsis-end');
  items.push(lastPage);
  return items;
}

function CardLoadingBadge({ visible }: { visible: boolean }) {
  return visible ? (
    <span className="card-loading-badge">
      <LoadingDots />
    </span>
  ) : null;
}

function trendIcon(trend: TrendDirection) {
  return trend === 'up' ? 'trending_up' : 'trending_down';
}

function trendClass(trend: TrendDirection) {
  return trend === 'up' ? 'trend-up' : 'trend-down';
}

function isLowerBetterMetric(label: string) {
  return label.includes('30s以下') || label.includes('负向');
}

function metricOutcomeClass(metric: Pick<ProcessMetric, 'label' | 'trend'>) {
  if (!isLowerBetterMetric(metric.label)) return trendClass(metric.trend);
  return metric.trend === 'down' ? 'trend-up' : 'trend-down';
}

function formatTrendValue(seriesName: string, value: number) {
  if (seriesName.includes('里程')) return `${value.toFixed(1)}km`;
  if (seriesName.includes('时长')) return `${value.toFixed(1)}min`;
  return `${value.toFixed(1)}%`;
}

function parseTrendPoint(point: string) {
  const [x, y] = point.split(',').map(Number);
  return { x, y };
}

function buildTrendPoint(
  value: number,
  values: number[],
  index: number,
  count: number,
  chart: { left: number; top: number; width: number; height: number; min: number; max: number },
  normalize?: boolean,
) {
  const rawMin = normalize ? Math.min(...values) : chart.min;
  const rawMax = normalize ? Math.max(...values) : chart.max;
  const rawRange = Math.max(rawMax - rawMin, 1);
  const scaledValue = normalize ? ((value - rawMin) / rawRange) * 100 : value;
  const range = Math.max(chart.max - chart.min, 1);
  const x = chart.left + (index / Math.max(count - 1, 1)) * chart.width;
  const y = chart.top + chart.height - ((scaledValue - chart.min) / range) * chart.height;
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}

function buildSmoothTrendPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return '';
  return points.reduce((path, point, index, allPoints) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = allPoints[index - 1];
    const midX = (previous.x + point.x) / 2;
    return `${path} C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
  }, '');
}

function uniqSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function firstOption(rows: FilterOptionRow[], region?: string, district?: string): FilterOptionRow {
  return rows.find((item) => (!region || item.region === region) && (!district || item.district === district)) || rows[0] || FALLBACK_FILTER_OPTIONS[0];
}

function normalizeFilterToOptions(filter: StoreFilter, options: FilterOptionRow[]): StoreFilter {
  const base = firstOption(options);
  const region = options.some((item) => item.region === filter.region) ? filter.region : base.region;
  const districtRows = options.filter((item) => item.region === region);
  const district = districtRows.some((item) => item.district === filter.district) ? filter.district : firstOption(options, region).district;
  const dealerRows = options.filter((item) => item.region === region && item.district === district);
  const dealer = dealerRows.some((item) => item.dealer === filter.dealer) ? filter.dealer : firstOption(options, region, district).dealer;
  return { ...filter, brand: filter.brand || DEFAULT_BRAND_NAME, region, district, dealer };
}

function sameFilter(left: StoreFilter, right: StoreFilter): boolean {
  return left.brand === right.brand
    && left.region === right.region
    && left.district === right.district
    && left.dealer === right.dealer
    && left.startDate === right.startDate
    && left.endDate === right.endDate;
}

function mergeWorkbenchPatch(current: WorkbenchData, patch: WorkbenchDataPatch): WorkbenchData {
  const nextProcessMetrics = patch.processMetrics
    ? (Object.entries(patch.processMetrics) as Array<[DiagnosisDomain, ProcessMetric[]]>).reduce(
      (acc, [domain, metrics]) => {
        const byLabel = new Map(acc[domain].map((item) => [item.label, item]));
        metrics.forEach((item) => byLabel.set(item.label, item));
        return { ...acc, [domain]: acc[domain].map((item) => byLabel.get(item.label) || item) };
      },
      current.processMetrics,
    )
    : current.processMetrics;
  return {
    ...current,
    ...patch,
    processMetrics: nextProcessMetrics,
    dailyTrendData: patch.dailyTrendData ? { ...current.dailyTrendData, ...patch.dailyTrendData } : current.dailyTrendData,
    diagnosis: patch.diagnosis ? { ...current.diagnosis, ...patch.diagnosis } : current.diagnosis,
    sourceWarnings: patch.sourceWarnings ? [...(current.sourceWarnings || []), ...patch.sourceWarnings] : current.sourceWarnings,
  };
}

function Header({
  filter,
  titleDealer,
  filterOptions,
  onFilterChange,
  onSearch,
  hasPendingSearch,
}: {
  filter: StoreFilter;
  titleDealer: string;
  filterOptions: FilterOptionRow[];
  onFilterChange: (next: StoreFilter) => void;
  onSearch: () => void;
  hasPendingSearch: boolean;
}) {
  const regionOptions = useMemo(() => uniqSorted(filterOptions.map((item) => item.region)), [filterOptions]);
  const districtOptions = useMemo(() => uniqSorted(filterOptions.filter((item) => item.region === filter.region).map((item) => item.district)), [filter.region, filterOptions]);
  const dealerOptions = useMemo(
    () => uniqSorted(filterOptions.filter((item) => item.region === filter.region && item.district === filter.district).map((item) => item.dealer)),
    [filter.district, filter.region, filterOptions],
  );

  const update = (key: keyof StoreFilter, value: string) => {
    if (key === 'region') {
      const nextDistrict = firstOption(filterOptions, value).district;
      const nextDealer = firstOption(filterOptions, value, nextDistrict).dealer;
      onFilterChange({ ...filter, region: value, district: nextDistrict, dealer: nextDealer });
      return;
    }
    if (key === 'district') {
      const nextDealer = firstOption(filterOptions, filter.region, value).dealer;
      onFilterChange({ ...filter, district: value, dealer: nextDealer });
      return;
    }
    onFilterChange({ ...filter, [key]: value });
  };

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-title">
          <div className="eyebrow">单个门店销售诊断工作台</div>
          <h1>{titleDealer}</h1>
        </div>
        <div className="filter-bar">
          <label>
            品牌
            <select value={filter.brand || DEFAULT_BRAND_NAME} onChange={(event) => update('brand', event.target.value)}>
              <option value={DEFAULT_BRAND_NAME}>{DEFAULT_BRAND_NAME}</option>
            </select>
          </label>
          <label>
            大区
            <select value={filter.region} onChange={(event) => update('region', event.target.value)}>
              {regionOptions.map((region) => <option key={region}>{region}</option>)}
            </select>
          </label>
          <label>
            小区
            <select value={filter.district} onChange={(event) => update('district', event.target.value)}>
              {districtOptions.map((district) => <option key={district}>{district}</option>)}
            </select>
          </label>
          <label className="dealer-select">
            经销商
            <select value={filter.dealer} onChange={(event) => update('dealer', event.target.value)}>
              {dealerOptions.map((dealer) => <option key={dealer}>{dealer}</option>)}
            </select>
          </label>
          <label className="date-range">
            日期
            <div>
              <input type="date" value={filter.startDate} onChange={(event) => update('startDate', event.target.value)} aria-label="开始日期" />
              <span>至</span>
              <input type="date" value={filter.endDate} onChange={(event) => update('endDate', event.target.value)} aria-label="结束日期" />
            </div>
          </label>
          <button className="primary-button" type="button" onClick={onSearch} aria-label={hasPendingSearch ? '按当前筛选条件查询' : '重新查询'}>
            查询
          </button>
        </div>
      </div>
    </header>
  );
}

function SourceStatusBar({ data }: { data: WorkbenchData }) {
  const readiness = getSourceReadiness(data);
  return (
    <>
      <section className="source-status" aria-label="数据源状态">
        <div>
          <span className="status-dot confirmed" />
          已确认：{readiness.confirmedSources.join('、')}
        </div>
        {readiness.pendingSources.map((source) => (
          <div key={source.key}>
            <span className="status-dot pending" />
            待接入：{source.label}
          </div>
        ))}
      </section>
      {data.sourceWarnings?.length ? (
        <section className="source-warning" aria-label="数据读取提示">
          {data.sourceWarnings.map((warning) => (
            <div key={warning}>
              <Icon name="info" />
              {warning}
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}

function FunnelCard({ metric, type, isLoading }: { metric: FunnelMetric; type: 'volume' | 'rate'; isLoading: boolean }) {
  if (type === 'rate') {
    return (
      <article className="funnel-card rate-card">
        <CardLoadingBadge visible={isLoading} />
        <p>{metric.label}</p>
        <div className="metric-value centered">
          <strong>{metric.value}</strong>
          <span>{metric.unit}</span>
        </div>
        <small className={trendClass(metric.trend)}>{metric.compare}</small>
      </article>
    );
  }

  return (
    <article className="funnel-card volume-card">
      <CardLoadingBadge visible={isLoading} />
      <div className="card-heading">
        <p>{metric.label}</p>
        <span className={`material-symbols-outlined ${trendClass(metric.trend)}`}>{trendIcon(metric.trend)}</span>
      </div>
      <div className="metric-value">
        <strong>{metric.value}</strong>
        <span>{metric.unit}</span>
      </div>
      <small className={trendClass(metric.trend)}>{metric.compare}</small>
      <div className="rank-text">小区排名：{metric.rank}</div>
    </article>
  );
}

function FunnelSection({ metrics, isLoading }: { metrics: FunnelMetric[]; isLoading: boolean }) {
  const metricMap = useMemo(() => new Map(metrics.map((item) => [item.label, item])), [metrics]);
  const pathItems: Array<{ type: 'volume' | 'rate'; label: string }> = [
    { type: 'volume', label: '下发线索' },
    { type: 'rate', label: '线索到店率' },
    { type: 'volume', label: '到店' },
    { type: 'rate', label: '到店试驾率' },
    { type: 'volume', label: '试驾' },
    { type: 'rate', label: '试驾订单率' },
    { type: 'volume', label: '订单' },
    { type: 'rate', label: '线索订单率' },
  ];

  return (
    <section className="panel funnel-section">
      <h2>销售漏斗</h2>
      <div className="funnel-grid">
        {pathItems.map((item) => {
          const metric = metricMap.get(item.label);
          return metric ? <FunnelCard key={item.label} metric={metric} type={item.type} isLoading={isLoading} /> : null;
        })}
      </div>
    </section>
  );
}

function ProcessMetricButton({
  metric,
  domain,
  active,
  isLoading,
  onSelect,
}: {
  metric: ProcessMetric;
  domain: DiagnosisDomain;
  active: boolean;
  isLoading: boolean;
  onSelect: (domain: DiagnosisDomain, metric: string, scroll: boolean) => void;
}) {
  const isStaticMetric = metric.label === '打标电话数' || metric.label === '打标试驾数';
  return (
    <button
      className={`process-metric ${active && !isStaticMetric ? `active ${DOMAIN_META[domain].className}` : ''}`}
      type="button"
      onClick={() => {
        if (!isStaticMetric) onSelect(domain, metric.label, true);
      }}
    >
      <CardLoadingBadge visible={isLoading} />
      <span className="metric-name">{metric.label}</span>
      <span className={metricOutcomeClass(metric)}>
        <Icon name={trendIcon(metric.trend)} />
      </span>
      <strong>{metric.value}</strong>
      {metric.wow ? (
        <div className="process-metric-compare">
          <small className={`compare-chip ${metricOutcomeClass(metric)}`}>周环比 {metric.wow}</small>
          <span className="compare-divider" aria-hidden="true">|</span>
          <small className={`compare-chip ${metricOutcomeClass(metric)}`}>月环比 {metric.mom}</small>
        </div>
      ) : (
        <small className={metricOutcomeClass(metric)}>{isStaticMetric ? metric.mom : `月环比 ${metric.mom}`}</small>
      )}
    </button>
  );
}

function ProcessGroup({
  group,
  domain,
  metrics,
  activeMetric,
  activeDomain,
  isLoading,
  onSelect,
}: {
  group: ProcessMetricGroup;
  domain: DiagnosisDomain;
  metrics: ProcessMetric[];
  activeMetric: string;
  activeDomain: DiagnosisDomain;
  isLoading: boolean;
  onSelect: (domain: DiagnosisDomain, metric: string, scroll: boolean) => void;
}) {
  const isActive = activeDomain === domain && group.metrics.includes(activeMetric);
  const listRef = useRef<HTMLDivElement>(null);
  const [verticalHint, setVerticalHint] = useState({ up: false, down: false });

  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const updateHint = () => {
      const maxScrollTop = list.scrollHeight - list.clientHeight;
      setVerticalHint({
        up: list.scrollTop > 2,
        down: list.scrollTop < maxScrollTop - 2,
      });
    };
    updateHint();
    const frame = window.requestAnimationFrame(updateHint);
    list.addEventListener('scroll', updateHint, { passive: true });
    window.addEventListener('resize', updateHint);
    return () => {
      window.cancelAnimationFrame(frame);
      list.removeEventListener('scroll', updateHint);
      window.removeEventListener('resize', updateHint);
    };
  }, [group.metrics.length]);

  return (
    <div className={`metric-group ${isActive ? `active ${DOMAIN_META[domain].className}` : ''}`} onClick={() => onSelect(domain, group.defaultMetric, true)}>
      <CardLoadingBadge visible={isLoading} />
      <div className="group-title">{group.title}</div>
      <div ref={listRef} className="group-metrics" tabIndex={group.metrics.length > 2 ? 0 : undefined}>
        {group.metrics.map((label) => {
          const metric = metrics.find((item) => item.label === label);
          return metric ? (
            <ProcessMetricButton
              key={label}
              metric={metric}
              domain={domain}
              active={activeDomain === domain && activeMetric === label}
              isLoading={isLoading}
              onSelect={onSelect}
            />
          ) : null;
        })}
      </div>
      {group.metrics.length > 2 && verticalHint.up ? (
        <div className="metric-group-scroll-hint up" aria-hidden="true">
          <Icon name="keyboard_arrow_up" />
        </div>
      ) : null}
      {group.metrics.length > 2 && verticalHint.down ? (
        <div className="metric-group-scroll-hint down" aria-hidden="true">
          <Icon name="keyboard_arrow_down" />
        </div>
      ) : null}
    </div>
  );
}

function ProblemRateItem({
  item,
  isLoading,
  onSelect,
}: {
  item: ProblemRateModuleItem;
  isLoading: boolean;
  onSelect?: (item: ProblemRateModuleItem) => void;
}) {
  const isWorse = item.status === '恶化';
  const content = (
    <>
      <CardLoadingBadge visible={isLoading} />
      <div className="metric-button-title">
        <strong>{item.name}</strong>
        <Icon name={isWorse ? 'trending_up' : item.status === '改善' ? 'trending_down' : 'remove'} />
      </div>
      <strong className="problem-rate-current">{item.current}</strong>
      <div className="problem-rate-compare">
        <small className={`compare-chip ${isWorse ? 'trend-down' : item.status === '改善' ? 'trend-up' : ''}`}>周环比 {item.delta}</small>
        <span className="compare-divider" aria-hidden="true">|</span>
        <small className={`compare-chip ${isWorse ? 'trend-down' : item.status === '改善' ? 'trend-up' : ''}`}>月环比 {item.monthDelta}</small>
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button
        className="problem-rate-card clickable"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSelect(item);
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <article className="problem-rate-card">
      {content}
    </article>
  );
}

function ProblemRateModule({
  items,
  domain,
  isLoading,
  onSelectItem,
}: {
  items: ProblemRateModuleItem[];
  domain: DiagnosisDomain;
  isLoading: boolean;
  onSelectItem?: (item: ProblemRateModuleItem) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [verticalHint, setVerticalHint] = useState({ up: false, down: false });

  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const updateHint = () => {
      const maxScrollTop = list.scrollHeight - list.clientHeight;
      setVerticalHint({
        up: list.scrollTop > 2,
        down: list.scrollTop < maxScrollTop - 2,
      });
    };
    updateHint();
    const frame = window.requestAnimationFrame(updateHint);
    list.addEventListener('scroll', updateHint, { passive: true });
    window.addEventListener('resize', updateHint);
    return () => {
      window.cancelAnimationFrame(frame);
      list.removeEventListener('scroll', updateHint);
      window.removeEventListener('resize', updateHint);
    };
  }, [items.length]);

  if (!items.length) return null;
  return (
    <section
      className={`problem-rate-module ${domain}`}
      aria-label={`${DOMAIN_META[domain].panel}问题占比`}
      onClick={(event) => {
        event.stopPropagation();
        onSelectItem?.(items[0]);
      }}
    >
      <CardLoadingBadge visible={isLoading} />
      <div className="problem-rate-heading">
        <h3>问题占比</h3>
      </div>
      <div ref={listRef} className="problem-rate-list" tabIndex={0}>
        {items.map((item) => (
          <ProblemRateItem key={item.name} item={item} isLoading={isLoading} onSelect={onSelectItem} />
        ))}
      </div>
      {items.length > 2 && verticalHint.up ? (
        <div className="problem-rate-scroll-hint up" aria-hidden="true">
          <Icon name="keyboard_arrow_up" />
        </div>
      ) : null}
      {items.length > 2 && verticalHint.down ? (
        <div className="problem-rate-scroll-hint down" aria-hidden="true">
          <Icon name="keyboard_arrow_down" />
        </div>
      ) : null}
    </section>
  );
}

function ProcessPanel({
  domain,
  data,
  activeDomain,
  activeMetric,
  isLoading,
  onSelect,
  onOpenTrend,
}: {
  domain: DiagnosisDomain;
  data: WorkbenchData;
  activeDomain: DiagnosisDomain;
  activeMetric: string;
  isLoading: boolean;
  onSelect: (domain: DiagnosisDomain, metric: string, scroll: boolean) => void;
  onOpenTrend: (domain: DiagnosisDomain, anchor: HTMLElement) => void;
}) {
  const meta = DOMAIN_META[domain];
  const active = activeDomain === domain;
  const stripRef = useRef<HTMLDivElement>(null);
  const [verticalHint, setVerticalHint] = useState({ up: false, down: false });
  const problemRateItems = domain === 'drive' ? data.driveProblemNegativeRates : data.ipProblemNegativeRates;
  const moduleCount = data.processMetricGroups[domain].length + (problemRateItems.length ? 1 : 0);
  const showScrollHint = moduleCount > 3;
  const selectProblemRate = () => {
    onSelect(domain, domain === 'drive' ? '负向试驾接待占比' : data.defaultMetricByTab[domain], true);
  };

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return undefined;
    const updateHint = () => {
      const maxScrollTop = strip.scrollHeight - strip.clientHeight;
      const scrollTop = Math.max(0, strip.scrollTop);
      setVerticalHint({
        up: scrollTop > 16,
        down: maxScrollTop > 16 && scrollTop < maxScrollTop - 16,
      });
    };
    updateHint();
    const frame = window.requestAnimationFrame(updateHint);
    strip.addEventListener('scroll', updateHint, { passive: true });
    window.addEventListener('resize', updateHint);
    return () => {
      window.cancelAnimationFrame(frame);
      strip.removeEventListener('scroll', updateHint);
      window.removeEventListener('resize', updateHint);
    };
  }, [domain, moduleCount, problemRateItems.length]);

  return (
    <div className={`process-panel ${meta.className} ${active ? 'active' : ''}`} onClick={() => onSelect(domain, data.defaultMetricByTab[domain], true)}>
      <CardLoadingBadge visible={isLoading} />
      <div className="process-heading">
        <div>
          <Icon name={meta.icon} />
          {meta.panel}
        </div>
        <button
          className="trend-more-button"
          type="button"
          aria-label={`查看${meta.panel}日趋势`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenTrend(domain, event.currentTarget);
          }}
        >
          {meta.panel}日趋势
        </button>
      </div>
      <div ref={stripRef} className="process-module-strip" tabIndex={0} aria-label={`${meta.panel}子模块纵向列表`}>
        {data.processMetricGroups[domain].map((group) => (
          <ProcessGroup
            key={group.title}
            group={group}
            domain={domain}
            metrics={data.processMetrics[domain]}
            activeMetric={activeMetric}
            activeDomain={activeDomain}
            isLoading={isLoading}
            onSelect={onSelect}
          />
        ))}
        {problemRateItems.length ? (
          <ProblemRateModule
            items={problemRateItems}
            domain={domain}
            isLoading={isLoading}
            onSelectItem={selectProblemRate}
          />
        ) : null}
      </div>
      {showScrollHint && verticalHint.up ? (
          <div className={`process-scroll-arrow up ${meta.className}`} aria-hidden="true">
            <Icon name="keyboard_arrow_up" />
          </div>
      ) : null}
      {showScrollHint && verticalHint.down ? (
          <div className={`process-scroll-arrow down ${meta.className}`} aria-hidden="true">
            <Icon name="keyboard_arrow_down" />
          </div>
      ) : null}
    </div>
  );
}

function ProcessSection({
  data,
  activeDomain,
  activeMetric,
  loadingState,
  onSelect,
  onOpenTrend,
}: {
  data: WorkbenchData;
  activeDomain: DiagnosisDomain;
  activeMetric: string;
  loadingState: LoadingState;
  onSelect: (domain: DiagnosisDomain, metric: string, scroll: boolean) => void;
  onOpenTrend: (domain: DiagnosisDomain, anchor: HTMLElement) => void;
}) {
  const ipLoading = loadingState.initial || loadingState.ip;
  const driveLoading = loadingState.initial || loadingState.drive || loadingState.trial;
  return (
    <section className="process-grid">
      <ProcessPanel domain="ip" data={data} activeDomain={activeDomain} activeMetric={activeMetric} isLoading={ipLoading} onSelect={onSelect} onOpenTrend={onOpenTrend} />
      <ProcessPanel domain="drive" data={data} activeDomain={activeDomain} activeMetric={activeMetric} isLoading={driveLoading} onSelect={onSelect} onOpenTrend={onOpenTrend} />
    </section>
  );
}

function TrendPopover({
  trend,
  anchor,
  isLoading,
  onClose,
}: {
  trend: DailyTrendData | null;
  anchor: DOMRect | null;
  isLoading: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [position, setPosition] = useState({ left: 16, top: 16 });
  const [hiddenSeriesNames, setHiddenSeriesNames] = useState<Set<string>>(() => new Set());
  const [hoverState, setHoverState] = useState<{ dayIndex: number; nearestSeriesName: string; x: number; y: number; tooltipX: number; tooltipY: number } | null>(null);

  useEffect(() => {
    if (!trend || !anchor) return;
    requestAnimationFrame(() => {
      const width = ref.current?.offsetWidth ?? Math.min(760, window.innerWidth - 32);
      const height = ref.current?.offsetHeight ?? 480;
      const left = Math.max(16, (window.innerWidth - width) / 2);
      const top = Math.max(16, (window.innerHeight - height) / 2);
      setPosition({ left, top });
    });
  }, [anchor, trend]);

  useEffect(() => {
    setHiddenSeriesNames(new Set());
    setHoverState(null);
  }, [trend]);

  if (!trend) return null;

  const hasTrendData = trend.days.length > 0 && trend.series.some((series) => series.values.length > 0);
  if (!hasTrendData) {
    return (
      <div className="trend-popover" ref={ref} style={{ left: position.left, top: position.top }} role="dialog" aria-label={`${trend.eyebrow}趋势浮窗`}>
        <CardLoadingBadge visible={isLoading} />
        <div className="popover-title">
          <div>
            <h3>{trend.title}</h3>
            <p>趋势仅作为辅助诊断，不作为主操作入口。</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭趋势浮窗">
            <Icon name="close" />
          </button>
        </div>
        <div className="trend-empty">当前筛选范围暂无可展示的日趋势数据</div>
      </div>
    );
  }

  const visibleSeries = trend.series.filter((series) => !hiddenSeriesNames.has(series.name));
  const allValues = visibleSeries.flatMap((item) => item.values);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const padding = Math.max((rawMax - rawMin) * 0.12, 1);
  const chart = {
    left: 26,
    top: 24,
    width: 496,
    height: 176,
    min: trend.yMin ?? rawMin - padding,
    max: trend.yMax ?? rawMax + padding,
  };

  const toggleSeries = (seriesName: string) => {
    setHoverState(null);
    setHiddenSeriesNames((current) => {
      const next = new Set(current);
      if (next.has(seriesName)) {
        next.delete(seriesName);
        return next;
      }
      const visibleCount = trend.series.filter((series) => !current.has(series.name)).length;
      if (visibleCount <= 1) return current;
      next.add(seriesName);
      return next;
    });
  };

  const getSeriesPoint = (series: DailyTrendData['series'][number], index: number) => {
    const value = series.values[index];
    if (!Number.isFinite(value)) return null;
    return parseTrendPoint(buildTrendPoint(value, series.values, index, trend.days.length, chart, trend.normalize));
  };

  const handleChartMouseMove = (event: ReactMouseEvent<SVGRectElement>) => {
    if (!svgRef.current || !visibleSeries.length) return;
    const point = svgRef.current.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const screenMatrix = svgRef.current.getScreenCTM();
    if (!screenMatrix) return;
    const svgPoint = point.matrixTransform(screenMatrix.inverse());
    const pointerX = svgPoint.x;
    const pointerY = svgPoint.y;
    const clampedX = Math.min(Math.max(pointerX, chart.left), chart.left + chart.width);
    const dayIndex = Math.round(((clampedX - chart.left) / Math.max(chart.width, 1)) * Math.max(trend.days.length - 1, 0));
    const candidates = visibleSeries
      .map((series) => {
        const point = getSeriesPoint(series, dayIndex);
        return point ? { series, point, distance: Math.abs(point.y - pointerY) } : null;
      })
      .filter(Boolean) as Array<{ series: DailyTrendData['series'][number]; point: { x: number; y: number }; distance: number }>;
    if (!candidates.length) {
      setHoverState(null);
      return;
    }
    const nearest = candidates.reduce((best, item) => (item.distance < best.distance ? item : best));
    const x = chart.left + (dayIndex / Math.max(trend.days.length - 1, 1)) * chart.width;
    const chartRect = svgRef.current.parentElement?.getBoundingClientRect();
    setHoverState({
      dayIndex,
      nearestSeriesName: nearest.series.name,
      x,
      y: nearest.point.y,
      tooltipX: chartRect ? event.clientX - chartRect.left : x,
      tooltipY: chartRect ? event.clientY - chartRect.top : nearest.point.y,
    });
  };

  const hoverRows = hoverState
    ? visibleSeries
        .map((series) => ({ series, value: series.values[hoverState.dayIndex], point: getSeriesPoint(series, hoverState.dayIndex) }))
        .filter((item) => Number.isFinite(item.value) && item.point)
    : [];
  const tooltipLeft = hoverState ? Math.min(Math.max(18, hoverState.tooltipX + 16), 360) : 0;
  const tooltipTop = hoverState ? Math.min(Math.max(18, hoverState.tooltipY - 28), 150) : 0;

  return (
    <div className="trend-popover" ref={ref} style={{ left: position.left, top: position.top }} role="dialog" aria-label={`${trend.eyebrow}趋势浮窗`}>
      <CardLoadingBadge visible={isLoading} />
      <div className="popover-title">
        <div>
          <h3>{trend.title}</h3>
          <p>趋势仅作为辅助诊断，不作为主操作入口。</p>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="关闭趋势浮窗">
          <Icon name="close" />
        </button>
      </div>
      <div className="trend-summary-pills" aria-label="趋势指标">
        {trend.series.map((series) => {
          const latest = series.values[series.values.length - 1];
          const hidden = hiddenSeriesNames.has(series.name);
          const visibleCount = trend.series.filter((item) => !hiddenSeriesNames.has(item.name)).length;
          return (
            <button
              key={series.name}
              className={hidden ? 'muted' : ''}
              type="button"
              aria-pressed={!hidden}
              aria-label={`${hidden ? '显示' : '隐藏'}${series.name}趋势`}
              disabled={!hidden && visibleCount <= 1}
              style={{ '--series-color': series.color } as CSSProperties}
              onClick={() => toggleSeries(series.name)}
            >
              <span>{series.name}</span>
              <strong>{formatTrendValue(series.name, latest)}</strong>
            </button>
          );
        })}
      </div>
      <div className="trend-chart">
        <svg ref={svgRef} viewBox="0 0 548 230" role="img" aria-label={`${trend.eyebrow}第二层指标日趋势`}>
          <rect x="0" y="0" width="548" height="230" rx="20" fill="transparent" />
          {visibleSeries.map((series) => {
            const points = series.values
              .map((value, index) => parseTrendPoint(buildTrendPoint(value, series.values, index, trend.days.length, chart, trend.normalize)))
              .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
            const latest = series.values[series.values.length - 1];
            const latestPoint = buildTrendPoint(latest, series.values, series.values.length - 1, trend.days.length, chart, trend.normalize).split(',');
            const isHighlighted = hoverState?.nearestSeriesName === series.name;
            return (
              <g key={series.name}>
                <path
                  d={buildSmoothTrendPath(points)}
                  fill="none"
                  stroke={series.color}
                  strokeWidth={isHighlighted ? '4.6' : '3.8'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={hoverState && !isHighlighted ? 0.42 : 1}
                />
                <circle cx={latestPoint[0]} cy={latestPoint[1]} r="3.4" fill={series.color} />
              </g>
            );
          })}
          {hoverState ? (
            <g className="trend-hover-layer">
              <line x1={hoverState.x} y1={chart.top} x2={hoverState.x} y2={chart.top + chart.height} />
              {hoverRows.map(({ series, point }) => (
                <circle key={series.name} cx={point?.x} cy={point?.y} r={hoverState.nearestSeriesName === series.name ? '4.2' : '3.4'} fill={series.color} />
              ))}
            </g>
          ) : null}
          <rect
            x={chart.left}
            y={chart.top}
            width={chart.width}
            height={chart.height}
            fill="transparent"
            onMouseMove={handleChartMouseMove}
            onMouseLeave={() => setHoverState(null)}
          />
        </svg>
        {hoverState ? (
          <div className="trend-tooltip" style={{ left: tooltipLeft, top: tooltipTop }}>
            <div className="trend-tooltip-date">{trend.days[hoverState.dayIndex]}</div>
            {hoverRows.map(({ series, value }) => (
              <div key={series.name} className={hoverState.nearestSeriesName === series.name ? 'active' : ''}>
                <i style={{ background: series.color }} />
                <span>{series.name}</span>
                <strong>{Number.isFinite(value) ? formatTrendValue(series.name, value) : '--'}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DiagnosisSection({
  data,
  activeDomain,
  activeMetric,
  selectedRowKey,
  isLoading,
  onSelectTab,
  onOpenDrawer,
}: {
  data: WorkbenchData;
  activeDomain: DiagnosisDomain;
  activeMetric: string;
  selectedRowKey: string;
  isLoading: boolean;
  onSelectTab: (domain: DiagnosisDomain) => void;
  onOpenDrawer: (record: DiagnosisRecord, typeName: string, rowKey: string) => void;
}) {
  const diagnosis = data.diagnosis[activeDomain];
  const focusTags = data.metricFocusTags[activeMetric] ?? diagnosis.tags.map((item) => item.label);
  const getPrimaryTag = (record: DiagnosisRecord) => record.primaryTag || record.tag || '--';
  const getRecordPrimaryTags = (record: DiagnosisRecord) => (record.primaryTags?.length ? record.primaryTags : [getPrimaryTag(record)].filter((tag) => tag && tag !== '--'));
  const getRecordProblemCount = (record: DiagnosisRecord) => record.problemCount || record.problems?.length || getRecordPrimaryTags(record).length;
  const [detailPage, setDetailPage] = useState(1);
  const [expandedTagLabels, setExpandedTagLabels] = useState<Set<string>>(() => new Set());
  const [problemFilter, setProblemFilter] = useState('all');
  const topTag = diagnosis.tags[0] ?? { label: '暂无负向标签', count: 0, percent: 0, children: [] };
  const maxAdvisorCount = Math.max(1, ...diagnosis.advisors.map((item) => item.count));
  const colors = activeDomain === 'ip' ? ['#316bff', '#19a56f', '#f59e0b', '#e5484d'] : ['#19a56f', '#316bff', '#f59e0b'];
  const issueOptions = diagnosis.tags.map((tag) => tag.label);
  const filteredRecords = problemFilter === 'all'
    ? diagnosis.records
    : diagnosis.records.filter((record) => getRecordPrimaryTags(record).includes(problemFilter));
  const totalDetailPages = Math.max(1, Math.ceil(filteredRecords.length / DETAIL_PAGE_SIZE));
  const currentDetailPage = Math.min(detailPage, totalDetailPages);
  const paginationItems = buildPaginationItems(currentDetailPage, totalDetailPages);
  const detailStart = (currentDetailPage - 1) * DETAIL_PAGE_SIZE;
  const pagedRecords = filteredRecords.slice(detailStart, detailStart + DETAIL_PAGE_SIZE);
  const detailEnd = Math.min(detailStart + pagedRecords.length, filteredRecords.length);
  const toggleTag = (label: string) => {
    setExpandedTagLabels((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  useEffect(() => {
    setDetailPage(1);
    setProblemFilter('all');
    setExpandedTagLabels(new Set(diagnosis.tags.slice(0, 1).map((tag) => tag.label)));
  }, [activeDomain, activeMetric, diagnosis.records.length, diagnosis.tags]);

  return (
    <section className="panel diagnosis-panel" id="detailDiagnosis">
      <div className="diagnosis-heading">
        <h2>深度分析</h2>
        <div className="tabs" role="tablist" aria-label="明细诊断类型">
          {(['ip', 'drive'] as DiagnosisDomain[]).map((domain) => (
            <button key={domain} className={activeDomain === domain ? 'active' : ''} type="button" role="tab" onClick={() => onSelectTab(domain)}>
              <Icon name={DOMAIN_META[domain].icon} />
              {DOMAIN_META[domain].tab}
            </button>
          ))}
        </div>
      </div>
      <div className="source-note">
        <span>{diagnosis.sourceStatus === 'pending' ? '待接入' : '已接入'}</span>
        {diagnosis.sourceNote}
      </div>
      <div className="diagnosis-workspace">
        <aside className="diagnosis-left-stack">
          <div className="sub-panel tag-distribution-panel">
            <CardLoadingBadge visible={isLoading} />
            <div className="sub-panel-title">
              <h3>标签分布</h3>
            </div>
            <div className="tag-list accordion">
              {diagnosis.tags.map((tag, index) => {
                const color = colors[index % colors.length];
                const childMax = Math.max(1, ...tag.children.map((child) => child.count));
                const expanded = expandedTagLabels.has(tag.label);
                return (
                  <div key={tag.label} className={`tag-card accordion-card ${focusTags.includes(tag.label) ? `focused ${DOMAIN_META[activeDomain].className}` : 'muted'}`}>
                    <button className="tag-accordion-head" type="button" onClick={() => toggleTag(tag.label)} aria-expanded={expanded}>
                      <span className="tag-title">
                        <i style={{ background: color }} />
                        {tag.label}
                      </span>
                      <span className="tag-total">{tag.count} / {tag.percent}%</span>
                      <span className="tag-toggle" aria-hidden="true">
                        <Icon name={expanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} />
                      </span>
                    </button>
                    {expanded ? (
                      <div className="tag-children expanded">
                        {tag.children.map((child) => {
                          const childPolarity = '负向';
                          return (
                            <div key={child.label} className="tag-child-row">
                              <span>{child.label}</span>
                              <strong>{child.count}</strong>
                              <em className="negative">{childPolarity}</em>
                              <div className="bar-track small">
                                <span style={{ width: `${Math.max((child.count / childMax) * 100, 10)}%`, background: color }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="sub-panel advisor-distribution-panel">
            <CardLoadingBadge visible={isLoading} />
            <div className="sub-panel-title simple">
              <h3>顾问分布</h3>
            </div>
            <div className="advisor-list compact">
              {diagnosis.advisors.map((advisor, index) => {
                const width = advisor.count > 0 ? Math.max((advisor.count / maxAdvisorCount) * 100, 18) : 0;
                const isTop = advisor.count > 0 && advisor.count === maxAdvisorCount;
                return (
                  <div className="advisor-row compact" key={advisor.name}>
                    <span className="advisor-avatar">{advisor.name.slice(0, 1)}</span>
                    <div>
                      <strong>{advisor.name}</strong>
                      <small>{advisor.count} 个负向问题 · {index === 0 ? topTag.label : diagnosis.tags[index % Math.max(diagnosis.tags.length, 1)]?.label || '负向问题'}</small>
                    </div>
                    <em className={isTop ? 'negative' : 'neutral'}>{isTop ? '负向' : '关注'}</em>
                    <div className="advisor-bar full">
                      <i style={{ width: `${width}%`, background: isTop ? '#e5484d' : '#19a56f' }}>{advisor.count}</i>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
        <div className="detail-table-wrap diagnosis-detail-panel">
          <CardLoadingBadge visible={isLoading} />
          <div className="table-title detail-toolbar">
            <h3>客户明细清单</h3>
            <div className="detail-filters">
              <label>
                <span>阶段</span>
                <select value={activeDomain} onChange={(event) => onSelectTab(event.target.value as DiagnosisDomain)}>
                  <option value="ip">电话邀约</option>
                  <option value="drive">试驾接待</option>
                </select>
              </label>
              <label>
                <span>问题</span>
                <select value={problemFilter} onChange={(event) => { setProblemFilter(event.target.value); setDetailPage(1); }}>
                  <option value="all">全部问题</option>
                  {issueOptions.map((label) => <option value={label} key={label}>{label}</option>)}
                </select>
              </label>
              <strong>{filteredRecords.length} 条记录</strong>
            </div>
          </div>
          <div className="table-scroll">
            <table className="detail-table">
              <thead>
                <tr>
                  <th>顾问</th>
                  <th>事件时间</th>
                  <th>命中问题</th>
                  <th>问题摘要</th>
                  <th>正负向</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedRecords.map((record, index) => {
                  const absoluteIndex = detailStart + index;
                  const rowKey = `${activeDomain}-${absoluteIndex}-${problemFilter}`;
                  const primaryTags = getRecordPrimaryTags(record);
                  const shownTags = primaryTags.slice(0, 1);
                  const hiddenTagCount = Math.max(primaryTags.length - shownTags.length, 0);
                  const problemCount = getRecordProblemCount(record);
                  return (
                    <tr key={rowKey} className={selectedRowKey === rowKey ? 'selected' : ''} onClick={() => onOpenDrawer(record, diagnosis.name, rowKey)}>
                      <td>{record.advisor}</td>
                      <td className="mono">{record.time}</td>
                      <td>
                        <div className="problem-cell inline">
                          {shownTags.map((tag) => <span className="tag-pill" key={tag}>{tag}</span>)}
                          <span className="problem-count">共 {problemCount} 个问题</span>
                          {hiddenTagCount > 0 ? <span className="tag-pill secondary">+{hiddenTagCount}</span> : null}
                        </div>
                      </td>
                      <td className="summary-cell">{record.summary}</td>
                      <td><strong className={record.polarity === '正向' ? 'positive-text' : 'negative-text'}>{record.polarity}</strong></td>
                      <td>
                        <button className="detail-action" type="button" onClick={(event) => { event.stopPropagation(); onOpenDrawer(record, diagnosis.name, rowKey); }}>
                          诊断详情
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalDetailPages > 1 ? (
            <div className="pagination-bar">
              <button type="button" disabled={currentDetailPage === 1} onClick={() => setDetailPage((page) => Math.max(1, page - 1))}>
                <Icon name="chevron_left" />
              </button>
              {paginationItems.map((item) => (
                typeof item === 'number' ? (
                  <button
                    key={item}
                    type="button"
                    className={currentDetailPage === item ? 'active' : ''}
                    onClick={() => setDetailPage(item)}
                  >
                    {item}
                  </button>
                ) : (
                  <span className="pagination-ellipsis" key={item} aria-hidden="true">...</span>
                )
              ))}
              <button type="button" disabled={currentDetailPage === totalDetailPages} onClick={() => setDetailPage((page) => Math.min(totalDetailPages, page + 1))}>
                <Icon name="chevron_right" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function getDrawerProblems(record: DiagnosisRecord): DiagnosisProblem[] {
  if (record.problems?.length) return record.problems;
  return [{
    primaryTag: record.primaryTag || record.tag || '未命中一级标签',
    secondaryTag: record.secondaryTag || '未命中二级标签',
    polarity: record.polarity,
    reason: record.summary,
    evidence: record.evidence,
    evidenceTurns: record.evidenceTurns,
    evidenceContextStatus: record.evidenceContextStatus,
    customerOriginal: record.customerOriginal,
    advisorOriginal: record.advisorOriginal,
    script: record.script,
  }];
}

function getValidEvidenceTurns(problem: DiagnosisProblem): EvidenceTurn[] {
  return (problem.evidenceTurns || []).filter((turn) => {
    return (turn.speaker === '客户' || turn.speaker === '顾问') && turn.text.trim();
  });
}

function parseLabeledEvidenceTurns(rawText: string): EvidenceTurn[] {
  const raw = String(rawText || '').trim();
  if (!raw) return [];
  const markerPattern = /(客户|顾问)\s*[：:]/g;
  const matches = [...raw.matchAll(markerPattern)];
  if (!matches.length) return [];

  return matches
    .map((match, index) => {
      const speaker = match[1] as EvidenceTurn['speaker'];
      const textStart = (match.index || 0) + match[0].length;
      const textEnd = index + 1 < matches.length ? matches[index + 1].index || raw.length : raw.length;
      const text = raw
        .slice(textStart, textEnd)
        .replace(/^[\s；;，,。]+/, '')
        .replace(/[\s；;]+$/, '')
        .trim();
      return { speaker, text };
    })
    .filter((turn) => turn.text);
}

function parseOriginalTextTurns(rawText: string, speaker: EvidenceTurn['speaker']): EvidenceTurn[] {
  return String(rawText || '')
    .split(/\r?\n+|\\n+/)
    .map((text) => text.replace(/^(客户|顾问)\s*[：:]\s*/, '').trim())
    .filter(Boolean)
    .map((text) => ({ speaker, text }));
}

function buildOriginalFallbackTurns(problem: DiagnosisProblem): EvidenceTurn[] {
  const customerTurns = parseOriginalTextTurns(problem.customerOriginal || '', '客户');
  const advisorTurns = parseOriginalTextTurns(problem.advisorOriginal || '', '顾问');
  if (!customerTurns.length || !advisorTurns.length) {
    return [...customerTurns, ...advisorTurns].slice(0, 6);
  }

  const customerCount = Math.min(customerTurns.length, Math.max(1, 6 - Math.min(advisorTurns.length, 3)));
  return [
    ...customerTurns.slice(0, customerCount),
    ...advisorTurns.slice(0, 6 - customerCount),
  ];
}

function getFallbackEvidenceTurns(problem: DiagnosisProblem): EvidenceTurn[] {
  const evidenceTurns = parseLabeledEvidenceTurns(problem.evidence || '').slice(0, 6);
  if (evidenceTurns.length) return evidenceTurns;
  return buildOriginalFallbackTurns(problem);
}

const EVIDENCE_CONTEXT_FALLBACK_TEXT: Partial<Record<EvidenceContextStatus, string>> = {
  'fallback-empty': '录音/通话全文为空，暂按原证据句展示。',
  'fallback-no-anchor': '证据句未在录音/通话全文中定位到，暂按原证据句展示。',
  'fallback-parse-error': '录音/通话全文格式解析失败，暂按原证据句展示。',
};

function getEvidenceContextNote(problem: DiagnosisProblem, hasRenderableTurns: boolean) {
  if (hasRenderableTurns) return '';
  return problem.evidenceContextStatus ? EVIDENCE_CONTEXT_FALLBACK_TEXT[problem.evidenceContextStatus] || '' : '';
}

function OriginalTextList({ problem }: { problem: DiagnosisProblem }) {
  const evidenceTurns = getValidEvidenceTurns(problem);
  const fallbackTurns = getFallbackEvidenceTurns(problem);
  const hasExpandedTurns = problem.evidenceContextStatus === 'expanded' && evidenceTurns.length > 0;
  const hasRenderableTurns = hasExpandedTurns || fallbackTurns.length > 0;
  const contextNote = getEvidenceContextNote(problem, hasRenderableTurns);
  if (problem.evidenceContextStatus === 'expanded' && evidenceTurns.length) {
    return (
      <div className="evidence-chat-flow">
        {evidenceTurns.map((turn, index) => (
          <div className={`evidence-chat-row ${turn.speaker === '客户' ? 'customer' : 'advisor'}`} key={`${turn.speaker}-${index}-${turn.text}`}>
            <span>{turn.speaker}</span>
            <p>{turn.text}</p>
          </div>
        ))}
      </div>
    );
  }

  if (fallbackTurns.length) {
    return (
      <div className="evidence-chat-flow">
        {fallbackTurns.map((turn, index) => (
          <div className={`evidence-chat-row ${turn.speaker === '客户' ? 'customer' : 'advisor'}`} key={`fallback-${turn.speaker}-${index}-${turn.text}`}>
            <span>{turn.speaker}</span>
            <p>{turn.text}</p>
          </div>
        ))}
      </div>
    );
  }

  if (!problem.customerOriginal && !problem.advisorOriginal && !contextNote) return null;
  return (
    <div className="original-text-list">
      {contextNote ? <div className="evidence-context-note">{contextNote}</div> : null}
      {problem.customerOriginal ? (
        <div className="original-text-item customer">
          <span>客户原文</span>
          <p>{problem.customerOriginal}</p>
        </div>
      ) : null}
      {problem.advisorOriginal ? (
        <div className="original-text-item advisor">
          <span>顾问原文</span>
          <p>{problem.advisorOriginal}</p>
        </div>
      ) : null}
    </div>
  );
}

function DetailDrawer({ record, typeName, isLoading, onClose }: { record: DiagnosisRecord | null; typeName: string; isLoading: boolean; onClose: () => void }) {
  const problems = record ? getDrawerProblems(record) : [];
  const groupedProblems = problems.reduce<Array<{ primaryTag: string; problems: DiagnosisProblem[] }>>((groups, problem) => {
    const existing = groups.find((group) => group.primaryTag === problem.primaryTag);
    if (existing) {
      existing.problems.push(problem);
      return groups;
    }
    groups.push({ primaryTag: problem.primaryTag, problems: [problem] });
    return groups;
  }, []);

  return (
    <div className={`drawer-backdrop ${record ? 'open' : ''}`} aria-hidden={!record} onClick={(event) => event.currentTarget === event.target && onClose()}>
      <aside className="drawer-panel">
        <CardLoadingBadge visible={Boolean(record) && isLoading} />
        <div className="drawer-header">
          <div>
            <p>{typeName ? `${typeName}明细` : '诊断明细'}</p>
            <h2>{record ? `${record.customer} 诊断详情` : '客户明细'}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭详情" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {record ? (
          <div className="drawer-body">
            <dl>
              <div>
                <dt>客户</dt>
                <dd>{record.customer}</dd>
              </div>
              <div>
                <dt>顾问</dt>
                <dd>{record.advisor}</dd>
              </div>
              <div>
                <dt>事件时间</dt>
                <dd>{record.time}</dd>
              </div>
              <div>
                <dt>正负向</dt>
                <dd className="negative-text compact">{record.polarity}</dd>
              </div>
              <div>
                <dt>命中问题数</dt>
                <dd className="blue-text">{record.problemCount || problems.length} 个</dd>
              </div>
            </dl>
            <section>
              <h3>命中问题</h3>
              <div className="problem-detail-list">
                {groupedProblems.map((group) => (
                  <div className="problem-detail-group" key={group.primaryTag}>
                    <h4>{group.primaryTag}</h4>
                    {group.problems.map((problem) => (
                      <div className="problem-detail-item" key={`${problem.primaryTag}-${problem.secondaryTag}`}>
                        <div>
                          <span className="tag-pill secondary">{problem.secondaryTag}</span>
                          <strong>{problem.reason}</strong>
                        </div>
                        <OriginalTextList problem={problem} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3>问题摘要</h3>
              <p className="info-box">{record.summary}</p>
            </section>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [draftFilter, setDraftFilter] = useState(DEFAULT_FILTER);
  const [appliedFilter, setAppliedFilter] = useState(DEFAULT_FILTER);
  const [filterOptions, setFilterOptions] = useState<FilterOptionRow[]>(FALLBACK_FILTER_OPTIONS);
  const [data, setData] = useState<WorkbenchData>(() => buildWorkbenchPlaceholderData());
  const [activeDomain, setActiveDomain] = useState<DiagnosisDomain>('ip');
  const [activeMetric, setActiveMetric] = useState('负向邀约占比');
  const [selectedRowKey, setSelectedRowKey] = useState('');
  const [drawerRecord, setDrawerRecord] = useState<DiagnosisRecord | null>(null);
  const [drawerType, setDrawerType] = useState('');
  const [trendDomain, setTrendDomain] = useState<DiagnosisDomain | null>(null);
  const [trendAnchor, setTrendAnchor] = useState<DOMRect | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(IDLE_LOADING_STATE);
  const useMockData = REQUESTED_DATA_MODE === 'mock' || settings?.dataMode === 'mock';

  useEffect(() => {
    loadAppSettings().then(setSettings).catch(() => setSettings({ title: '单店销售诊断工作台', dataMode: 'hybrid' }));
  }, []);

  useEffect(() => {
    if (useMockData) {
      setFilterOptions(FALLBACK_FILTER_OPTIONS);
      return undefined;
    }
    let canceled = false;
    const timer = window.setTimeout(() => {
      loadSalesFilterOptions(appliedFilter.startDate, appliedFilter.endDate, appliedFilter.brand).then((options) => {
        if (canceled) return;
        setFilterOptions(options);
        setAppliedFilter((current) => {
          const normalized = normalizeFilterToOptions(current, options);
          return sameFilter(current, normalized) ? current : normalized;
        });
        setDraftFilter((current) => {
          const normalized = normalizeFilterToOptions(current, options);
          return sameFilter(current, normalized) ? current : normalized;
        });
      });
    }, 1000);
    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [appliedFilter.brand, appliedFilter.endDate, appliedFilter.startDate, useMockData]);

  useEffect(() => {
    if (useMockData) {
      const mockData = buildWorkbenchMockData();
      setData(mockData);
      setLoadingState(IDLE_LOADING_STATE);
      setActiveMetric(mockData.defaultMetricByTab.ip);
      setActiveDomain('ip');
      setSelectedRowKey('');
      setDrawerRecord(null);
      setTrendDomain(null);
      return undefined;
    }
    let canceled = false;
    const applyPatch = (patch: WorkbenchDataPatch | null) => {
      if (canceled || !patch) return;
      setData((current) => mergeWorkbenchPatch(current, patch));
    };
    const clearLoading = (key: keyof LoadingState) => {
      if (canceled) return;
      setLoadingState((current) => ({ ...current, [key]: false }));
    };
    setLoadingState({ initial: true, funnel: true, ip: true, drive: true, trial: true });
    loadWorkbenchInitialData(appliedFilter).catch(() => null).then((initialData) => {
      if (canceled) return;
      if (initialData) {
        setData(initialData);
        setActiveMetric(initialData.defaultMetricByTab.ip);
      }
      clearLoading('initial');
      void loadFunnelDataPatch(appliedFilter).then(applyPatch).catch(() => null).finally(() => clearLoading('funnel'));
      void loadIpDataPatch(appliedFilter).then(applyPatch).catch(() => null).finally(() => clearLoading('ip'));
      void loadDriveBaseDataPatch(appliedFilter).then(applyPatch).catch(() => null).finally(() => clearLoading('drive'));
      void loadTrialOrderDataPatch(appliedFilter).then(applyPatch).catch(() => null).finally(() => clearLoading('trial'));
    });
    return () => {
      canceled = true;
    };
  }, [appliedFilter, useMockData]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerRecord(null);
        setTrendDomain(null);
      }
    };
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.trend-popover') || target.closest('.icon-button') || target.closest('.trend-more-button')) return;
      setTrendDomain(null);
    };
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  const selectMetric = (domain: DiagnosisDomain, metricLabel: string, scroll: boolean) => {
    setActiveDomain(domain);
    setActiveMetric(metricLabel);
    setSelectedRowKey('');
    if (scroll) {
      requestAnimationFrame(() => document.getElementById('detailDiagnosis')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const hasPendingSearch = JSON.stringify(draftFilter) !== JSON.stringify(appliedFilter);
  const isAnyLoading = Object.values(loadingState).some(Boolean);
  const activeDomainLoading = activeDomain === 'ip'
    ? loadingState.initial || loadingState.ip
    : loadingState.initial || loadingState.drive || loadingState.trial;
  const trendLoading = trendDomain === 'ip'
    ? loadingState.initial || loadingState.ip
    : trendDomain === 'drive'
      ? loadingState.initial || loadingState.drive || loadingState.trial
      : false;
  const applyDraftFilter = () => {
    const nextFilter = normalizeFilterToOptions(draftFilter, filterOptions);
    setDraftFilter(nextFilter);
    setAppliedFilter(nextFilter);
    setLoadingState(useMockData ? IDLE_LOADING_STATE : { initial: true, funnel: true, ip: true, drive: true, trial: true });
    setData(useMockData ? buildWorkbenchMockData() : buildWorkbenchPlaceholderData());
    setSelectedRowKey('');
    setDrawerRecord(null);
    setTrendDomain(null);
  };

  const activeTrend = trendDomain ? data.dailyTrendData[trendDomain] : null;

  return (
    <>
      <Header
        filter={draftFilter}
        titleDealer={appliedFilter.dealer}
        filterOptions={filterOptions}
        onFilterChange={setDraftFilter}
        onSearch={applyDraftFilter}
        hasPendingSearch={hasPendingSearch}
      />
      <main className="page-shell">
        <SourceStatusBar data={data} />
        <FunnelSection metrics={data.funnelMetrics} isLoading={loadingState.initial || loadingState.funnel} />
        <ProcessSection
          data={data}
          activeDomain={activeDomain}
          activeMetric={activeMetric}
          loadingState={loadingState}
          onSelect={selectMetric}
          onOpenTrend={(domain, anchor) => {
            setTrendDomain((current) => (current === domain ? null : domain));
            setTrendAnchor(anchor.getBoundingClientRect());
          }}
        />
        <DiagnosisSection
          data={data}
          activeDomain={activeDomain}
          activeMetric={activeMetric}
          selectedRowKey={selectedRowKey}
          isLoading={activeDomainLoading}
          onSelectTab={(domain) => selectMetric(domain, data.defaultMetricByTab[domain], false)}
          onOpenDrawer={(record, typeName, rowKey) => {
            setSelectedRowKey(rowKey);
            setDrawerRecord(record);
            setDrawerType(typeName);
          }}
        />
      </main>
      <TrendPopover trend={activeTrend} anchor={trendAnchor} isLoading={trendLoading} onClose={() => setTrendDomain(null)} />
      <DetailDrawer record={drawerRecord} typeName={drawerType} isLoading={isAnyLoading} onClose={() => setDrawerRecord(null)} />
      {settings?.title ? <span className="sr-only">{settings.title}</span> : null}
    </>
  );
}
