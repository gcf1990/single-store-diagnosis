import { mockWorkbenchData } from '../data/mockWorkbenchData';
import type { DailyTrendData, DiagnosisDataset, DiagnosisDomain, DiagnosisProblem, DiagnosisRecord, DiagnosisTag, EvidenceContextStatus, EvidenceTurn, FunnelMetric, ProblemNegativeRate, ProcessMetric, WorkbenchData } from '../types';
import { previewDatasetRows, type DatasetFilterCondition } from './guandataDataset';

const SALES_DS_ID = 'k4c14c31c595540a0a771f50';
const DCC_DS_ID = 'fa1bfbd7736f34d1d8633883';
const DRIVE_DS_ID = 'c6428f1c9ca204859b553421';
const ORDER_DS_ID = 'm349be19f5f4c4fcc8f82d69';
const RANK_DS_ID = 'xa257b3a018be4418b6100bc';
const IP_TAG_DS_ID = 'n418e47dacdb94291993d3d9';
const DRIVE_TAG_DS_ID = 'g9da02067b8a6432486f58f9';
export const DEFAULT_BRAND_NAME = 'MG';
const DCC_REPORT_CHANNELS = ['厂方新媒体', '媒介投放', '官网及电商', '经销商新媒体', '网销平台', '基地', '官方新媒体', 'MCN'];
const salesAggregateCache = new Map<string, Promise<SalesAggregate>>();

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

export interface WorkbenchDataPatch {
  funnelMetrics?: FunnelMetric[];
  processMetrics?: Partial<Record<DiagnosisDomain, ProcessMetric[]>>;
  ipProblemNegativeRates?: ProblemNegativeRate[];
  driveProblemNegativeRates?: ProblemNegativeRate[];
  dailyTrendData?: Partial<Record<DiagnosisDomain, DailyTrendData>>;
  diagnosis?: Partial<Record<DiagnosisDomain, DiagnosisDataset>>;
  sourceWarnings?: string[];
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
  problemRates: Array<{ name: string; rate: number | null }>;
  tags: WorkbenchData['diagnosis']['ip']['tags'];
  advisors: WorkbenchData['diagnosis']['ip']['advisors'];
  records: WorkbenchData['diagnosis']['ip']['records'];
}

interface DriveTagAggregate {
  totalEvents: number;
  negativeEvents: number;
  negativeRate: number | null;
  problemRates: Array<{ name: string; rate: number | null }>;
  tags: WorkbenchData['diagnosis']['drive']['tags'];
  advisors: WorkbenchData['diagnosis']['drive']['advisors'];
  records: WorkbenchData['diagnosis']['drive']['records'];
}

interface TrialOrderAggregate {
  trialCustomers: number;
  orderedCustomers: number;
  conversionRate: number | null;
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
  problemRates: Array<{ name: string; rate: number | null }>;
}

interface DailyDriveTagAggregate {
  date: string;
  negativeRate: number | null;
  problemRates: Array<{ name: string; rate: number | null }>;
}

interface TranscriptTurn {
  role: string;
  text: string;
}

interface ParsedTranscript {
  turns: TranscriptTurn[];
  status: 'ok' | 'empty' | 'parse-error';
}

