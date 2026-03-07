import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '@/services/settings';
import type { PlatformSettings } from '@/types';

const SETTINGS_KEY = ['platform-settings'];

export function usePlatformSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: getSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const saveSettings = async (updated: PlatformSettings) => {
    const result = await updateSettings(updated);
    queryClient.setQueryData(SETTINGS_KEY, result);
    return result;
  };

  const defaults: PlatformSettings = {
    organizationName: 'Report Portal',
    organizationLegalEntity: '',
    allowedAdminDomains: ['versent.com.au'],
    domainValidationMode: 'warn',
    maxReportFileSizeMb: 50,
    maxFeedbackAttachmentSizeMb: 10,
    signedCookieTtlHours: 3,
    invitationExpiryHours: 24,
    notifyOnInvitationAccepted: true,
    notifyFeedbackByEmail: false,
  };

  return {
    settings: settings ?? defaults,
    isLoading,
    saveSettings,
  };
}
