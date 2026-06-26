import { mockWorkbenchData } from '../data/mockWorkbenchData';
import type { DailyTrendData, DiagnosisDomain, FunnelMetric, ProcessMetric, WorkbenchData } from '../types';
import { previewDatasetRows, type DatasetFilterCondition } from './guandataDataset';

const SALES_DS_ID = 'gae00de628b274fdf837719d';
const DCC_DS_ID = 'fa1bfbd7736f34d1d8633883';
const DRIVE_DS_ID = 'c6428f1c9ca204859b553421';
const RANK_DS_ID = 'xa257b3a018be4418b6100bc';
const IP_TAG_DS_ID = 'n418e47dacdb94291993d3d9';
export const DEFAULT_BRAND_NAME = 'MG';
const DCC_REPORT_CHANNELS = ['厂方新媒体', '媒介投放', '官网及电商', '经销商新媒体', '网销平台', '基地', '官方新媒体', 'MCN'];

export interface FilterOptionRow {
  region: string;
  district: string;
  dealer: string;
}

export const FALLBACK_FILTER_OPTIONS: FilterOptionRow[] = [
  { region: '1南部区', district: '何程', dealer: '贵州焱森' },
  { region: '2华中区', district: '李明', dealer: '潍坊大有恒通' },
  { region: '3西部区', district: '童林龙', dealer: '成都广爵' },
  { region: '4苏皖区', district: '罗恩', dealer: '泰州创美-泰州市泰兴市MG2店' },
  { region: '5北方区', district: '刘政皓', dealer: '北京祥瑞禹博' },
  { region: '6东南区', district: '张宗雷', dealer: '深圳标域B' },
  { region: '7中南区', district: '曾强', dealer: '漳州汇爵' },
];

const RANK_METRIC_CODE_BY_LABEL: Record<string, string> = {
  下发线索: 'assigned_leads',
  到店: 'arrivals',
  试驾: 'test_drives',
  订单: 'orders',
};

export interface StoreFilter {
  brand: string;
  region: string;
  district: string;
  dealer: string;
  startDate: string;
  endDate: string;
}

export interface SourceReadiness {
  confirmedSources: string[];
  pendingSources: Array<{ key: DiagnosisDomain; label: string; note: string }>;
}

interface SalesAggregate {
  dealerCode: string;
  dealerName: string;
  region: string;
  district: string;
  assignedLeads: number;
  arrivals: number;
  testDrives: number;
  orders: number;
}

interface DccAggregate {
  connectRate: number | null;
  shortCallRate: number | null;
  outbound30Rate: number | null;
  twoDayThreeCallRate: number | null;
}

interface DriveAggregate {
  avgMileage: number | null;
  avgDuration: number | null;
}

interface IpTagAggregate {
  totalCalls: number;
  negativeCalls: number;
  negativeRate: number | null;
  tags: WorkbenchData['diagnosis']['ip']['tags'];
  advisors: WorkbenchData['diagnosis']['ip']['advisors'];
  records: WorkbenchData['diagnosis']['ip']['records'];
}

interface DailyDccAggregate extends DccAggregate {
  date: string;
}

interface DailyDriveAggregate extends DriveAggregate {
  date: string;
}

interface DailyIpTagAggregate {
  date: string;
  negativeRate: number | null;
}

function toNumber(value: unknown): number {
  if (value == null || value === '') return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return (numerator / denominator) * 100;
}

function formatInteger(value: number): string {
  return String(Math.round(value));
}

function formatPercent(value: number | null): string {
  return value == null ? '--' : value.toFixed(1);
}

function formatMetricValue(value: number | null, suffix = ''): string {
  return value == null ? '--' : `${value.toFixed(1)}${suffix}`;
}

function trend(current: number | null, previous: number | null): 'up' | 'down' {
  if (current == null || previous == null) return 'down';
  return current >= previous ? 'up' : 'down';
}

