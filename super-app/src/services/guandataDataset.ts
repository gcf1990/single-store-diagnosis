export interface DatasetField {
  fdId: string;
  name: string;
  alias?: string;
  fdType: string;
  granularity?: string;
  isAggregated?: boolean;
  seqNo?: number;
  dsId?: string;
  filterType?: string;
  filterValue?: unknown[];
}

export interface DatasetDetail {
  dsId: string;
  name: string;
  fields?: DatasetField[];
  columns?: DatasetField[];
  virtualColumns?: DatasetField[];
}

export interface DatasetPreviewResult {
  columns: DatasetField[];
  preview: string[][];
}

type TaskStatus = {
  status: string;
  result: { response?: { value?: string }; value?: string } | string | null;
};

export type DatasetFilterCondition =
  | { field: string; type: 'EQ' | 'NE' | 'IN' | 'GE' | 'LE'; value: string | string[] }
  | { field: string; type: 'BT'; value: [string, string] };

function unwrapResponse<T>(payload: any): T {
  if (payload?.error) {
    throw new Error(payload.error.message || '观远接口返回错误');
  }
  if (payload?.response !== undefined) {
    return payload.response as T;
  }
  if (payload?.code !== undefined) {
    if (payload.code !== 0) throw new Error(payload.msg || `观远接口返回错误: ${payload.code}`);
    return payload.data as T;
  }
  return payload as T;
}

function normalizeName(value: string | undefined): string {
  return String(value || '').trim();
}

function getCurrentPathname(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname || '';
}

function detectBIBaseRouteUrl(pathname = ''): string {
  const matched = pathname.split('?')[0].split('#')[0].match(/^(.*)\/open-apps(?:\/|$)/);
  const rawBase = matched?.[1] || '';
  const cleanedBase = rawBase.replace(/^\/+|\/+$/g, '');
  return cleanedBase ? `/${cleanedBase}` : '';
}

function getBIResourceUrl(path: string): string {
  const trimmedPath = String(path || '').trim();
  if (!trimmedPath || /^(?:[a-z]+:)?\/\//i.test(trimmedPath)) return trimmedPath;
  if (!/^\/(?:api|static|survey-engine)(?:\/|$)/.test(trimmedPath)) return trimmedPath;
  const isDev = Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  if (isDev) return trimmedPath;
  return `${detectBIBaseRouteUrl(getCurrentPathname())}${trimmedPath}`;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) throw new Error('观远接口返回空内容');
  if (trimmed.startsWith('<')) {
    throw new Error('观远接口返回 HTML，未拿到 JSON，请检查开放应用 API 路由或登录态');
  }
  return JSON.parse(trimmed) as T;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(getBIResourceUrl(url), {
    headers: { 'raw-backend-response': 'TRUE' },
  });
  if (!response.ok) throw new Error(`观远接口请求失败: ${response.status}`);
  return unwrapResponse<T>(await readJsonResponse(response));
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(getBIResourceUrl(url), {
    method: 'POST',
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      'raw-backend-response': 'TRUE',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`观远接口请求失败: ${response.status}`);
  return unwrapResponse<T>(await readJsonResponse(response));
}

export async function getDatasetDetail(dsId: string): Promise<DatasetDetail> {
  return getJson<DatasetDetail>(`/api/data-source/${dsId}`);
}

function findField(detail: DatasetDetail, name: string): DatasetField {
  const fields = [...(detail.fields || []), ...(detail.columns || []), ...(detail.virtualColumns || [])];
  const expected = normalizeName(name);
  const field = fields.find((item) => normalizeName(item.name) === expected || normalizeName(item.alias) === expected);
  if (!field) throw new Error(`数据集 ${detail.dsId} 缺少字段：${name}`);
  return field;
}

function buildFilter(detail: DatasetDetail, conditions: DatasetFilterCondition[]) {
  return {
    combineType: 'AND',
    conditions: conditions.map((condition) => {
      const field = findField(detail, condition.field);
      return {
        type: 'condition',
        value: {
          ...field,
          dsId: detail.dsId,
          level: 'dataset',
          isAggregated: Boolean(field.isAggregated),
          filterType: condition.type,
          filterValue: Array.isArray(condition.value) ? condition.value : [condition.value],
        },
      };
    }),
  };
}

function resolvePreviewFileName(result: TaskStatus['result']): string {
  if (typeof result === 'string') {
    try {
      return resolvePreviewFileName(JSON.parse(result));
    } catch {
      return result;
    }
  }
  const response = result?.response;
  const value = response?.value ?? result?.value;
  if (!value) throw new Error('观远预览任务缺少结果文件名');
  return value;
}

async function waitPreviewTask(taskId: string): Promise<string> {
  for (let index = 0; index < 40; index += 1) {
    const task = await getJson<TaskStatus>(`/api/task/${taskId}`);
    if (task.status === 'FINISHED') return resolvePreviewFileName(task.result);
    if (task.status === 'FAILED' || task.status === 'CANCELED') {
      throw new Error(`观远预览任务失败: ${task.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('观远预览任务超时');
}

export async function previewDatasetRows(
  dsId: string,
  options: { limit?: number; offset?: number; filters?: DatasetFilterCondition[] } = {},
): Promise<Array<Record<string, string>>> {
  const detail = await getDatasetDetail(dsId);
  const task = await postJson<{ taskId: string }>(`/api/data-source/${dsId}/preview-with-filter-async`, {
    offset: options.offset ?? 0,
    limit: options.limit ?? 5000,
    filter: options.filters?.length ? buildFilter(detail, options.filters) : undefined,
  });
  const fileName = await waitPreviewTask(task.taskId);
  const result = await postJson<DatasetPreviewResult>('/api/account/readPreviewFile', {
    taskId: task.taskId,
    fileName,
  });
  return result.preview.map((row) => {
    const entries = result.columns.flatMap((column, index) => {
      const value = row[index] ?? '';
      const keys = [column.name, column.alias].filter(Boolean) as string[];
      return keys.map((key) => [key, value]);
    });

    return Object.fromEntries(entries);
  });
}
