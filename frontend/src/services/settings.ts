import api from '@/services/api';
import type { PlatformSettings } from '@/types';

export async function getSettings(): Promise<PlatformSettings> {
  const { data } = await api.get<PlatformSettings>('/admin/settings');
  return data;
}

export async function updateSettings(settings: PlatformSettings): Promise<PlatformSettings> {
  const { data } = await api.put<PlatformSettings>('/admin/settings', settings);
  return data;
}