function comparePercent(current: number, previous: number): string {
  if (!previous) return '月环比 --';
  const diff = ((current - previous) / previous) * 100;
  return `月环比 ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
}

function comparePct(current: number | null, previous: number | null): string {
  if (current == null || previous == null) return '月环比 --';
  const diff = current - previous;
  return `月环比 ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}pct`;
}

function compareUnit(current: number | null, previous: number | null, unit: string): string {
  if (current == null || previous == null) return '月环比 --';
  const diff = current - previous;
  return `月环比 ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}${unit}`;
}

function compareIpTagPct(current: number | null, previous: number | null): string {
  if (current == null || previous == null) return '上月同期打标数据不足';
  return comparePct(current, previous).replace('月环比 ', '');
}

function addMonths(dateText: string, offset: number): string {
  const [year, month, day] = dateText.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthFromDate(dateText: string): string {
  return dateText.slice(0, 7);
}

function sameMonth(startDate: string, endDate: string): boolean {
  return monthFromDate(startDate) === monthFromDate(endDate);
}

function fieldEquals(row: Record<string, string>, field: string, expected: string): boolean {
  return String(row[field] ?? '').trim() === expected;
}

function buildDateFilter(field: string, startDate: string, endDate: string): DatasetFilterCondition {
  return { field, type: 'BT', value: [startDate, endDate] };
}

function buildDateTimeFilter(field: string, startDate: string, endDate: string): DatasetFilterCondition {
  return { field, type: 'BT', value: [`${startDate} 00:00:00`, `${endDate} 23:59:59`] };
}

function dateKey(value: unknown): string {
  const matched = String(value || '').match(/\d{4}-\d{2}-\d{2}/);
  return matched?.[0] || '';
}

function formatTrendDay(date: string): string {
  return date.slice(5);
}

function sortByText<T>(items: T[], getter: (item: T) => string): T[] {
  return [...items].sort((a, b) => getter(a).localeCompare(getter(b), 'zh-CN'));
}

function mergeFilterOptions(options: FilterOptionRow[]): FilterOptionRow[] {
  const uniqueRows = new Map<string, FilterOptionRow>();
  [...FALLBACK_FILTER_OPTIONS, ...options].forEach((item) => {
    if (!item.region || !item.district || !item.dealer) return;
    uniqueRows.set(`${item.region}|${item.district}|${item.dealer}`, item);
  });
  return sortByText([...uniqueRows.values()], (item) => `${item.region}|${item.district}|${item.dealer}`);
}

function getBrandName(brand?: string): string {
  return brand || DEFAULT_BRAND_NAME;
}

function aggregateDccRows(rows: Record<string, string>[]): DccAggregate {
  const leadRows = rows.filter((row) => String(row['线索编码'] || '').trim());
  const leadCount = leadRows.length;
  const distinctLeadCount = new Set(leadRows.map((row) => String(row['线索编码'] || '').trim()).filter(Boolean)).size;
  const connected = new Set(
    leadRows
      .filter((row) => toNumber(row['线索下发72小时外呼接通次数']) > 0)
      .map((row) => row['线索编码'])
      .filter(Boolean),
  ).size;
  const shortCall = distinctCount(leadRows, (group) => group.some((row) => row['72小时总通话时长'] === '' || toNumber(row['72小时总通话时长']) < 30));
  const worktimeRows = leadRows.filter((row) => row['是否工作时段线索（10-18）'] === '工作时段');
  const outbound30 = leadRows.filter((row) => row['工作时段30分钟跟进（10-18）'] === '是').length;
  const threeCall = leadRows.filter((row) => row['是否完成72小时三呼'] === '是').length;

  return {
    connectRate: percent(connected, distinctLeadCount),
    shortCallRate: percent(shortCall, leadCount),
    outbound30Rate: percent(outbound30, worktimeRows.length),
    twoDayThreeCallRate: percent(threeCall, leadCount),
  };
}

function aggregateDriveRows(rows: Record<string, string>[]): DriveAggregate {
  const deduped = new Map<string, Record<string, string>>();
  rows.forEach((row) => {
    const id = String(row['试驾接待编码'] || '').trim();
    if (id) deduped.set(id, row);
  });
  const events = [...deduped.values()];
  const mileageRows = events.filter((row) => toNumber(row['试驾里程']) > 0);
  const durationRows = events.filter((row) => toNumber(row['试驾时长(分钟)']) > 0);

  return {
    avgMileage: mileageRows.length ? mileageRows.reduce((sum, row) => sum + toNumber(row['试驾里程']), 0) / mileageRows.length : null,
    avgDuration: durationRows.length ? durationRows.reduce((sum, row) => sum + toNumber(row['试驾时长(分钟)']), 0) / durationRows.length : null,
  };
}

function buildIpTagAggregate(rows: Record<string, string>[]): IpTagAggregate {
  const calls = new Map<string, Record<string, string>[]>();
  rows.forEach((row) => {
    const callId = String(row['呼叫编码'] || '').trim();
    if (!callId) return;
    calls.set(callId, [...(calls.get(callId) || []), row]);
  });

  const negativeCalls = [...calls.values()].filter((callRows) => callRows.some((row) => row['标签正负向'] === '负向')).length;
  const negativeRows = rows.filter((row) => row['标签正负向'] === '负向');
  const tagGroups = new Map<string, Map<string, number>>();
  negativeRows.forEach((row) => {
    const primary = String(row['一级标签'] || '').trim();
    const secondary = String(row['二级标签'] || '').trim();
    if (!primary || !secondary) return;
    const childMap = tagGroups.get(primary) || new Map<string, number>();
    childMap.set(secondary, (childMap.get(secondary) || 0) + 1);
    tagGroups.set(primary, childMap);
  });
  const totalTagRows = [...tagGroups.values()].reduce((sum, children) => sum + [...children.values()].reduce((childSum, count) => childSum + count, 0), 0);
  const tags = [...tagGroups.entries()]
    .map(([label, children]) => {
      const count = [...children.values()].reduce((sum, value) => sum + value, 0);
      return {
        label,
        count,
        percent: totalTagRows ? Math.round((count / totalTagRows) * 100) : 0,
        children: [...children.entries()]
          .map(([childLabel, childCount]) => ({ label: childLabel, count: childCount }))
          .sort((left, right) => right.count - left.count),
      };
    })
    .sort((left, right) => right.count - left.count);

  const advisorCalls = new Map<string, Set<string>>();
  negativeRows.forEach((row) => {
    const callId = String(row['呼叫编码'] || '').trim();
    const advisorCode = String(row['顾问编码'] || '').trim();
    const advisorName = String(row['顾问名称'] || '').trim() || '未知顾问';
    if (!callId) return;
    const key = `${advisorCode || advisorName}|${advisorName}`;
    const callSet = advisorCalls.get(key) || new Set<string>();
    callSet.add(callId);
    advisorCalls.set(key, callSet);
  });
  const advisors = [...advisorCalls.entries()]
    .map(([key, callSet]) => ({ name: key.split('|')[1] || '未知顾问', count: callSet.size }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  const records = negativeRows
    .slice()
    .sort((left, right) => String(right['呼叫开始时间'] || '').localeCompare(String(left['呼叫开始时间'] || '')))
    .slice(0, 50)
    .map((row) => {
      const customer = String(row['客户名称:原则上所有周期的客户姓名一致,但当手机号更换了属主之后,会不一致'] || '').trim() || '未命名客户';
      const customerEvidence = String(row['证据原文-客户'] || '').trim();
      const advisorEvidence = String(row['证据原文-顾问'] || '').trim();
      const primaryTag = String(row['一级标签'] || '').trim();
      const secondaryTag = String(row['二级标签'] || '').trim();
      return {
        customer,
        advisor: String(row['顾问名称'] || '').trim() || '未知顾问',
        time: String(row['呼叫开始时间'] || '').trim(),
        tag: primaryTag || secondaryTag || '负向邀约',
        primaryTag: primaryTag || '未命中一级标签',
        secondaryTag: secondaryTag || '未命中二级标签',
        polarity: '负向',
        summary: String(row['命中原因'] || '').trim() || '该通电话命中负向邀约标签。',
        evidence: [customerEvidence && `客户：${customerEvidence}`, advisorEvidence && `顾问：${advisorEvidence}`].filter(Boolean).join('；') || String(row['证据原文-顾问'] || row['证据原文-客户'] || '').trim(),
        script: '结合命中原因复盘到店理由、到店时间锁定和客户顾虑承接。',
      };
    });

  return {
    totalCalls: calls.size,
    negativeCalls,
    negativeRate: percent(negativeCalls, calls.size),
    tags,
    advisors,
    records,
  };
}

export async function loadSalesFilterOptions(startDate: string, endDate: string, brand = DEFAULT_BRAND_NAME): Promise<FilterOptionRow[]> {
  try {
    const rows = await previewDatasetRows(SALES_DS_ID, {
      limit: 60000,
      filters: [
        buildDateFilter('日期', startDate, endDate),
        { field: '品牌名称', type: 'EQ', value: getBrandName(brand) },
      ],
    });
    const uniqueRows = new Map<string, FilterOptionRow>();
    rows.forEach((row) => {
      const region = String(row['大区简称'] || row['大区名称'] || '').trim();
      const district = String(row['小区简称'] || row['小区名称'] || '').trim();
      const dealer = String(row['经销商简称'] || row['经销商名称'] || '').trim();
      if (!region || !district || !dealer) return;
      uniqueRows.set(`${region}|${district}|${dealer}`, { region, district, dealer });
    });
    return mergeFilterOptions([...uniqueRows.values()]);
  } catch {
    return FALLBACK_FILTER_OPTIONS;
  }
}

async function fetchSales(filter: StoreFilter, startDate: string, endDate: string): Promise<SalesAggregate> {
  const rows = await previewDatasetRows(SALES_DS_ID, {
    limit: 5000,
    filters: [
      { field: '经销商简称', type: 'EQ', value: filter.dealer },
      buildDateFilter('日期', startDate, endDate),
      { field: '品牌名称', type: 'EQ', value: getBrandName(filter.brand) },
    ],
  });

  const aggregate = rows.reduce<SalesAggregate>(
    (acc, row) => {
      acc.dealerCode ||= row['经销商代码'] || '';
      acc.dealerName ||= row['经销商简称'] || row['经销商名称'] || filter.dealer;
      acc.region ||= row['大区简称'] || row['大区名称'] || filter.region;
      acc.district ||= row['小区简称'] || row['小区名称'] || filter.district;
      acc.assignedLeads += toNumber(row['当日下发线索数']);
      acc.arrivals += toNumber(row['当日首触客流数']);
      acc.testDrives += toNumber(row['当日首触试驾数']);
      acc.orders += toNumber(row['当日订单数（首触）']);
      return acc;
    },
    {
      dealerCode: '',
      dealerName: filter.dealer,
      region: filter.region,
      district: filter.district,
      assignedLeads: 0,
      arrivals: 0,
      testDrives: 0,
      orders: 0,
    },
  );

  if (!aggregate.dealerCode && rows.length === 0) {
    throw new Error(`销售漏斗数据集未查到门店：${filter.dealer}`);
  }

  return aggregate;
}

function distinctCount(rows: Record<string, string>[], predicate: (rows: Record<string, string>[]) => boolean): number {
  const grouped = new Map<string, Record<string, string>[]>();
  rows.forEach((row) => {
    const leadId = String(row['线索编码'] || '').trim();
    if (!leadId) return;
    grouped.set(leadId, [...(grouped.get(leadId) || []), row]);
  });
  return [...grouped.values()].filter(predicate).length;
}

async function fetchDcc(dealerCode: string, brand: string, startDate: string, endDate: string): Promise<DccAggregate> {
  const rows = await previewDatasetRows(DCC_DS_ID, {
    limit: 60000,
    filters: [
      { field: '经销商代码', type: 'EQ', value: dealerCode },
      buildDateTimeFilter('下发CRM时间', startDate, endDate),
      { field: '品牌名称', type: 'EQ', value: getBrandName(brand) },
      { field: '线索渠道大类名称', type: 'IN', value: DCC_REPORT_CHANNELS },
      { field: '开业状态', type: 'EQ', value: '1' },
      { field: 'data_type_ch', type: 'NE', value: '来电咨询' },
      { field: '线索免考核', type: 'EQ', value: '待考核' },
      { field: '需跟进', type: 'EQ', value: '需跟进' },
    ],
  });

  return aggregateDccRows(rows);
}

async function fetchDrive(dealerCode: string, startDate: string, endDate: string): Promise<DriveAggregate> {
  const rows = await previewDatasetRows(DRIVE_DS_ID, {
    limit: 10000,
    filters: [
      { field: '试驾接待经销商代码', type: 'EQ', value: dealerCode },
      buildDateFilter('试驾接待日期', startDate, endDate),
      { field: '是否成功试驾', type: 'EQ', value: '是' },
    ],
  });

  return aggregateDriveRows(rows);
}

async function fetchIpTags(dealerCode: string, brand: string, startDate: string, endDate: string): Promise<IpTagAggregate> {
  const rows = await previewDatasetRows(IP_TAG_DS_ID, {
    limit: 60000,
    filters: [
      { field: '经销商代码', type: 'EQ', value: dealerCode },
      buildDateTimeFilter('呼叫开始时间', startDate, endDate),
      { field: '品牌名称', type: 'EQ', value: getBrandName(brand) },
    ],
  });

  return buildIpTagAggregate(rows);
}

async function fetchDccDailyTrend(dealerCode: string, brand: string, startDate: string, endDate: string): Promise<DailyDccAggregate[]> {
  const rows = await previewDatasetRows(DCC_DS_ID, {
    limit: 60000,
    filters: [
      { field: '经销商代码', type: 'EQ', value: dealerCode },
      buildDateTimeFilter('下发CRM时间', startDate, endDate),
      { field: '品牌名称', type: 'EQ', value: getBrandName(brand) },
      { field: '线索渠道大类名称', type: 'IN', value: DCC_REPORT_CHANNELS },
      { field: '开业状态', type: 'EQ', value: '1' },
      { field: 'data_type_ch', type: 'NE', value: '来电咨询' },
      { field: '线索免考核', type: 'EQ', value: '待考核' },
      { field: '需跟进', type: 'EQ', value: '需跟进' },
    ],
  });
  const grouped = new Map<string, Record<string, string>[]>();
  rows.forEach((row) => {
    const date = dateKey(row['下发CRM时间']);
    if (!date) return;
    grouped.set(date, [...(grouped.get(date) || []), row]);
  });
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dayRows]) => ({ date, ...aggregateDccRows(dayRows) }));
}

async function fetchDriveDailyTrend(dealerCode: string, startDate: string, endDate: string): Promise<DailyDriveAggregate[]> {
  const rows = await previewDatasetRows(DRIVE_DS_ID, {
    limit: 10000,
    filters: [
      { field: '试驾接待经销商代码', type: 'EQ', value: dealerCode },
      buildDateFilter('试驾接待日期', startDate, endDate),
      { field: '是否成功试驾', type: 'EQ', value: '是' },
    ],
  });
  const grouped = new Map<string, Record<string, string>[]>();
  rows.forEach((row) => {
    const date = dateKey(row['试驾接待日期']);
    if (!date) return;
    grouped.set(date, [...(grouped.get(date) || []), row]);
  });
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dayRows]) => ({ date, ...aggregateDriveRows(dayRows) }));
}

async function fetchIpTagDailyTrend(dealerCode: string, brand: string, startDate: string, endDate: string): Promise<DailyIpTagAggregate[]> {
  const rows = await previewDatasetRows(IP_TAG_DS_ID, {
    limit: 60000,
    filters: [
      { field: '经销商代码', type: 'EQ', value: dealerCode },
      buildDateTimeFilter('呼叫开始时间', startDate, endDate),
      { field: '品牌名称', type: 'EQ', value: getBrandName(brand) },
    ],
  });
  const grouped = new Map<string, Record<string, string>[]>();
  rows.forEach((row) => {
    const date = dateKey(row['呼叫开始时间']);
    if (!date) return;
    grouped.set(date, [...(grouped.get(date) || []), row]);
  });
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dayRows]) => ({ date, negativeRate: buildIpTagAggregate(dayRows).negativeRate }));
}

async function fetchRanks(dealerCode: string, startDate: string, endDate: string): Promise<Record<string, string>> {
  const filters: DatasetFilterCondition[] = [
    { field: '经销商代码', type: 'EQ', value: dealerCode },
    { field: '排名范围类型', type: 'EQ', value: '小区' },
    { field: '指标编码', type: 'IN', value: Object.values(RANK_METRIC_CODE_BY_LABEL) },
  ];
  if (sameMonth(startDate, endDate)) {
    filters.push({ field: '统计月份', type: 'EQ', value: monthFromDate(startDate) });
  }
  const rows = await previewDatasetRows(RANK_DS_ID, { limit: 200, filters });
  return Object.fromEntries(
    Object.entries(RANK_METRIC_CODE_BY_LABEL).map(([label, code]) => {
      const row = rows.find((item) => fieldEquals(item, '指标编码', code));
      const rank = row ? `${formatInteger(toNumber(row['官方排名']))}/${formatInteger(toNumber(row['排名总数']))}` : '--';
      return [label, rank];
    }),
  );
}

function buildFunnel(current: SalesAggregate, previous: SalesAggregate, ranks: Record<string, string>): FunnelMetric[] {
  const leadToArrival = percent(current.arrivals, current.assignedLeads);
  const arrivalToDrive = percent(current.testDrives, current.arrivals);
  const driveToOrder = percent(current.orders, current.testDrives);
  const leadToOrder = percent(current.orders, current.assignedLeads);
  const prevLeadToArrival = percent(previous.arrivals, previous.assignedLeads);
  const prevArrivalToDrive = percent(previous.testDrives, previous.arrivals);
  const prevDriveToOrder = percent(previous.orders, previous.testDrives);
  const prevLeadToOrder = percent(previous.orders, previous.assignedLeads);

  return [
    { label: '下发线索', value: formatInteger(current.assignedLeads), unit: '条', compare: comparePercent(current.assignedLeads, previous.assignedLeads), trend: trend(current.assignedLeads, previous.assignedLeads), rank: ranks['下发线索'] },
    { label: '到店', value: formatInteger(current.arrivals), unit: '人', compare: comparePercent(current.arrivals, previous.arrivals), trend: trend(current.arrivals, previous.arrivals), rank: ranks['到店'] },
    { label: '试驾', value: formatInteger(current.testDrives), unit: '人', compare: comparePercent(current.testDrives, previous.testDrives), trend: trend(current.testDrives, previous.testDrives), rank: ranks['试驾'] },
    { label: '订单', value: formatInteger(current.orders), unit: '单', compare: comparePercent(current.orders, previous.orders), trend: trend(current.orders, previous.orders), rank: ranks['订单'] },
    { label: '线索到店率', value: formatPercent(leadToArrival), unit: '%', compare: comparePct(leadToArrival, prevLeadToArrival), trend: trend(leadToArrival, prevLeadToArrival) },
    { label: '到店试驾率', value: formatPercent(arrivalToDrive), unit: '%', compare: comparePct(arrivalToDrive, prevArrivalToDrive), trend: trend(arrivalToDrive, prevArrivalToDrive) },
    { label: '试驾订单率', value: formatPercent(driveToOrder), unit: '%', compare: comparePct(driveToOrder, prevDriveToOrder), trend: trend(driveToOrder, prevDriveToOrder) },
    { label: '线索订单率', value: formatPercent(leadToOrder), unit: '%', compare: comparePct(leadToOrder, prevLeadToOrder), trend: trend(leadToOrder, prevLeadToOrder) },
  ];
}

function buildProcessMetrics(
  currentDcc: DccAggregate,
  prevDcc: DccAggregate,
  currentDrive: DriveAggregate,
  prevDrive: DriveAggregate,
  currentIpTags: IpTagAggregate,
  prevIpTags: IpTagAggregate,
): Record<DiagnosisDomain, ProcessMetric[]> {
  const mockNegativeDrive = mockWorkbenchData.processMetrics.drive.find((item) => item.label === '负向试驾接待占比');
  return {
    ip: [
      { label: '线索接通率', value: `${formatPercent(currentDcc.connectRate)}%`, mom: comparePct(currentDcc.connectRate, prevDcc.connectRate).replace('月环比 ', ''), trend: trend(currentDcc.connectRate, prevDcc.connectRate), source: 'guandata' },
      { label: '30s以下线索占比', value: `${formatPercent(currentDcc.shortCallRate)}%`, mom: comparePct(currentDcc.shortCallRate, prevDcc.shortCallRate).replace('月环比 ', ''), trend: trend(currentDcc.shortCallRate, prevDcc.shortCallRate), source: 'guandata' },
      { label: '30分钟外呼率', value: `${formatPercent(currentDcc.outbound30Rate)}%`, mom: comparePct(currentDcc.outbound30Rate, prevDcc.outbound30Rate).replace('月环比 ', ''), trend: trend(currentDcc.outbound30Rate, prevDcc.outbound30Rate), source: 'guandata' },
      { label: '2天3呼率', value: `${formatPercent(currentDcc.twoDayThreeCallRate)}%`, mom: comparePct(currentDcc.twoDayThreeCallRate, prevDcc.twoDayThreeCallRate).replace('月环比 ', ''), trend: trend(currentDcc.twoDayThreeCallRate, prevDcc.twoDayThreeCallRate), source: 'guandata' },
      { label: '负向邀约占比', value: `${formatPercent(currentIpTags.negativeRate)}%`, mom: compareIpTagPct(currentIpTags.negativeRate, prevIpTags.negativeRate), trend: trend(currentIpTags.negativeRate, prevIpTags.negativeRate), source: 'guandata' },
    ],
    drive: [
      { label: '试驾平均里程', value: formatMetricValue(currentDrive.avgMileage, 'km'), mom: compareUnit(currentDrive.avgMileage, prevDrive.avgMileage, 'km').replace('月环比 ', ''), trend: trend(currentDrive.avgMileage, prevDrive.avgMileage), source: 'guandata' },
      { label: '平均时长', value: formatMetricValue(currentDrive.avgDuration, 'min'), mom: compareUnit(currentDrive.avgDuration, prevDrive.avgDuration, 'min').replace('月环比 ', ''), trend: trend(currentDrive.avgDuration, prevDrive.avgDuration), source: 'guandata' },
      { ...(mockNegativeDrive || mockWorkbenchData.processMetrics.drive[2]), source: 'mock' },
    ],
  };
}

function buildEmptyTrend(domain: DiagnosisDomain): DailyTrendData {
  return {
    eyebrow: DOMAIN_TREND_META[domain].eyebrow,
    title: '第二层指标日趋势',
    yMin: 0,
    yMax: 100,
    ySuffix: DOMAIN_TREND_META[domain].ySuffix,
    normalize: DOMAIN_TREND_META[domain].normalize,
    days: [],
    series: [],
  };
}

const DOMAIN_TREND_META: Record<DiagnosisDomain, { eyebrow: string; ySuffix?: string; normalize?: boolean }> = {
  ip: { eyebrow: '邀约', ySuffix: '%' },
  drive: { eyebrow: '试驾', normalize: true },
};

function withoutMockNegativeTrendData(trendData: Record<DiagnosisDomain, DailyTrendData>): Record<DiagnosisDomain, DailyTrendData> {
  return {
    ip: { ...trendData.ip, series: trendData.ip.series.filter((series) => !series.name.includes('负向')) },
    drive: { ...trendData.drive, series: trendData.drive.series.filter((series) => !series.name.includes('负向')) },
  };
}

function buildDailyTrendData(dccRows: DailyDccAggregate[], driveRows: DailyDriveAggregate[], ipTagRows: DailyIpTagAggregate[]): Record<DiagnosisDomain, DailyTrendData> {
  const dccByDate = new Map(dccRows.map((row) => [row.date, row]));
  const ipTagByDate = new Map(ipTagRows.map((row) => [row.date, row]));
  const ipTrendDates = [...new Set([...dccRows.map((row) => row.date), ...ipTagRows.map((row) => row.date)])].sort();
  return {
    ip: {
      ...buildEmptyTrend('ip'),
      days: ipTrendDates.map((date) => formatTrendDay(date)),
      series: [
        { name: '线索接通率', color: '#003da6', values: ipTrendDates.map((date) => dccByDate.get(date)?.connectRate ?? 0) },
        { name: '30s以下线索占比', color: '#006c4a', values: ipTrendDates.map((date) => dccByDate.get(date)?.shortCallRate ?? 0) },
        { name: '30分钟外呼率', color: '#b45f06', values: ipTrendDates.map((date) => dccByDate.get(date)?.outbound30Rate ?? 0) },
        { name: '2天3呼率', color: '#7c3aed', values: ipTrendDates.map((date) => dccByDate.get(date)?.twoDayThreeCallRate ?? 0) },
        { name: '负向邀约占比', color: '#b42318', values: ipTrendDates.map((date) => ipTagByDate.get(date)?.negativeRate ?? 0) },
      ].filter((series) => series.values.length > 0),
    },
    drive: {
      ...buildEmptyTrend('drive'),
      days: driveRows.map((row) => formatTrendDay(row.date)),
      series: [
        { name: '试驾平均里程', color: '#003da6', values: driveRows.map((row) => row.avgMileage ?? 0) },
        { name: '平均时长', color: '#b45f06', values: driveRows.map((row) => row.avgDuration ?? 0) },
      ].filter((series) => series.values.length > 0),
    },
  };
}

export async function loadWorkbenchData(filter: StoreFilter): Promise<WorkbenchData> {
  const warnings: string[] = [];
  const previousStart = addMonths(filter.startDate, -1);
  const previousEnd = addMonths(filter.endDate, -1);

  try {
    const currentSales = await fetchSales(filter, filter.startDate, filter.endDate);
    const previousSales = await fetchSales(filter, previousStart, previousEnd).catch((error) => {
      warnings.push(`销售漏斗上月同期读取失败：${error instanceof Error ? error.message : String(error)}`);
      return { ...currentSales, assignedLeads: 0, arrivals: 0, testDrives: 0, orders: 0 };
    });
    const [currentDcc, prevDcc, currentDrive, prevDrive, currentIpTags, prevIpTags, ranks, dccTrend, driveTrend, ipTagTrend] = await Promise.all([
      fetchDcc(currentSales.dealerCode, filter.brand, filter.startDate, filter.endDate),
      fetchDcc(currentSales.dealerCode, filter.brand, previousStart, previousEnd).catch((error) => {
        warnings.push(`DCC 上月同期读取失败：${error instanceof Error ? error.message : String(error)}`);
        return { connectRate: null, shortCallRate: null, outbound30Rate: null, twoDayThreeCallRate: null };
      }),
      fetchDrive(currentSales.dealerCode, filter.startDate, filter.endDate),
      fetchDrive(currentSales.dealerCode, previousStart, previousEnd).catch((error) => {
        warnings.push(`试驾上月同期读取失败：${error instanceof Error ? error.message : String(error)}`);
        return { avgMileage: null, avgDuration: null };
      }),
      fetchIpTags(currentSales.dealerCode, filter.brand, filter.startDate, filter.endDate),
      fetchIpTags(currentSales.dealerCode, filter.brand, previousStart, previousEnd).catch(() => ({
        totalCalls: 0,
        negativeCalls: 0,
        negativeRate: null,
        tags: [],
        advisors: [],
        records: [],
      })),
      fetchRanks(currentSales.dealerCode, filter.startDate, filter.endDate).catch((error) => {
        warnings.push(`官方排名分位读取失败：${error instanceof Error ? error.message : String(error)}`);
        return {};
      }),
      fetchDccDailyTrend(currentSales.dealerCode, filter.brand, filter.startDate, filter.endDate).catch((error) => {
        warnings.push(`邀约日趋势读取失败：${error instanceof Error ? error.message : String(error)}`);
        return [];
      }),
      fetchDriveDailyTrend(currentSales.dealerCode, filter.startDate, filter.endDate).catch((error) => {
        warnings.push(`试驾日趋势读取失败：${error instanceof Error ? error.message : String(error)}`);
        return [];
      }),
      fetchIpTagDailyTrend(currentSales.dealerCode, filter.brand, filter.startDate, filter.endDate).catch((error) => {
        warnings.push(`IP 打标日趋势读取失败：${error instanceof Error ? error.message : String(error)}`);
        return [];
      }),
    ]);

    return {
      ...mockWorkbenchData,
      funnelMetrics: buildFunnel(currentSales, previousSales, ranks),
      processMetrics: buildProcessMetrics(currentDcc, prevDcc, currentDrive, prevDrive, currentIpTags, prevIpTags),
      dailyTrendData: buildDailyTrendData(dccTrend, driveTrend, ipTagTrend),
      diagnosis: {
        ...mockWorkbenchData.diagnosis,
        ip: {
          name: 'IP 电话',
          sourceStatus: 'confirmed',
          sourceNote: `已接入观远 IP 电话邀约问题诊断明细表，当前筛选范围 ${currentIpTags.totalCalls} 通电话，负向 ${currentIpTags.negativeCalls} 通。`,
          tags: currentIpTags.tags,
          advisors: currentIpTags.advisors,
          records: currentIpTags.records,
        },
      },
      dataMode: 'hybrid',
      sourceWarnings: warnings,
    };
  } catch (error) {
    return {
      ...mockWorkbenchData,
      dailyTrendData: withoutMockNegativeTrendData(mockWorkbenchData.dailyTrendData),
      dataMode: 'mock',
      sourceWarnings: [`观远已确认数据集读取失败，已回退 mock：${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

export function getSourceReadiness(data: WorkbenchData): SourceReadiness {
  const modeLabel = data.dataMode === 'mock' ? '读取失败回退 mock' : '已接入观远';
  return {
    confirmedSources: [`销售漏斗指标源（${modeLabel}）`, `DCC 话务指标源（${modeLabel}）`, `IP 打标明细数据集（${modeLabel}）`, `试驾明细宽表（${modeLabel}）`, `官方排名分位结果表（${modeLabel}）`],
    pendingSources: [
      { key: 'drive', label: '试驾打标明细数据集', note: data.diagnosis.drive.sourceNote },
    ],
  };
}
