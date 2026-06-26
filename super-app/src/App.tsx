import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { loadAppSettings, type AppSettings } from './services/settings';
import {
  DEFAULT_BRAND_NAME,
  FALLBACK_FILTER_OPTIONS,
  getSourceReadiness,
  loadSalesFilterOptions,
  loadWorkbenchData,
  type FilterOptionRow,
  type StoreFilter,
} from './services/storeDiagnosis';
import type {
  DailyTrendData,
  DiagnosisDomain,
  DiagnosisRecord,
  FunnelMetric,
  ProcessMetric,
  ProcessMetricGroup,
  TrendDirection,
  WorkbenchData,
} from './types';

const DEFAULT_FILTER: StoreFilter = {
  brand: DEFAULT_BRAND_NAME,
  region: '1南部区',
  district: '何程',
  dealer: '贵州焱森',
  startDate: '2026-06-01',
  endDate: '2026-06-24',
};

const DOMAIN_META: Record<DiagnosisDomain, { tab: string; panel: string; icon: string; className: string }> = {
  ip: { tab: '电话邀约', panel: '邀约', icon: 'call', className: 'ip' },
  drive: { tab: '试驾接待', panel: '试驾', icon: 'directions_car', className: 'drive' },
};

function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
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

function Header({
  filter,
  filterOptions,
  onFilterChange,
}: {
  filter: StoreFilter;
  filterOptions: FilterOptionRow[];
  onFilterChange: (next: StoreFilter) => void;
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
          <h1>{filter.dealer}</h1>
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
          <button className="primary-button" type="button">
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

function FunnelCard({ metric, type }: { metric: FunnelMetric; type: 'volume' | 'rate' }) {
  if (type === 'rate') {
    return (
      <article className="funnel-card rate-card">
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

function FunnelSection({ metrics }: { metrics: FunnelMetric[] }) {
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
    <section className="panel">
      <h2>销售漏斗</h2>
      <div className="funnel-grid">
        {pathItems.map((item) => {
          const metric = metricMap.get(item.label);
          return metric ? <FunnelCard key={item.label} metric={metric} type={item.type} /> : null;
        })}
      </div>
    </section>
  );
}

function ProcessMetricButton({
  metric,
  domain,
  active,
  onSelect,
}: {
  metric: ProcessMetric;
  domain: DiagnosisDomain;
  active: boolean;
  onSelect: (domain: DiagnosisDomain, metric: string, scroll: boolean) => void;
}) {
  return (
    <button className={`process-metric ${active ? `active ${DOMAIN_META[domain].className}` : ''}`} type="button" onClick={() => onSelect(domain, metric.label, true)}>
      <span className="metric-name">{metric.label}</span>
      <span className={metricOutcomeClass(metric)}>
        <Icon name={trendIcon(metric.trend)} />
      </span>
      <strong>{metric.value}</strong>
      <small className={metricOutcomeClass(metric)}>月环比 {metric.mom}</small>
    </button>
  );
}

function ProcessGroup({
  group,
  domain,
  metrics,
  activeMetric,
  activeDomain,
  onSelect,
}: {
  group: ProcessMetricGroup;
  domain: DiagnosisDomain;
  metrics: ProcessMetric[];
  activeMetric: string;
  activeDomain: DiagnosisDomain;
  onSelect: (domain: DiagnosisDomain, metric: string, scroll: boolean) => void;
}) {
  const isActive = activeDomain === domain && group.metrics.includes(activeMetric);

  return (
    <div className={`metric-group ${isActive ? `active ${DOMAIN_META[domain].className}` : ''}`} onClick={() => onSelect(domain, group.defaultMetric, true)}>
      <div className="group-title">{group.title}</div>
      <div className="group-metrics">
        {group.metrics.map((label) => {
          const metric = metrics.find((item) => item.label === label);
          return metric ? (
            <ProcessMetricButton
              key={label}
              metric={metric}
              domain={domain}
              active={activeDomain === domain && activeMetric === label}
              onSelect={onSelect}
            />
          ) : null;
        })}
      </div>
    </div>
  );
}

function ProcessPanel({
  domain,
  data,
  activeDomain,
  activeMetric,
  onSelect,
  onOpenTrend,
}: {
  domain: DiagnosisDomain;
  data: WorkbenchData;
  activeDomain: DiagnosisDomain;
  activeMetric: string;
  onSelect: (domain: DiagnosisDomain, metric: string, scroll: boolean) => void;
  onOpenTrend: (domain: DiagnosisDomain, anchor: HTMLElement) => void;
}) {
  const meta = DOMAIN_META[domain];
  const active = activeDomain === domain;

  return (
    <div className={`process-panel ${active ? `active ${meta.className}` : ''}`} onClick={() => onSelect(domain, data.defaultMetricByTab[domain], true)}>
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
          更多
        </button>
      </div>
      <div className="metric-group-grid">
        {data.processMetricGroups[domain].map((group) => (
          <ProcessGroup
            key={group.title}
            group={group}
            domain={domain}
            metrics={data.processMetrics[domain]}
            activeMetric={activeMetric}
            activeDomain={activeDomain}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function ProcessSection({
  data,
  activeDomain,
  activeMetric,
  onSelect,
  onOpenTrend,
}: {
  data: WorkbenchData;
  activeDomain: DiagnosisDomain;
  activeMetric: string;
  onSelect: (domain: DiagnosisDomain, metric: string, scroll: boolean) => void;
  onOpenTrend: (domain: DiagnosisDomain, anchor: HTMLElement) => void;
}) {
  return (
    <section className="process-grid">
      <ProcessPanel domain="ip" data={data} activeDomain={activeDomain} activeMetric={activeMetric} onSelect={onSelect} onOpenTrend={onOpenTrend} />
      <ProcessPanel domain="drive" data={data} activeDomain={activeDomain} activeMetric={activeMetric} onSelect={onSelect} onOpenTrend={onOpenTrend} />
    </section>
  );
}

function TrendPopover({
  trend,
  anchor,
  onClose,
}: {
  trend: DailyTrendData | null;
  anchor: DOMRect | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [position, setPosition] = useState({ left: 16, top: 16 });
  const [hiddenSeriesNames, setHiddenSeriesNames] = useState<Set<string>>(() => new Set());
  const [hoverState, setHoverState] = useState<{ dayIndex: number; nearestSeriesName: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!trend || !anchor) return;
    requestAnimationFrame(() => {
      const width = ref.current?.offsetWidth ?? Math.min(560, window.innerWidth - 32);
      const height = ref.current?.offsetHeight ?? 320;
      const left = Math.min(Math.max(16, anchor.right - width), window.innerWidth - width - 16);
      let top = anchor.bottom + 8;
      if (top + height > window.innerHeight - 16) {
        top = Math.max(16, anchor.top - height - 8);
      }
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
        <div className="popover-title">
          <div>
            <p>{trend.eyebrow}</p>
            <h3>{trend.title}</h3>
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
    left: 48,
    top: 18,
    width: 470,
    height: 170,
    min: trend.yMin ?? rawMin - padding,
    max: trend.yMax ?? rawMax + padding,
  };
  const yTicks = [0, 25, 50, 75, 100].filter((value) => value >= chart.min && value <= chart.max);

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
    const rect = svgRef.current.getBoundingClientRect();
    const pointerX = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 548;
    const pointerY = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 230;
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
    setHoverState({ dayIndex, nearestSeriesName: nearest.series.name, x, y: nearest.point.y });
  };

  const hoverRows = hoverState
    ? visibleSeries
        .map((series) => ({ series, value: series.values[hoverState.dayIndex], point: getSeriesPoint(series, hoverState.dayIndex) }))
        .filter((item) => Number.isFinite(item.value) && item.point)
    : [];
  const tooltipLeft = hoverState ? Math.min(Math.max(56, hoverState.x + 16), 350) : 0;
  const tooltipTop = hoverState ? Math.min(Math.max(24, hoverState.y - 28), 128) : 0;

  return (
    <div className="trend-popover" ref={ref} style={{ left: position.left, top: position.top }} role="dialog" aria-label={`${trend.eyebrow}趋势浮窗`}>
      <div className="popover-title">
        <div>
          <p>{trend.eyebrow}</p>
          <h3>{trend.title}</h3>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="关闭趋势浮窗">
          <Icon name="close" />
        </button>
      </div>
      <div className="trend-chart">
        <svg ref={svgRef} viewBox="0 0 548 230" role="img" aria-label={`${trend.eyebrow}第二层指标日趋势`}>
          <rect x="0" y="0" width="548" height="230" fill="transparent" />
          {yTicks.map((value) => {
            const y = chart.top + chart.height - ((value - chart.min) / Math.max(chart.max - chart.min, 1)) * chart.height;
            return (
              <g key={value}>
                <line x1={chart.left} y1={y} x2={chart.left + chart.width} y2={y} stroke="#d9e2f2" strokeWidth="1" />
                <line x1={chart.left - 4} y1={y} x2={chart.left} y2={y} stroke="#8da0ba" strokeWidth="1" />
                <text x={chart.left - 8} y={y + 4} textAnchor="end" fontSize="10.5" fill="#5f6f85">
                  {value}
                  {trend.ySuffix ?? ''}
                </text>
              </g>
            );
          })}
          <line x1={chart.left} y1={chart.top} x2={chart.left} y2={chart.top + chart.height} stroke="#8da0ba" strokeWidth="1.2" />
          <line x1={chart.left} y1={chart.top + chart.height} x2={chart.left + chart.width} y2={chart.top + chart.height} stroke="#8da0ba" strokeWidth="1.2" />
          {visibleSeries.map((series) => {
            const points = series.values.map((value, index) => buildTrendPoint(value, series.values, index, trend.days.length, chart, trend.normalize)).join(' ');
            const latest = series.values[series.values.length - 1];
            const latestPoint = buildTrendPoint(latest, series.values, series.values.length - 1, trend.days.length, chart, trend.normalize).split(',');
            const isHighlighted = hoverState?.nearestSeriesName === series.name;
            return (
              <g key={series.name}>
                <polyline
                  points={points}
                  fill="none"
                  stroke={series.color}
                  strokeWidth={isHighlighted ? '3.2' : '2.4'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={hoverState && !isHighlighted ? 0.38 : 1}
                />
                <circle cx={latestPoint[0]} cy={latestPoint[1]} r="3.2" fill={series.color} />
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
          {trend.days.map((day, index) => {
            if (![0, 2, 4, 6, trend.days.length - 1].includes(index)) return null;
            const x = chart.left + (index / (trend.days.length - 1)) * chart.width;
            return (
              <g key={day}>
                <line x1={x} y1={chart.top + chart.height} x2={x} y2={chart.top + chart.height + 4} stroke="#8da0ba" strokeWidth="1" />
                <text x={x} y="218" textAnchor="middle" fontSize="10.5" fill="#5f6f85">
                  {day}
                </text>
              </g>
            );
          })}
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
      <div className="trend-legend">
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
              onClick={() => toggleSeries(series.name)}
            >
              <i style={{ background: series.color }} />
              {series.name}
              <strong>{formatTrendValue(series.name, latest)}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SoftConnector({ activeDomain }: { activeDomain: DiagnosisDomain }) {
  const stroke = activeDomain === 'ip' ? '#9dbaff' : '#9ddbc1';
  const leftStartX = activeDomain === 'ip' ? 18 : 52;
  const rightStartX = activeDomain === 'ip' ? 34 : 68;

  return (
    <div className="soft-connector">
      <svg viewBox="0 0 100 62" preserveAspectRatio="none" aria-hidden="true">
        <path d={`M ${leftStartX} 4 C ${leftStartX} 34, 14 42, 2 58`} stroke={stroke} />
        <path d={`M ${rightStartX} 4 C ${rightStartX} 34, 70 43, 98 58`} stroke={stroke} />
      </svg>
    </div>
  );
}

function DiagnosisSection({
  data,
  activeDomain,
  activeMetric,
  selectedRowKey,
  onSelectTab,
  onOpenDrawer,
}: {
  data: WorkbenchData;
  activeDomain: DiagnosisDomain;
  activeMetric: string;
  selectedRowKey: string;
  onSelectTab: (domain: DiagnosisDomain) => void;
  onOpenDrawer: (record: DiagnosisRecord, typeName: string, rowKey: string) => void;
}) {
  const diagnosis = data.diagnosis[activeDomain];
  const focusTags = data.metricFocusTags[activeMetric] ?? diagnosis.tags.map((item) => item.label);
  const getPrimaryTag = (record: DiagnosisRecord) => record.primaryTag || record.tag || '--';
  const getSecondaryTag = (record: DiagnosisRecord) => record.secondaryTag || '--';
  const totalTagCount = Math.max(diagnosis.tags.reduce((sum, item) => sum + item.count, 0), 1);
  const topTag = diagnosis.tags[0] ?? { label: '暂无负向标签', count: 0, percent: 0, children: [] };
  const topNegativeAdvisor = diagnosis.advisors[0] ?? { name: '暂无负向顾问', count: 0 };
  const maxAdvisorCount = Math.max(1, ...diagnosis.advisors.map((item) => item.count));
  const colors = activeDomain === 'ip' ? ['#003da6', '#006c4a', '#b45f06', '#b42318'] : ['#006c4a', '#003da6', '#b45f06'];

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
      <div className="analysis-grid">
        <div className="sub-panel">
          <div className="sub-panel-title">
            <h3>标签分布</h3>
            <div className="tag-summary">
              <span>记录 {diagnosis.records.length}</span>
              <span className={activeDomain}>TOP {topTag.label}</span>
              <span className="negative">负向顾问 {topNegativeAdvisor.name}</span>
            </div>
          </div>
          <div className="tag-list">
            {diagnosis.tags.map((tag, index) => {
              const color = colors[index % colors.length];
              const childMax = Math.max(1, ...tag.children.map((child) => child.count));
              return (
                <div key={tag.label} className={`tag-card ${focusTags.includes(tag.label) ? `focused ${DOMAIN_META[activeDomain].className}` : 'muted'}`}>
                  <div className="tag-main">
                    <div>
                      <p>
                        <i style={{ background: color }} />
                        {tag.label}
                      </p>
                      <div className="bar-track">
                        <span style={{ width: `${Math.max((tag.count / totalTagCount) * 100, 8)}%`, background: color }} />
                      </div>
                    </div>
                    <strong>{tag.count} / {tag.percent}%</strong>
                  </div>
                  <div className="tag-children">
                    {tag.children.map((child) => (
                      <div key={child.label}>
                        <p>
                          <span>{child.label}</span>
                          <strong>{child.count}</strong>
                        </p>
                        <div className="bar-track small">
                          <span style={{ width: `${Math.max((child.count / childMax) * 100, 10)}%`, background: color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="sub-panel">
          <div className="sub-panel-title simple">
            <h3>顾问分布</h3>
          </div>
          <div className="advisor-list">
            {diagnosis.advisors.map((advisor) => {
              const width = advisor.count > 0 ? Math.max((advisor.count / maxAdvisorCount) * 100, 18) : 0;
              const isTop = advisor.count > 0 && advisor.count === maxAdvisorCount;
              return (
                <div className="advisor-row" key={advisor.name}>
                  <span>{advisor.name}</span>
                  <div className="advisor-bar">
                    <i style={{ width: `${width}%`, background: isTop ? '#b42318' : '#006c4a' }}>{advisor.count}</i>
                  </div>
                  <em>负向</em>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="detail-table-wrap">
        <div className="table-title">
          <h3>明细清单</h3>
          <span>{diagnosis.records.length} 条记录</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>客户</th>
                <th>顾问</th>
                <th>事件时间</th>
                <th>一级标签</th>
                <th>二级标签</th>
                <th>问题摘要</th>
                <th>正负向</th>
              </tr>
            </thead>
            <tbody>
              {diagnosis.records.map((record, index) => {
                const rowKey = `${activeDomain}-${index}`;
                return (
                  <tr key={rowKey} className={selectedRowKey === rowKey ? 'selected' : ''} onClick={() => onOpenDrawer(record, diagnosis.name, rowKey)}>
                    <td>{record.customer}</td>
                    <td>{record.advisor}</td>
                    <td className="mono">{record.time}</td>
                    <td><span className="tag-pill">{getPrimaryTag(record)}</span></td>
                    <td><span className="tag-pill secondary">{getSecondaryTag(record)}</span></td>
                    <td className="summary-cell">{record.summary}</td>
                    <td><strong className="negative-text">{record.polarity}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function DetailDrawer({ record, typeName, onClose }: { record: DiagnosisRecord | null; typeName: string; onClose: () => void }) {
  return (
    <div className={`drawer-backdrop ${record ? 'open' : ''}`} aria-hidden={!record} onClick={(event) => event.currentTarget === event.target && onClose()}>
      <aside className="drawer-panel">
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
                <dt>一级问题</dt>
                <dd className="blue-text">{record.primaryTag || record.tag || '--'}</dd>
              </div>
              <div>
                <dt>二级问题</dt>
                <dd className="blue-text">{record.secondaryTag || '--'}</dd>
              </div>
            </dl>
            <section>
              <h3>问题摘要</h3>
              <p className="info-box">{record.summary}</p>
            </section>
            <section>
              <h3>证据摘录</h3>
              <blockquote>{record.evidence}</blockquote>
            </section>
            <section>
              <h3>建议话术</h3>
              <p className="script-box">{record.script}</p>
            </section>
            <section>
              <h3>下一步动作</h3>
              <div className="action-list">
                <button type="button">
                  建立回访任务
                  <Icon name="task_alt" />
                </button>
                <button type="button">
                  加入顾问复盘清单
                  <Icon name="groups" />
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [filter, setFilter] = useState(DEFAULT_FILTER);
  const [filterOptions, setFilterOptions] = useState<FilterOptionRow[]>(FALLBACK_FILTER_OPTIONS);
  const [data, setData] = useState<WorkbenchData | null>(null);
  const [activeDomain, setActiveDomain] = useState<DiagnosisDomain>('ip');
  const [activeMetric, setActiveMetric] = useState('负向邀约占比');
  const [selectedRowKey, setSelectedRowKey] = useState('');
  const [drawerRecord, setDrawerRecord] = useState<DiagnosisRecord | null>(null);
  const [drawerType, setDrawerType] = useState('');
  const [trendDomain, setTrendDomain] = useState<DiagnosisDomain | null>(null);
  const [trendAnchor, setTrendAnchor] = useState<DOMRect | null>(null);

  useEffect(() => {
    loadAppSettings().then(setSettings).catch(() => setSettings({ title: '单店销售诊断工作台', dataMode: 'hybrid' }));
  }, []);

  useEffect(() => {
    let canceled = false;
    loadSalesFilterOptions(filter.startDate, filter.endDate, filter.brand).then((options) => {
      if (canceled) return;
      setFilterOptions(options);
      setFilter((current) => normalizeFilterToOptions(current, options));
    });
    return () => {
      canceled = true;
    };
  }, [filter.brand, filter.endDate, filter.startDate]);

  useEffect(() => {
    loadWorkbenchData(filter).then((nextData) => {
      setData(nextData);
      setActiveMetric(nextData.defaultMetricByTab.ip);
    });
  }, [filter]);

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

  if (!data) {
    return <div className="loading-state">正在读取单店诊断数据...</div>;
  }

  const activeTrend = trendDomain ? data.dailyTrendData[trendDomain] : null;

  return (
    <>
      <Header filter={filter} filterOptions={filterOptions} onFilterChange={setFilter} />
      <main className="page-shell">
        <SourceStatusBar data={data} />
        <FunnelSection metrics={data.funnelMetrics} />
        <ProcessSection
          data={data}
          activeDomain={activeDomain}
          activeMetric={activeMetric}
          onSelect={selectMetric}
          onOpenTrend={(domain, anchor) => {
            setTrendDomain((current) => (current === domain ? null : domain));
            setTrendAnchor(anchor.getBoundingClientRect());
          }}
        />
        <SoftConnector activeDomain={activeDomain} />
        <DiagnosisSection
          data={data}
          activeDomain={activeDomain}
          activeMetric={activeMetric}
          selectedRowKey={selectedRowKey}
          onSelectTab={(domain) => selectMetric(domain, data.defaultMetricByTab[domain], false)}
          onOpenDrawer={(record, typeName, rowKey) => {
            setSelectedRowKey(rowKey);
            setDrawerRecord(record);
            setDrawerType(typeName);
          }}
        />
      </main>
      <TrendPopover trend={activeTrend} anchor={trendAnchor} onClose={() => setTrendDomain(null)} />
      <DetailDrawer record={drawerRecord} typeName={drawerType} onClose={() => setDrawerRecord(null)} />
      {settings?.title ? <span className="sr-only">{settings.title}</span> : null}
    </>
  );
}