interface EvidenceContext {
  turns: EvidenceTurn[];
  customerText: string;
  advisorText: string;
  status: EvidenceContextStatus;
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

function compareCountChange(current: number, previous: number): string {
  return comparePercent(current, previous).replace('月环比 ', '');
}

function comparePct(current: number | null, previous: number | null): string {
  if (current == null || previous == null) return '月环比 --';
  const diff = current - previous;
  return `月环比 ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
}

function compareUnit(current: number | null, previous: number | null, unit: string): string {
  if (current == null || previous == null) return '月环比 --';
  const diff = current - previous;
  return `月环比 ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}${unit}`;
}

function compareIpTagPct(current: number | null, previous: number | null): string {
  if (current == null || previous == null) return '--';
  return comparePct(current, previous).replace('月环比 ', '');
}

function compareRateDiff(current: number | null, previous: number | null): string {
  if (current == null || previous == null) return '--';
  return comparePct(current, previous).replace('月环比 ', '');
}

function addMonths(dateText: string, offset: number): string {
  const [year, month, day] = dateText.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(dateText: string, offset: number): string {
  const [year, month, day] = dateText.split('-').map(Number);
  const date = new Date(year, month - 1, day + offset);
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

function buildDateAxis(startDate: string, endDate: string): string[] {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  if ([startYear, startMonth, startDay, endYear, endMonth, endDay].some((value) => Number.isNaN(value))) {
    return [];
  }

  const axis: string[] = [];
  const cursor = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  while (cursor <= end) {
    axis.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`,
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return axis;
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

function getPeriodId(row: Record<string, string>): string {
  return String(row['周期编码'] || row['period_id'] || '').trim();
}

function aggregateTrialOrderRows(trialRows: Record<string, string>[], orderRows: Record<string, string>[]): TrialOrderAggregate {
  const trialDateByPeriod = new Map<string, string>();
  trialRows.forEach((row) => {
    const periodId = getPeriodId(row);
    if (!periodId) return;
    const trialDate = dateKey(row['试驾接待时间'] || row['试驾接待日期'] || row['trial_recv_time']);
    if (!trialDate) return;
    const existingDate = trialDateByPeriod.get(periodId);
    if (!existingDate || trialDate < existingDate) {
      trialDateByPeriod.set(periodId, trialDate);
    }
  });

  const orderedPeriods = new Set<string>();
  orderRows.forEach((row) => {
    const periodId = getPeriodId(row);
    const trialDate = trialDateByPeriod.get(periodId);
    if (!periodId || !trialDate) return;
    const orderDate = dateKey(row['order_create_time'] || row['订单创建/交现车日期'] || row['订单创建时间'] || row['核销时间']);
    if (orderDate && orderDate >= trialDate) {
      orderedPeriods.add(periodId);
    }
  });

  return {
    trialCustomers: trialDateByPeriod.size,
    orderedCustomers: orderedPeriods.size,
    conversionRate: percent(orderedPeriods.size, trialDateByPeriod.size),
  };
}

function cleanEvidenceText(value: string): string {
  return String(value || '').replace(/^\s*(客户|顾问|系统)\s*[：:]\s*/, '').trim();
}

function normalizeEvidenceText(value: string): string {
  return cleanEvidenceText(value)
    .replace(/[，。！？、,.!?:：；;\s"'“”‘’（）()【】\[\]-]/g, '')
    .toLowerCase();
}

function parsePlainTranscript(rawText: string): TranscriptTurn[] {
  const raw = String(rawText || '').trim();
  if (!raw) return [];
  const markerPattern = /(客户|顾问)\s*[：:]/g;
  const matches = [...raw.matchAll(markerPattern)];
  if (!matches.length) return [];

  return matches
    .map((match, index) => {
      const role = match[1];
      const textStart = (match.index || 0) + match[0].length;
      const textEnd = index + 1 < matches.length ? matches[index + 1].index || raw.length : raw.length;
      const text = raw
        .slice(textStart, textEnd)
        .replace(/^[\s；;，,。]+/, '')
        .replace(/[\s；;]+$/, '')
        .trim();
      return { role, text };
    })
    .filter((item) => item.text);
}

function parseTranscript(rawText: string): ParsedTranscript {
  const raw = String(rawText || '').trim();
  if (!raw) return { turns: [], status: 'empty' };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const plainTurns = parsePlainTranscript(raw);
      return plainTurns.length ? { turns: plainTurns, status: 'ok' } : { turns: [], status: 'parse-error' };
    }
    return {
      status: 'ok',
      turns: parsed
        .map((item) => {
          const role = String(item?.role || item?.additions?.role || '').trim();
          const text = String(item?.text || '').trim();
          return { role, text };
        })
        .filter((item) => item.text),
    };
  } catch {
    const plainTurns = parsePlainTranscript(raw);
    return plainTurns.length ? { turns: plainTurns, status: 'ok' } : { turns: [], status: 'parse-error' };
  }
}

function findEvidenceTurnIndex(turns: TranscriptTurn[], evidenceTexts: string[]): number {
  const anchors = evidenceTexts.map(normalizeEvidenceText).filter((item) => item.length >= 4);
  if (!anchors.length) return -1;
  return turns.findIndex((turn) => {
    const normalizedTurn = normalizeEvidenceText(turn.text);
    return anchors.some((anchor) => normalizedTurn.includes(anchor) || anchor.includes(normalizedTurn));
  });
}

function buildEvidenceContext(rawTranscript: string, evidenceTexts: string[]): EvidenceContext {
  const parsed = parseTranscript(rawTranscript);
  const turns = parsed.turns.filter((turn) => turn.role === '客户' || turn.role === '顾问');
  if (!turns.length) {
    return {
      turns: [],
      customerText: '',
      advisorText: '',
      status: parsed.status === 'parse-error' ? 'fallback-parse-error' : 'fallback-empty',
    };
  }

  const anchorIndex = findEvidenceTurnIndex(turns, evidenceTexts);
  if (anchorIndex < 0) return { turns: [], customerText: '', advisorText: '', status: 'fallback-no-anchor' };

  const contextTurns = turns.slice(anchorIndex, anchorIndex + 6);
  const evidenceTurns = contextTurns.map((turn) => ({
    speaker: turn.role as EvidenceTurn['speaker'],
    text: turn.text,
  }));
  const customerText = contextTurns
    .filter((turn) => turn.role === '客户')
    .map((turn) => turn.text)
    .join('\n');
  const advisorText = contextTurns
    .filter((turn) => turn.role === '顾问')
    .map((turn) => turn.text)
    .join('\n');

  return {
    turns: evidenceTurns,
    customerText,
    advisorText,
    status: 'expanded',
  };
}

function buildIpTagAggregate(rows: Record<string, string>[], options: { includeEvidenceContext?: boolean } = {}): IpTagAggregate {
  const calls = new Map<string, Record<string, string>[]>();
  const problemCalls = new Map<string, Map<string, boolean>>();
  rows.forEach((row) => {
    const callId = String(row['呼叫编码'] || '').trim();
    if (!callId) return;
    calls.set(callId, [...(calls.get(callId) || []), row]);

    const primaryTag = String(row['一级标签'] || '').trim();
    if (!primaryTag) return;
    const callMap = problemCalls.get(primaryTag) || new Map<string, boolean>();
    callMap.set(callId, Boolean(callMap.get(callId)) || row['标签正负向'] === '负向');
    problemCalls.set(primaryTag, callMap);
  });

  const negativeCalls = [...calls.values()].filter((callRows) => callRows.some((row) => row['标签正负向'] === '负向')).length;
  const primaryEventSets = new Map<string, Set<string>>();
  const secondaryEventSets = new Map<string, Map<string, Set<string>>>();
  const advisorCalls = new Map<string, Set<string>>();
  const records: DiagnosisRecord[] = [];

  [...calls.entries()].forEach(([callId, callRows]) => {
    const negativeRows = callRows.filter((row) => row['标签正负向'] === '负向');
    if (!negativeRows.length) return;

    const sortedRows = negativeRows
      .slice()
      .sort((left, right) => String(right['呼叫开始时间'] || '').localeCompare(String(left['呼叫开始时间'] || '')));
    const baseRow = sortedRows[0];
    const problemMap = new Map<string, DiagnosisProblem>();

    sortedRows.forEach((row) => {
      const primaryTag = String(row['一级标签'] || '').trim() || '未命中一级标签';
      const secondaryTag = String(row['二级标签'] || '').trim() || '未命中二级标签';
      const customerEvidence = String(row['证据原文-客户'] || '').trim();
      const advisorEvidence = String(row['证据原文-顾问'] || '').trim();
      const evidence = [customerEvidence && `客户：${customerEvidence}`, advisorEvidence && `顾问：${advisorEvidence}`].filter(Boolean).join('；') || String(row['证据原文-顾问'] || row['证据原文-客户'] || '').trim();
      const context = options.includeEvidenceContext
        ? buildEvidenceContext(String(row['通话原文'] || ''), [customerEvidence, advisorEvidence])
        : null;
      const problem: DiagnosisProblem = {
        primaryTag,
        secondaryTag,
        polarity: '负向',
        reason: String(row['命中原因'] || '').trim() || '该事件命中负向问题标签。',
        evidence,
        evidenceTurns: context?.turns,
        evidenceContextStatus: context?.status,
        customerOriginal: context?.customerText || customerEvidence,
        advisorOriginal: context?.advisorText || advisorEvidence,
        script: '结合命中原因复盘到店理由、到店时间锁定和客户顾虑承接。',
        confidence: toNumber(row['置信度']),
      };
      const problemKey = `${primaryTag}|${secondaryTag}`;
      const existing = problemMap.get(problemKey);
      if (!existing || (problem.confidence ?? 0) > (existing.confidence ?? 0) || problem.evidence.length > existing.evidence.length) {
        problemMap.set(problemKey, problem);
      }
    });

    const problems = [...problemMap.values()].sort((left, right) => `${left.primaryTag}${left.secondaryTag}`.localeCompare(`${right.primaryTag}${right.secondaryTag}`));
    const primaryTags = [...new Set(problems.map((problem) => problem.primaryTag))];
    primaryTags.forEach((primaryTag) => {
      const eventSet = primaryEventSets.get(primaryTag) || new Set<string>();
      eventSet.add(callId);
      primaryEventSets.set(primaryTag, eventSet);
    });
    problems.forEach((problem) => {
      const childMap = secondaryEventSets.get(problem.primaryTag) || new Map<string, Set<string>>();
      const eventSet = childMap.get(problem.secondaryTag) || new Set<string>();
      eventSet.add(callId);
      childMap.set(problem.secondaryTag, eventSet);
      secondaryEventSets.set(problem.primaryTag, childMap);
    });

    const advisorCode = String(baseRow['顾问编码'] || '').trim();
    const advisorName = String(baseRow['顾问名称'] || '').trim() || '未知顾问';
    const key = `${advisorCode || advisorName}|${advisorName}`;
    const callSet = advisorCalls.get(key) || new Set<string>();
    callSet.add(callId);
    advisorCalls.set(key, callSet);

    const summaryTags = primaryTags.slice(0, 3).join('、') || '负向问题';
    records.push({
      eventId: callId,
      customer: String(baseRow['客户名称:原则上所有周期的客户姓名一致,但当手机号更换了属主之后,会不一致'] || '').trim() || '未命名客户',
      advisor: advisorName,
      time: String(baseRow['呼叫开始时间'] || '').trim(),
      tag: primaryTags[0] || '负向邀约',
      primaryTag: primaryTags[0] || '未命中一级标签',
      secondaryTag: problems[0]?.secondaryTag || '未命中二级标签',
      primaryTags,
      problemCount: problems.length,
      problems,
      polarity: '负向',
      summary: `命中 ${problems.length} 个负向问题，主要集中在${summaryTags}${primaryTags.length > 3 ? '等' : ''}。`,
      evidence: problems[0]?.evidence || '',
      script: '结合命中问题逐项复盘邀约承接方式，优先处理高频一级问题。',
    });
  });

  const tags: DiagnosisTag[] = [...primaryEventSets.entries()]
    .map(([label, eventSet]) => {
      const children = secondaryEventSets.get(label) || new Map<string, Set<string>>();
      return {
        label,
        count: eventSet.size,
        percent: calls.size ? Math.round((eventSet.size / calls.size) * 100) : 0,
        children: [...children.entries()]
          .map(([childLabel, childEvents]) => ({ label: childLabel, count: childEvents.size }))
          .sort((left, right) => right.count - left.count),
      };
    })
    .sort((left, right) => right.count - left.count);

  const advisors = [...advisorCalls.entries()]
    .map(([key, callSet]) => ({ name: key.split('|')[1] || '未知顾问', count: callSet.size }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);
  const problemRates = [...problemCalls.entries()]
    .map(([name, callMap]) => {
      const callsForProblem = [...callMap.values()];
      const negativeForProblem = callsForProblem.filter(Boolean).length;
      return { name, rate: percent(negativeForProblem, calls.size) };
    })
    .sort((left, right) => (right.rate ?? -1) - (left.rate ?? -1));

  return {
    totalCalls: calls.size,
    negativeCalls,
    negativeRate: percent(negativeCalls, calls.size),
    problemRates,
    tags,
    advisors,
    records: records.sort((left, right) => right.time.localeCompare(left.time)),
  };
}

function buildDriveTagAggregate(rows: Record<string, string>[], options: { includeEvidenceContext?: boolean } = {}): DriveTagAggregate {
  const events = new Map<string, Record<string, string>[]>();
  rows.forEach((row) => {
    const eventId = String(row['试驾清单ID'] || '').trim();
    if (!eventId) return;
    events.set(eventId, [...(events.get(eventId) || []), row]);
  });

  const negativeEvents = [...events.values()].filter((eventRows) => eventRows.some((row) => row['标签正负向'] === '负向')).length;
  const primaryEventSets = new Map<string, Set<string>>();
  const secondaryEventSets = new Map<string, Map<string, Set<string>>>();
  const advisorEvents = new Map<string, Set<string>>();
  const records: DiagnosisRecord[] = [];

  [...events.entries()].forEach(([eventId, eventRows]) => {
    const negativeRows = eventRows.filter((row) => row['标签正负向'] === '负向');
    if (!negativeRows.length) return;

    const sortedRows = negativeRows
      .slice()
      .sort((left, right) => String(right['试驾接待时间'] || '').localeCompare(String(left['试驾接待时间'] || '')));
    const baseRow = sortedRows[0];
    const problemMap = new Map<string, DiagnosisProblem>();

    sortedRows.forEach((row) => {
      const primaryTag = String(row['一级标签'] || '').trim() || '未命中一级标签';
      const secondaryTag = String(row['二级标签'] || '').trim() || '未命中二级标签';
      const summaryEvidence = String(row['证据摘要'] || '').trim();
      const customerEvidence = String(row['客户原文'] || '').trim();
      const advisorEvidence = String(row['顾问原文'] || '').trim();
      const evidence = summaryEvidence || [customerEvidence && `客户：${customerEvidence}`, advisorEvidence && `顾问：${advisorEvidence}`].filter(Boolean).join('；');
      const context = options.includeEvidenceContext
        ? buildEvidenceContext(String(row['录音原文本'] || ''), [customerEvidence, advisorEvidence, summaryEvidence])
        : null;
      const problem: DiagnosisProblem = {
        primaryTag,
        secondaryTag,
        polarity: '负向',
        reason: String(row['命中原因'] || '').trim() || '该试驾事件命中负向接待问题标签。',
        evidence,
        evidenceTurns: context?.turns,
        evidenceContextStatus: context?.status,
        customerOriginal: context?.customerText || customerEvidence,
        advisorOriginal: context?.advisorText || advisorEvidence,
        script: '结合命中原因复盘试驾体验、顾虑承接、竞品攻防和后续推进话术。',
        confidence: toNumber(row['置信度']),
      };
      const problemKey = `${primaryTag}|${secondaryTag}`;
      const existing = problemMap.get(problemKey);
      if (!existing || (problem.confidence ?? 0) > (existing.confidence ?? 0) || problem.evidence.length > existing.evidence.length) {
        problemMap.set(problemKey, problem);
      }
    });

    const problems = [...problemMap.values()].sort((left, right) => `${left.primaryTag}${left.secondaryTag}`.localeCompare(`${right.primaryTag}${right.secondaryTag}`));
    const primaryTags = [...new Set(problems.map((problem) => problem.primaryTag))];
    primaryTags.forEach((primaryTag) => {
      const eventSet = primaryEventSets.get(primaryTag) || new Set<string>();
      eventSet.add(eventId);
      primaryEventSets.set(primaryTag, eventSet);
    });
    problems.forEach((problem) => {
      const childMap = secondaryEventSets.get(problem.primaryTag) || new Map<string, Set<string>>();
      const eventSet = childMap.get(problem.secondaryTag) || new Set<string>();
      eventSet.add(eventId);
      childMap.set(problem.secondaryTag, eventSet);
      secondaryEventSets.set(problem.primaryTag, childMap);
    });

    const advisorCode = String(baseRow['试驾接待顾问编码'] || '').trim();
    const advisorName = String(baseRow['试驾接待顾问名称'] || '').trim() || '未知顾问';
    const key = `${advisorCode || advisorName}|${advisorName}`;
    const eventSet = advisorEvents.get(key) || new Set<string>();
    eventSet.add(eventId);
    advisorEvents.set(key, eventSet);

    const summaryTags = primaryTags.slice(0, 3).join('、') || '负向问题';
    records.push({
      eventId,
      customer: String(baseRow['客户姓名'] || '').trim() || '未命名客户',
      advisor: advisorName,
      time: String(baseRow['试驾接待时间'] || '').trim(),
      tag: primaryTags[0] || '负向试驾接待',
      primaryTag: primaryTags[0] || '未命中一级标签',
      secondaryTag: problems[0]?.secondaryTag || '未命中二级标签',
      primaryTags,
      problemCount: problems.length,
      problems,
      polarity: '负向',
      summary: `命中 ${problems.length} 个负向问题，主要集中在${summaryTags}${primaryTags.length > 3 ? '等' : ''}。`,
      evidence: problems[0]?.evidence || '',
      script: '结合命中问题逐项复盘试驾接待承接方式，优先处理高频一级问题。',
    });
  });

  const tags: DiagnosisTag[] = [...primaryEventSets.entries()]
    .map(([label, eventSet]) => {
      const children = secondaryEventSets.get(label) || new Map<string, Set<string>>();
      return {
        label,
        count: eventSet.size,
        percent: events.size ? Math.round((eventSet.size / events.size) * 100) : 0,
        children: [...children.entries()]
          .map(([childLabel, childEvents]) => ({ label: childLabel, count: childEvents.size }))
          .sort((left, right) => right.count - left.count),
      };
    })
    .sort((left, right) => right.count - left.count);

  const advisors = [...advisorEvents.entries()]
    .map(([key, eventSet]) => ({ name: key.split('|')[1] || '未知顾问', count: eventSet.size }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);
  const problemRates = tags
    .map((tag) => ({ name: tag.label, rate: percent(tag.count, events.size) }))
    .sort((left, right) => (right.rate ?? -1) - (left.rate ?? -1));

  return {
    totalEvents: events.size,
    negativeEvents,
    negativeRate: percent(negativeEvents, events.size),
    problemRates,
    tags,
    advisors,
    records: records.sort((left, right) => right.time.localeCompare(left.time)),
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
  const cacheKey = `${filter.brand}|${filter.region}|${filter.district}|${filter.dealer}|${startDate}|${endDate}`;
  const cached = salesAggregateCache.get(cacheKey);
  if (cached) return cached;
  const request = fetchSalesUncached(filter, startDate, endDate).catch((error) => {
    salesAggregateCache.delete(cacheKey);
    throw error;
  });
  salesAggregateCache.set(cacheKey, request);
  return request;
}

async function fetchSalesUncached(filter: StoreFilter, startDate: string, endDate: string): Promise<SalesAggregate> {
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
  const rows = await fetchDccRows(dealerCode, brand, startDate, endDate);
  return aggregateDccRows(rows);
}

async function fetchDccRows(dealerCode: string, brand: string, startDate: string, endDate: string): Promise<Record<string, string>[]> {
  return previewDatasetRows(DCC_DS_ID, {
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
}

async function fetchDrive(dealerCode: string, startDate: string, endDate: string): Promise<DriveAggregate> {
  const rows = await fetchDriveRows(dealerCode, startDate, endDate);
  return aggregateDriveRows(rows);
}

async function fetchDriveRows(dealerCode: string, startDate: string, endDate: string): Promise<Record<string, string>[]> {
  return previewDatasetRows(DRIVE_DS_ID, {
    limit: 10000,
    filters: [
      { field: '试驾接待经销商代码', type: 'EQ', value: dealerCode },
      buildDateFilter('试驾接待日期', startDate, endDate),
      { field: '是否成功试驾', type: 'EQ', value: '是' },
    ],
  });
}

async function fetchOrderRowsForTrialOrder(dealerCode: string, brand: string, startDate: string, endDate: string): Promise<Record<string, string>[]> {
  return previewDatasetRows(ORDER_DS_ID, {
    limit: 60000,
    filters: [
      { field: '订单经销商代码', type: 'EQ', value: dealerCode },
      { field: '品牌名称', type: 'EQ', value: getBrandName(brand) },
      buildDateTimeFilter('订单创建时间', startDate, endDate),
      { field: '是否当天订当天退', type: 'EQ', value: '0' },
    ],
  });
}

async function fetchTrialOrder(dealerCode: string, brand: string, startDate: string, endDate: string): Promise<TrialOrderAggregate> {
  const [trialRows, orderRows] = await Promise.all([
    fetchDriveRows(dealerCode, startDate, endDate),
    fetchOrderRowsForTrialOrder(dealerCode, brand, startDate, endDate),
  ]);

  return aggregateTrialOrderRows(trialRows, orderRows);
}

async function fetchIpTags(dealerCode: string, brand: string, startDate: string, endDate: string): Promise<IpTagAggregate> {
  const rows = await fetchIpTagRows(dealerCode, brand, startDate, endDate);
  return buildIpTagAggregate(rows, { includeEvidenceContext: true });
}

async function fetchIpTagRows(dealerCode: string, brand: string, startDate: string, endDate: string): Promise<Record<string, string>[]> {
  return previewDatasetRows(IP_TAG_DS_ID, {
    limit: 60000,
    filters: [
      { field: '经销商代码', type: 'EQ', value: dealerCode },
      buildDateTimeFilter('呼叫开始时间', startDate, endDate),
      { field: '品牌名称', type: 'EQ', value: getBrandName(brand) },
    ],
  });
}

async function fetchDriveTags(dealerCode: string, brand: string, startDate: string, endDate: string): Promise<DriveTagAggregate> {
  const rows = await fetchDriveTagRows(dealerCode, brand, startDate, endDate);
  return buildDriveTagAggregate(rows, { includeEvidenceContext: true });
}

async function fetchDriveTagRows(dealerCode: string, brand: string, startDate: string, endDate: string): Promise<Record<string, string>[]> {
  return previewDatasetRows(DRIVE_TAG_DS_ID, {
    limit: 60000,
    filters: [
      { field: '经销商代码', type: 'EQ', value: dealerCode },
      buildDateTimeFilter('试驾接待时间', startDate, endDate),
      { field: '品牌名称', type: 'EQ', value: getBrandName(brand) },
    ],
  });
}

async function fetchDccDailyTrend(dealerCode: string, brand: string, startDate: string, endDate: string): Promise<DailyDccAggregate[]> {
  const rows = await fetchDccRows(dealerCode, brand, startDate, endDate);
  return buildDccDailyTrendFromRows(rows);
}

function buildDccDailyTrendFromRows(rows: Record<string, string>[]): DailyDccAggregate[] {
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
  const rows = await fetchDriveRows(dealerCode, startDate, endDate);
  return buildDriveDailyTrendFromRows(rows);
}

function buildDriveDailyTrendFromRows(rows: Record<string, string>[]): DailyDriveAggregate[] {
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
  const rows = await fetchIpTagRows(dealerCode, brand, startDate, endDate);
  return buildIpTagDailyTrendFromRows(rows);
}

function buildIpTagDailyTrendFromRows(rows: Record<string, string>[]): DailyIpTagAggregate[] {
  const grouped = new Map<string, Record<string, string>[]>();
  rows.forEach((row) => {
    const date = dateKey(row['呼叫开始时间']);
    if (!date) return;
    grouped.set(date, [...(grouped.get(date) || []), row]);
  });
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dayRows]) => {
      const aggregate = buildIpTagAggregate(dayRows);
      return { date, negativeRate: aggregate.negativeRate, problemRates: aggregate.problemRates };
    });
}

async function fetchDriveTagDailyTrend(dealerCode: string, brand: string, startDate: string, endDate: string): Promise<DailyDriveTagAggregate[]> {
  const rows = await fetchDriveTagRows(dealerCode, brand, startDate, endDate);
  return buildDriveTagDailyTrendFromRows(rows);
}

function buildDriveTagDailyTrendFromRows(rows: Record<string, string>[]): DailyDriveTagAggregate[] {
  const grouped = new Map<string, Record<string, string>[]>();
  rows.forEach((row) => {
    const date = dateKey(row['试驾接待时间']);
    if (!date) return;
    grouped.set(date, [...(grouped.get(date) || []), row]);
  });
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dayRows]) => {
      const aggregate = buildDriveTagAggregate(dayRows);
      return { date, negativeRate: aggregate.negativeRate, problemRates: aggregate.problemRates };
    });
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
  previousWeekIpTags: IpTagAggregate,
  currentDriveTags: DriveTagAggregate,
  prevDriveTags: DriveTagAggregate,
  previousWeekDriveTags: DriveTagAggregate,
  currentTrialOrder: TrialOrderAggregate,
  prevTrialOrder: TrialOrderAggregate,
  previousWeekTrialOrder: TrialOrderAggregate,
): Record<DiagnosisDomain, ProcessMetric[]> {
  return {
    ip: [
      { label: '打标电话数', value: formatInteger(currentIpTags.totalCalls), wow: compareCountChange(currentIpTags.totalCalls, previousWeekIpTags.totalCalls), mom: compareCountChange(currentIpTags.totalCalls, prevIpTags.totalCalls), trend: trend(currentIpTags.totalCalls, previousWeekIpTags.totalCalls), source: 'guandata' },
      { label: '线索接通率', value: `${formatPercent(currentDcc.connectRate)}%`, mom: comparePct(currentDcc.connectRate, prevDcc.connectRate).replace('月环比 ', ''), trend: trend(currentDcc.connectRate, prevDcc.connectRate), source: 'guandata' },
      { label: '30s以下线索占比', value: `${formatPercent(currentDcc.shortCallRate)}%`, mom: comparePct(currentDcc.shortCallRate, prevDcc.shortCallRate).replace('月环比 ', ''), trend: trend(currentDcc.shortCallRate, prevDcc.shortCallRate), source: 'guandata' },
      { label: '30分钟外呼率', value: `${formatPercent(currentDcc.outbound30Rate)}%`, mom: comparePct(currentDcc.outbound30Rate, prevDcc.outbound30Rate).replace('月环比 ', ''), trend: trend(currentDcc.outbound30Rate, prevDcc.outbound30Rate), source: 'guandata' },
      { label: '2天3呼率', value: `${formatPercent(currentDcc.twoDayThreeCallRate)}%`, mom: comparePct(currentDcc.twoDayThreeCallRate, prevDcc.twoDayThreeCallRate).replace('月环比 ', ''), trend: trend(currentDcc.twoDayThreeCallRate, prevDcc.twoDayThreeCallRate), source: 'guandata' },
      { label: '负向邀约占比', value: `${formatPercent(currentIpTags.negativeRate)}%`, wow: compareIpTagPct(currentIpTags.negativeRate, previousWeekIpTags.negativeRate), mom: compareIpTagPct(currentIpTags.negativeRate, prevIpTags.negativeRate), trend: trend(currentIpTags.negativeRate, previousWeekIpTags.negativeRate), source: 'guandata' },
    ],
    drive: [
      { label: '试驾平均里程', value: formatMetricValue(currentDrive.avgMileage, 'km'), mom: compareUnit(currentDrive.avgMileage, prevDrive.avgMileage, 'km').replace('月环比 ', ''), trend: trend(currentDrive.avgMileage, prevDrive.avgMileage), source: 'guandata' },
      { label: '平均时长', value: formatMetricValue(currentDrive.avgDuration, 'min'), mom: compareUnit(currentDrive.avgDuration, prevDrive.avgDuration, 'min').replace('月环比 ', ''), trend: trend(currentDrive.avgDuration, prevDrive.avgDuration), source: 'guandata' },
      { label: '打标试驾数', value: formatInteger(currentDriveTags.totalEvents), wow: compareCountChange(currentDriveTags.totalEvents, previousWeekDriveTags.totalEvents), mom: compareCountChange(currentDriveTags.totalEvents, prevDriveTags.totalEvents), trend: trend(currentDriveTags.totalEvents, previousWeekDriveTags.totalEvents), source: 'guandata' },
      { label: '试驾后转订率', value: `${formatPercent(currentTrialOrder.conversionRate)}%`, wow: compareRateDiff(currentTrialOrder.conversionRate, previousWeekTrialOrder.conversionRate), mom: compareRateDiff(currentTrialOrder.conversionRate, prevTrialOrder.conversionRate), trend: trend(currentTrialOrder.conversionRate, previousWeekTrialOrder.conversionRate), source: 'guandata' },
      { label: '负向试驾接待占比', value: `${formatPercent(currentDriveTags.negativeRate)}%`, wow: compareIpTagPct(currentDriveTags.negativeRate, previousWeekDriveTags.negativeRate), mom: compareIpTagPct(currentDriveTags.negativeRate, prevDriveTags.negativeRate), trend: trend(currentDriveTags.negativeRate, previousWeekDriveTags.negativeRate), source: 'guandata' },
    ],
  };
}

