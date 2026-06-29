export interface AppSettings {
  name?: string;
  title?: string;
  dataMode?: 'mock' | 'hybrid' | 'live';
  pendingSources?: string[];
}

export async function loadAppSettings(): Promise<AppSettings> {
  const response = await fetch('./settings.json', { cache: 'no-store' });

  if (!response.ok) {
    return {
      name: '单店销售诊断工作台',
      title: '单店销售诊断工作台',
      dataMode: 'hybrid',
      pendingSources: [],
    };
  }

  return (await response.json()) as AppSettings;
}
