export type DiagnosisDomain = 'ip' | 'drive';
export type TrendDirection = 'up' | 'down';

export interface FunnelMetric {
  label: string;
  value: string;
  unit: string;
  compare: string;
  trend: TrendDirection;
  rank?: string;
}

export interface ProcessMetric {
  label: string;
  value: string;
  mom: string;
  trend: TrendDirection;
  source?: 'guandata' | 'mock';
}

export interface ProcessMetricGroup {
  title: string;
  defaultMetric: string;
  metrics: string[];
}

export interface TrendSeries {
  name: string;
  color: string;
  values: number[];
}

export interface DailyTrendData {
  eyebrow: string;
  title: string;
  yMin?: number;
  yMax?: number;
  ySuffix?: string;
  normalize?: boolean;
  days: string[];
  series: TrendSeries[];
}

export interface DiagnosisTagChild {
  label: string;
  count: number;
}

export interface DiagnosisTag {
  label: string;
  count: number;
  percent: number;
  children: DiagnosisTagChild[];
}

export interface AdvisorDistribution {
  name: string;
  count: number;
}

export interface DiagnosisRecord {
  customer: string;
  advisor: string;
  time: string;
  tag: string;
  primaryTag?: string;
  secondaryTag?: string;
  polarity: string;
  summary: string;
  evidence: string;
  script: string;
}

export interface DiagnosisDataset {
  name: string;
  sourceStatus: 'confirmed' | 'pending';
  sourceNote: string;
  tags: DiagnosisTag[];
  advisors: AdvisorDistribution[];
  records: DiagnosisRecord[];
}

export interface WorkbenchData {
  funnelMetrics: FunnelMetric[];
  processMetrics: Record<DiagnosisDomain, ProcessMetric[]>;
  processMetricGroups: Record<DiagnosisDomain, ProcessMetricGroup[]>;
  dailyTrendData: Record<DiagnosisDomain, DailyTrendData>;
  diagnosis: Record<DiagnosisDomain, DiagnosisDataset>;
  defaultMetricByTab: Record<DiagnosisDomain, string>;
  metricFocusTags: Record<string, string[]>;
  dataMode?: 'live' | 'mock' | 'hybrid';
  sourceWarnings?: string[];
}