function buildProblemNegativeRates(
  current: Pick<IpTagAggregate | DriveTagAggregate, 'problemRates'>,
  previousWeek: Pick<IpTagAggregate | DriveTagAggregate, 'problemRates'>,
  previousMonth: Pick<IpTagAggregate | DriveTagAggregate, 'problemRates'>,
): ProblemNegativeRate[] {
  const previousWeekByName = new Map(previousWeek.problemRates.map((item) => [item.name, item.rate]));
  const previousMonthByName = new Map(previousMonth.problemRates.map((item) => [item.name, item.rate]));
  return current.problemRates.map((item) => {
    const previousWeekRate = previousWeekByName.get(item.name) ?? null;
    const previousMonthRate = previousMonthByName.get(item.name) ?? null;
    const weekDiff = item.rate != null && previousWeekRate != null ? item.rate - previousWeekRate : null;
    const monthDiff = item.rate != null && previousMonthRate != null ? item.rate - previousMonthRate : null;
    return {
      name: item.name,
      current: item.rate == null ? '--' : `${item.rate.toFixed(1)}%`,
      previous: previousWeekRate == null ? '--' : `${previousWeekRate.toFixed(1)}%`,
      delta: weekDiff == null ? '--' : `${weekDiff >= 0 ? '+' : ''}${weekDiff.toFixed(1)}%`,
      monthDelta: monthDiff == null ? '--' : `${monthDiff >= 0 ? '+' : ''}${monthDiff.toFixed(1)}%`,
      status: weekDiff == null || weekDiff === 0 ? '持平' : weekDiff > 0 ? '恶化' : '改善',
    };
  });
}

function buildIpProblemNegativeRates(current: IpTagAggregate, previousWeek: IpTagAggregate, previousMonth: IpTagAggregate): ProblemNegativeRate[] {
  return buildProblemNegativeRates(current, previousWeek, previousMonth);
}

function buildDriveProblemNegativeRates(current: DriveTagAggregate, previousWeek: DriveTagAggregate, previousMonth: DriveTagAggregate): ProblemNegativeRate[] {
  return buildProblemNegativeRates(current, previousWeek, previousMonth);
}

function buildEmptyTrend(domain: DiagnosisDomain): DailyTrendData {
  return {
    eyebrow: DOMAIN_TREND_META[domain].eyebrow,
    title: `${DOMAIN_TREND_META[domain].eyebrow}日趋势`,
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
  drive: { eyebrow: '试驾', ySuffix: '%' },
};

function withoutMockNegativeTrendData(trendData: Record<DiagnosisDomain, DailyTrendData>): Record<DiagnosisDomain, DailyTrendData> {
  return {
    ip: { ...trendData.ip, series: trendData.ip.series.filter((series) => !series.name.includes('负向')) },
    drive: { ...trendData.drive, series: trendData.drive.series.filter((series) => !series.name.includes('负向')) },
  };
}

function buildProblemTrendSeries(
  rows: Array<{ date: string; problemRates: Array<{ name: string; rate: number | null }> }>,
  colors: string[],
  dateAxis?: string[],
): { days: string[]; series: DailyTrendData['series'] } {
  const trendDates = dateAxis?.length ? dateAxis : [...new Set(rows.map((row) => row.date))].sort();
  const labelTotals = new Map<string, number>();
  rows.forEach((row) => {
    row.problemRates.forEach((item) => {
      if (item.rate == null) return;
      labelTotals.set(item.name, (labelTotals.get(item.name) || 0) + item.rate);
    });
  });
  const labels = [...labelTotals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([name]) => name);
  const ratesByDate = new Map(rows.map((row) => [row.date, new Map(row.problemRates.map((item) => [item.name, item.rate ?? 0]))]));
  return {
    days: trendDates.map((date) => formatTrendDay(date)),
    series: labels.map((label, index) => ({
      name: label,
      color: colors[index % colors.length],
      values: trendDates.map((date) => ratesByDate.get(date)?.get(label) ?? 0),
    })),
  };
}

function buildDailyTrendData(dccRows: DailyDccAggregate[], driveRows: DailyDriveAggregate[], ipTagRows: DailyIpTagAggregate[], driveTagRows: DailyDriveTagAggregate[], dateAxis?: string[]): Record<DiagnosisDomain, DailyTrendData> {
  const ipProblemTrend = buildProblemTrendSeries(ipTagRows, ['#316bff', '#19a56f', '#f59e0b'], dateAxis);
  const driveProblemTrend = buildProblemTrendSeries(driveTagRows, ['#316bff', '#19a56f', '#f59e0b'], dateAxis);
  return {
    ip: {
      ...buildEmptyTrend('ip'),
      days: ipProblemTrend.days,
      series: ipProblemTrend.series,
    },
    drive: {
      ...buildEmptyTrend('drive'),
      days: driveProblemTrend.days,
      series: driveProblemTrend.series,
    },
  };
}

function buildPendingProcessMetrics(): Record<DiagnosisDomain, ProcessMetric[]> {
  return {
    ip: mockWorkbenchData.processMetrics.ip.map((item) => ({ ...item, value: '--', wow: '--', mom: '--', trend: 'down', source: 'mock' })),
    drive: mockWorkbenchData.processMetrics.drive.map((item) => ({ ...item, value: '--', wow: '--', mom: '--', trend: 'down', source: 'mock' })),
  };
}

function buildEmptyProblemNegativeRates(items: ProblemNegativeRate[]): ProblemNegativeRate[] {
  return items.map((item) => ({
    ...item,
    current: '--',
    previous: '--',
    delta: '--',
    monthDelta: '--',
    status: '持平',
  }));
}

function buildPendingFunnelMetrics(): FunnelMetric[] {
  return mockWorkbenchData.funnelMetrics.map((item) => ({
    ...item,
    value: '--',
    compare: '月环比 --',
    trend: 'down',
    rank: item.rank == null ? undefined : '--',
  }));
}

export function buildWorkbenchPlaceholderData(): WorkbenchData {
  return {
    ...mockWorkbenchData,
    funnelMetrics: buildPendingFunnelMetrics(),
    processMetrics: buildPendingProcessMetrics(),
    ipProblemNegativeRates: buildEmptyProblemNegativeRates(mockWorkbenchData.ipProblemNegativeRates),
    driveProblemNegativeRates: buildEmptyProblemNegativeRates(mockWorkbenchData.driveProblemNegativeRates),
    dailyTrendData: {
      ip: buildEmptyTrend('ip'),
      drive: buildEmptyTrend('drive'),
    },
    diagnosis: {
      ip: { ...mockWorkbenchData.diagnosis.ip, sourceStatus: 'pending', sourceNote: '明细数据正在后台读取，完成后自动更新。', tags: [], advisors: [], records: [] },
      drive: { ...mockWorkbenchData.diagnosis.drive, sourceStatus: 'pending', sourceNote: '明细数据正在后台读取，完成后自动更新。', tags: [], advisors: [], records: [] },
    },
    dataMode: 'hybrid',
    sourceWarnings: [],
  };
}

export function buildWorkbenchMockData(): WorkbenchData {
  return {
    ...mockWorkbenchData,
    diagnosis: {
      ip: { ...mockWorkbenchData.diagnosis.ip, sourceStatus: 'confirmed', sourceNote: '本地 mock 验收模式：使用内置邀约明细、趋势和抽屉样例，不读取线上数据。' },
      drive: { ...mockWorkbenchData.diagnosis.drive, sourceStatus: 'confirmed', sourceNote: '本地 mock 验收模式：使用内置试驾明细、趋势和抽屉样例，不读取线上数据。' },
    },
    dataMode: 'mock',
    sourceWarnings: [],
  };
}

export async function loadWorkbenchInitialData(filter: StoreFilter): Promise<WorkbenchData> {
  const currentSales = await fetchSales(filter, filter.startDate, filter.endDate);
  const pendingPreviousSales: SalesAggregate = {
    ...currentSales,
    assignedLeads: 0,
    arrivals: 0,
    testDrives: 0,
    orders: 0,
  };

  return {
    ...buildWorkbenchPlaceholderData(),
    funnelMetrics: buildFunnel(currentSales, pendingPreviousSales, {}),
  };
}

export async function loadFunnelDataPatch(filter: StoreFilter): Promise<WorkbenchDataPatch> {
  const warnings: string[] = [];
  const previousStart = addMonths(filter.startDate, -1);
  const previousEnd = addMonths(filter.endDate, -1);
  const currentSales = await fetchSales(filter, filter.startDate, filter.endDate);
  const [previousSales, ranks] = await Promise.all([
    fetchSales(filter, previousStart, previousEnd).catch((error) => {
      warnings.push(`销售漏斗上月同期读取失败：${error instanceof Error ? error.message : String(error)}`);
      return { ...currentSales, assignedLeads: 0, arrivals: 0, testDrives: 0, orders: 0 };
    }),
    fetchRanks(currentSales.dealerCode, filter.startDate, filter.endDate).catch((error) => {
      warnings.push(`官方排名分位读取失败：${error instanceof Error ? error.message : String(error)}`);
      return {};
    }),
  ]);
  return {
    funnelMetrics: buildFunnel(currentSales, previousSales, ranks),
    sourceWarnings: warnings,
  };
}

export async function loadIpDataPatch(filter: StoreFilter): Promise<WorkbenchDataPatch> {
  const warnings: string[] = [];
  const previousStart = addMonths(filter.startDate, -1);
  const previousEnd = addMonths(filter.endDate, -1);
  const previousWeekStart = addDays(filter.startDate, -7);
  const previousWeekEnd = addDays(filter.endDate, -7);
  const currentSales = await fetchSales(filter, filter.startDate, filter.endDate);
  const emptyIpTags: IpTagAggregate = {
    totalCalls: 0,
    negativeCalls: 0,
    negativeRate: null,
    problemRates: [],
    tags: [],
    advisors: [],
    records: [],
  };
  const [currentDccRows, prevDccRows, currentIpTagRows, prevIpTagRows, previousWeekIpTagRows] = await Promise.all([
    fetchDccRows(currentSales.dealerCode, filter.brand, filter.startDate, filter.endDate),
    fetchDccRows(currentSales.dealerCode, filter.brand, previousStart, previousEnd).catch((error) => {
      warnings.push(`DCC 上月同期读取失败：${error instanceof Error ? error.message : String(error)}`);
      return [];
    }),
    fetchIpTagRows(currentSales.dealerCode, filter.brand, filter.startDate, filter.endDate),
    fetchIpTagRows(currentSales.dealerCode, filter.brand, previousStart, previousEnd).catch(() => []),
    fetchIpTagRows(currentSales.dealerCode, filter.brand, previousWeekStart, previousWeekEnd).catch((error) => {
      warnings.push(`IP 打标上周同期读取失败：${error instanceof Error ? error.message : String(error)}`);
      return [];
    }),
  ]);
  const currentDcc = aggregateDccRows(currentDccRows);
  const prevDcc = aggregateDccRows(prevDccRows);
  const currentIpTags = currentIpTagRows.length ? buildIpTagAggregate(currentIpTagRows, { includeEvidenceContext: true }) : emptyIpTags;
  const prevIpTags = prevIpTagRows.length ? buildIpTagAggregate(prevIpTagRows) : emptyIpTags;
  const previousWeekIpTags = previousWeekIpTagRows.length ? buildIpTagAggregate(previousWeekIpTagRows) : emptyIpTags;
  const ipMetrics: ProcessMetric[] = [
    { label: '打标电话数', value: formatInteger(currentIpTags.totalCalls), wow: compareCountChange(currentIpTags.totalCalls, previousWeekIpTags.totalCalls), mom: compareCountChange(currentIpTags.totalCalls, prevIpTags.totalCalls), trend: trend(currentIpTags.totalCalls, previousWeekIpTags.totalCalls), source: 'guandata' },
    { label: '线索接通率', value: `${formatPercent(currentDcc.connectRate)}%`, mom: comparePct(currentDcc.connectRate, prevDcc.connectRate).replace('月环比 ', ''), trend: trend(currentDcc.connectRate, prevDcc.connectRate), source: 'guandata' },
    { label: '30s以下线索占比', value: `${formatPercent(currentDcc.shortCallRate)}%`, mom: comparePct(currentDcc.shortCallRate, prevDcc.shortCallRate).replace('月环比 ', ''), trend: trend(currentDcc.shortCallRate, prevDcc.shortCallRate), source: 'guandata' },
    { label: '30分钟外呼率', value: `${formatPercent(currentDcc.outbound30Rate)}%`, mom: comparePct(currentDcc.outbound30Rate, prevDcc.outbound30Rate).replace('月环比 ', ''), trend: trend(currentDcc.outbound30Rate, prevDcc.outbound30Rate), source: 'guandata' },
    { label: '2天3呼率', value: `${formatPercent(currentDcc.twoDayThreeCallRate)}%`, mom: comparePct(currentDcc.twoDayThreeCallRate, prevDcc.twoDayThreeCallRate).replace('月环比 ', ''), trend: trend(currentDcc.twoDayThreeCallRate, prevDcc.twoDayThreeCallRate), source: 'guandata' },
    { label: '负向邀约占比', value: `${formatPercent(currentIpTags.negativeRate)}%`, wow: compareIpTagPct(currentIpTags.negativeRate, previousWeekIpTags.negativeRate), mom: compareIpTagPct(currentIpTags.negativeRate, prevIpTags.negativeRate), trend: trend(currentIpTags.negativeRate, previousWeekIpTags.negativeRate), source: 'guandata' },
  ];
  return {
    processMetrics: { ip: ipMetrics },
    ipProblemNegativeRates: buildIpProblemNegativeRates(currentIpTags, previousWeekIpTags, prevIpTags),
    dailyTrendData: { ip: buildDailyTrendData(buildDccDailyTrendFromRows(currentDccRows), [], buildIpTagDailyTrendFromRows(currentIpTagRows), [], buildDateAxis(filter.startDate, filter.endDate)).ip },
    diagnosis: {
      ip: {
        name: 'IP 电话',
        sourceStatus: 'confirmed',
        sourceNote: `已接入观远 IP 电话邀约问题诊断明细表，当前筛选范围 ${currentIpTags.totalCalls} 通电话，负向 ${currentIpTags.negativeCalls} 通。`,
        tags: currentIpTags.tags,
        advisors: currentIpTags.advisors,
        records: currentIpTags.records,
      },
    },
    sourceWarnings: warnings,
  };
}

export async function loadDriveBaseDataPatch(filter: StoreFilter): Promise<WorkbenchDataPatch> {
  const warnings: string[] = [];
  const previousStart = addMonths(filter.startDate, -1);
  const previousEnd = addMonths(filter.endDate, -1);
  const previousWeekStart = addDays(filter.startDate, -7);
  const previousWeekEnd = addDays(filter.endDate, -7);
  const currentSales = await fetchSales(filter, filter.startDate, filter.endDate);
  const emptyDriveTags: DriveTagAggregate = {
    totalEvents: 0,
    negativeEvents: 0,
    negativeRate: null,
    problemRates: [],
    tags: [],
    advisors: [],
    records: [],
  };
  const [currentDriveRows, prevDriveRows, currentDriveTagRows, prevDriveTagRows, previousWeekDriveTagRows] = await Promise.all([
    fetchDriveRows(currentSales.dealerCode, filter.startDate, filter.endDate),
    fetchDriveRows(currentSales.dealerCode, previousStart, previousEnd).catch((error) => {
      warnings.push(`试驾上月同期读取失败：${error instanceof Error ? error.message : String(error)}`);
      return [];
    }),
    fetchDriveTagRows(currentSales.dealerCode, filter.brand, filter.startDate, filter.endDate),
    fetchDriveTagRows(currentSales.dealerCode, filter.brand, previousStart, previousEnd).catch(() => []),
    fetchDriveTagRows(currentSales.dealerCode, filter.brand, previousWeekStart, previousWeekEnd).catch((error) => {
      warnings.push(`试驾打标上周同期读取失败：${error instanceof Error ? error.message : String(error)}`);
      return [];
    }),
  ]);
  const currentDrive = aggregateDriveRows(currentDriveRows);
  const prevDrive = aggregateDriveRows(prevDriveRows);
  const currentDriveTags = currentDriveTagRows.length ? buildDriveTagAggregate(currentDriveTagRows, { includeEvidenceContext: true }) : emptyDriveTags;
  const prevDriveTags = prevDriveTagRows.length ? buildDriveTagAggregate(prevDriveTagRows) : emptyDriveTags;
  const previousWeekDriveTags = previousWeekDriveTagRows.length ? buildDriveTagAggregate(previousWeekDriveTagRows) : emptyDriveTags;
  const driveMetrics: ProcessMetric[] = [
    { label: '试驾平均里程', value: formatMetricValue(currentDrive.avgMileage, 'km'), mom: compareUnit(currentDrive.avgMileage, prevDrive.avgMileage, 'km').replace('月环比 ', ''), trend: trend(currentDrive.avgMileage, prevDrive.avgMileage), source: 'guandata' },
    { label: '平均时长', value: formatMetricValue(currentDrive.avgDuration, 'min'), mom: compareUnit(currentDrive.avgDuration, prevDrive.avgDuration, 'min').replace('月环比 ', ''), trend: trend(currentDrive.avgDuration, prevDrive.avgDuration), source: 'guandata' },
    { label: '打标试驾数', value: formatInteger(currentDriveTags.totalEvents), wow: compareCountChange(currentDriveTags.totalEvents, previousWeekDriveTags.totalEvents), mom: compareCountChange(currentDriveTags.totalEvents, prevDriveTags.totalEvents), trend: trend(currentDriveTags.totalEvents, previousWeekDriveTags.totalEvents), source: 'guandata' },
    { label: '负向试驾接待占比', value: `${formatPercent(currentDriveTags.negativeRate)}%`, wow: compareIpTagPct(currentDriveTags.negativeRate, previousWeekDriveTags.negativeRate), mom: compareIpTagPct(currentDriveTags.negativeRate, prevDriveTags.negativeRate), trend: trend(currentDriveTags.negativeRate, previousWeekDriveTags.negativeRate), source: 'guandata' },
  ];
  return {
    processMetrics: { drive: driveMetrics },
    driveProblemNegativeRates: buildDriveProblemNegativeRates(currentDriveTags, previousWeekDriveTags, prevDriveTags),
    dailyTrendData: { drive: buildDailyTrendData([], buildDriveDailyTrendFromRows(currentDriveRows), [], buildDriveTagDailyTrendFromRows(currentDriveTagRows), buildDateAxis(filter.startDate, filter.endDate)).drive },
    diagnosis: {
      drive: {
        name: '试驾接待',
        sourceStatus: 'confirmed',
        sourceNote: `已接入观远试驾接待问题诊断明细表，当前筛选范围 ${currentDriveTags.totalEvents} 次试驾，负向 ${currentDriveTags.negativeEvents} 次。`,
        tags: currentDriveTags.tags,
        advisors: currentDriveTags.advisors,
        records: currentDriveTags.records,
      },
    },
    sourceWarnings: warnings,
  };
}

export async function loadTrialOrderDataPatch(filter: StoreFilter): Promise<WorkbenchDataPatch> {
  const warnings: string[] = [];
  const previousStart = addMonths(filter.startDate, -1);
  const previousEnd = addMonths(filter.endDate, -1);
  const previousWeekStart = addDays(filter.startDate, -7);
  const previousWeekEnd = addDays(filter.endDate, -7);
  const currentSales = await fetchSales(filter, filter.startDate, filter.endDate);
  const emptyTrialOrder: TrialOrderAggregate = {
    trialCustomers: 0,
    orderedCustomers: 0,
    conversionRate: null,
  };
  const [currentDriveRows, prevDriveRows, previousWeekDriveRows, currentOrderRows, prevOrderRows, previousWeekOrderRows] = await Promise.all([
    fetchDriveRows(currentSales.dealerCode, filter.startDate, filter.endDate),
    fetchDriveRows(currentSales.dealerCode, previousStart, previousEnd).catch(() => []),
    fetchDriveRows(currentSales.dealerCode, previousWeekStart, previousWeekEnd).catch(() => []),
    fetchOrderRowsForTrialOrder(currentSales.dealerCode, filter.brand, filter.startDate, filter.endDate).catch((error) => {
      warnings.push(`试驾后转订率读取失败：${error instanceof Error ? error.message : String(error)}`);
      return null;
    }),
    fetchOrderRowsForTrialOrder(currentSales.dealerCode, filter.brand, previousStart, previousEnd).catch((error) => {
      warnings.push(`试驾后转订率上月同期读取失败：${error instanceof Error ? error.message : String(error)}`);
      return null;
    }),
    fetchOrderRowsForTrialOrder(currentSales.dealerCode, filter.brand, previousWeekStart, previousWeekEnd).catch((error) => {
      warnings.push(`试驾后转订率上周同期读取失败：${error instanceof Error ? error.message : String(error)}`);
      return null;
    }),
  ]);
  const currentTrialOrder = currentOrderRows ? aggregateTrialOrderRows(currentDriveRows, currentOrderRows) : emptyTrialOrder;
  const prevTrialOrder = prevOrderRows ? aggregateTrialOrderRows(prevDriveRows, prevOrderRows) : emptyTrialOrder;
  const previousWeekTrialOrder = previousWeekOrderRows ? aggregateTrialOrderRows(previousWeekDriveRows, previousWeekOrderRows) : emptyTrialOrder;
  return {
    processMetrics: {
      drive: [
        { label: '试驾后转订率', value: `${formatPercent(currentTrialOrder.conversionRate)}%`, wow: compareRateDiff(currentTrialOrder.conversionRate, previousWeekTrialOrder.conversionRate), mom: compareRateDiff(currentTrialOrder.conversionRate, prevTrialOrder.conversionRate), trend: trend(currentTrialOrder.conversionRate, previousWeekTrialOrder.conversionRate), source: 'guandata' },
      ],
    },
    sourceWarnings: warnings,
  };
}

export async function loadWorkbenchData(filter: StoreFilter): Promise<WorkbenchData> {
  const warnings: string[] = [];
  const previousStart = addMonths(filter.startDate, -1);
  const previousEnd = addMonths(filter.endDate, -1);
  const previousWeekStart = addDays(filter.startDate, -7);
  const previousWeekEnd = addDays(filter.endDate, -7);

  try {
    const currentSales = await fetchSales(filter, filter.startDate, filter.endDate);
    const previousSales = await fetchSales(filter, previousStart, previousEnd).catch((error) => {
      warnings.push(`销售漏斗上月同期读取失败：${error instanceof Error ? error.message : String(error)}`);
      return { ...currentSales, assignedLeads: 0, arrivals: 0, testDrives: 0, orders: 0 };
    });
    const emptyIpTags: IpTagAggregate = {
      totalCalls: 0,
      negativeCalls: 0,
      negativeRate: null,
      problemRates: [],
      tags: [],
      advisors: [],
      records: [],
    };
    const emptyDriveTags: DriveTagAggregate = {
      totalEvents: 0,
      negativeEvents: 0,
      negativeRate: null,
      problemRates: [],
      tags: [],
      advisors: [],
      records: [],
    };
    const emptyTrialOrder: TrialOrderAggregate = {
      trialCustomers: 0,
      orderedCustomers: 0,
      conversionRate: null,
    };
    const [currentDccRows, prevDccRows, currentDriveRows, prevDriveRows, previousWeekDriveRows, currentIpTagRows, prevIpTagRows, previousWeekIpTagRows, currentDriveTagRows, prevDriveTagRows, previousWeekDriveTagRows, currentOrderRows, prevOrderRows, previousWeekOrderRows, ranks] = await Promise.all([
      fetchDccRows(currentSales.dealerCode, filter.brand, filter.startDate, filter.endDate),
      fetchDccRows(currentSales.dealerCode, filter.brand, previousStart, previousEnd).catch((error) => {
        warnings.push(`DCC 上月同期读取失败：${error instanceof Error ? error.message : String(error)}`);
        return [];
      }),
      fetchDriveRows(currentSales.dealerCode, filter.startDate, filter.endDate),
      fetchDriveRows(currentSales.dealerCode, previousStart, previousEnd).catch((error) => {
        warnings.push(`试驾上月同期读取失败：${error instanceof Error ? error.message : String(error)}`);
        return [];
      }),
      fetchDriveRows(currentSales.dealerCode, previousWeekStart, previousWeekEnd).catch((error) => {
        warnings.push(`试驾上周同期读取失败：${error instanceof Error ? error.message : String(error)}`);
        return [];
      }),
      fetchIpTagRows(currentSales.dealerCode, filter.brand, filter.startDate, filter.endDate),
      fetchIpTagRows(currentSales.dealerCode, filter.brand, previousStart, previousEnd).catch(() => []),
      fetchIpTagRows(currentSales.dealerCode, filter.brand, previousWeekStart, previousWeekEnd).catch((error) => {
        warnings.push(`IP 打标上周同期读取失败：${error instanceof Error ? error.message : String(error)}`);
        return [];
      }),
      fetchDriveTagRows(currentSales.dealerCode, filter.brand, filter.startDate, filter.endDate),
      fetchDriveTagRows(currentSales.dealerCode, filter.brand, previousStart, previousEnd).catch(() => []),
      fetchDriveTagRows(currentSales.dealerCode, filter.brand, previousWeekStart, previousWeekEnd).catch((error) => {
        warnings.push(`试驾打标上周同期读取失败：${error instanceof Error ? error.message : String(error)}`);
        return [];
      }),
      fetchOrderRowsForTrialOrder(currentSales.dealerCode, filter.brand, filter.startDate, filter.endDate).catch((error) => {
        warnings.push(`试驾后转订率读取失败：${error instanceof Error ? error.message : String(error)}`);
        return null;
      }),
      fetchOrderRowsForTrialOrder(currentSales.dealerCode, filter.brand, previousStart, previousEnd).catch((error) => {
        warnings.push(`试驾后转订率上月同期读取失败：${error instanceof Error ? error.message : String(error)}`);
        return null;
      }),
      fetchOrderRowsForTrialOrder(currentSales.dealerCode, filter.brand, previousWeekStart, previousWeekEnd).catch((error) => {
        warnings.push(`试驾后转订率上周同期读取失败：${error instanceof Error ? error.message : String(error)}`);
        return null;
      }),
      fetchRanks(currentSales.dealerCode, filter.startDate, filter.endDate).catch((error) => {
        warnings.push(`官方排名分位读取失败：${error instanceof Error ? error.message : String(error)}`);
        return {};
      }),
    ]);
    const currentDcc = aggregateDccRows(currentDccRows);
    const prevDcc = aggregateDccRows(prevDccRows);
    const currentDrive = aggregateDriveRows(currentDriveRows);
    const prevDrive = aggregateDriveRows(prevDriveRows);
    const currentIpTags = currentIpTagRows.length ? buildIpTagAggregate(currentIpTagRows, { includeEvidenceContext: true }) : emptyIpTags;
    const prevIpTags = prevIpTagRows.length ? buildIpTagAggregate(prevIpTagRows) : emptyIpTags;
    const previousWeekIpTags = previousWeekIpTagRows.length ? buildIpTagAggregate(previousWeekIpTagRows) : emptyIpTags;
    const currentDriveTags = currentDriveTagRows.length ? buildDriveTagAggregate(currentDriveTagRows, { includeEvidenceContext: true }) : emptyDriveTags;
    const prevDriveTags = prevDriveTagRows.length ? buildDriveTagAggregate(prevDriveTagRows) : emptyDriveTags;
    const previousWeekDriveTags = previousWeekDriveTagRows.length ? buildDriveTagAggregate(previousWeekDriveTagRows) : emptyDriveTags;
    const currentTrialOrder = currentOrderRows ? aggregateTrialOrderRows(currentDriveRows, currentOrderRows) : emptyTrialOrder;
    const prevTrialOrder = prevOrderRows ? aggregateTrialOrderRows(prevDriveRows, prevOrderRows) : emptyTrialOrder;
    const previousWeekTrialOrder = previousWeekOrderRows ? aggregateTrialOrderRows(previousWeekDriveRows, previousWeekOrderRows) : emptyTrialOrder;
    const dccTrend = buildDccDailyTrendFromRows(currentDccRows);
    const driveTrend = buildDriveDailyTrendFromRows(currentDriveRows);
    const ipTagTrend = buildIpTagDailyTrendFromRows(currentIpTagRows);
    const driveTagTrend = buildDriveTagDailyTrendFromRows(currentDriveTagRows);

    return {
      ...mockWorkbenchData,
      funnelMetrics: buildFunnel(currentSales, previousSales, ranks),
      processMetrics: buildProcessMetrics(currentDcc, prevDcc, currentDrive, prevDrive, currentIpTags, prevIpTags, previousWeekIpTags, currentDriveTags, prevDriveTags, previousWeekDriveTags, currentTrialOrder, prevTrialOrder, previousWeekTrialOrder),
      ipProblemNegativeRates: buildIpProblemNegativeRates(currentIpTags, previousWeekIpTags, prevIpTags),
      driveProblemNegativeRates: buildDriveProblemNegativeRates(currentDriveTags, previousWeekDriveTags, prevDriveTags),
      dailyTrendData: buildDailyTrendData(dccTrend, driveTrend, ipTagTrend, driveTagTrend, buildDateAxis(filter.startDate, filter.endDate)),
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
        drive: {
          name: '试驾接待',
          sourceStatus: 'confirmed',
          sourceNote: `已接入观远试驾接待问题诊断明细表，当前筛选范围 ${currentDriveTags.totalEvents} 次试驾，负向 ${currentDriveTags.negativeEvents} 次。`,
          tags: currentDriveTags.tags,
          advisors: currentDriveTags.advisors,
          records: currentDriveTags.records,
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
    confirmedSources: [`销售漏斗指标源（${modeLabel}）`, `DCC 话务指标源（${modeLabel}）`, `IP 打标明细数据集（${modeLabel}）`, `试驾明细宽表（${modeLabel}）`, `试驾打标明细数据集（${modeLabel}）`, `官方排名分位结果表（${modeLabel}）`],
    pendingSources: [],
  };
}
