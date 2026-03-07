import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Plus, X, Shield, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { useAuth } from '@/hooks/useAuth';
import { Role } from '@/types';
import type { PlatformSettings } from '@/types';

const settingsSchema = z.object({
  organizationName: z.string().min(1, 'Organization name is required'),
  organizationLegalEntity: z.string(),
  domainValidationMode: z.enum(['off', 'warn', 'strict']),
  maxReportFileSizeMb: z.coerce.number().min(1).max(500),
  maxFeedbackAttachmentSizeMb: z.coerce.number().min(1).max(100),
  signedCookieTtlHours: z.coerce.number().min(1).max(168),
  invitationExpiryHours: z.coerce.number().min(1).max(168),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export function SettingsPage() {
  const { user } = useAuth();
  const { settings, isLoading, saveSettings } = usePlatformSettings();
  const isSuperAdmin = user?.role === Role.SUPER_ADMIN;

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fields managed separately (not part of zod form)
  const [adminDomains, setAdminDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [notifyOnInvitationAccepted, setNotifyOnInvitationAccepted] = useState(true);
  const [notifyFeedbackByEmail, setNotifyFeedbackByEmail] = useState(false);
  const [domainsInitialized, setDomainsInitialized] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
  });

  // Initialize form when settings load
  if (!isLoading && settings && !domainsInitialized) {
    reset({
      organizationName: settings.organizationName,
      organizationLegalEntity: settings.organizationLegalEntity || '',
      domainValidationMode: settings.domainValidationMode,
      maxReportFileSizeMb: settings.maxReportFileSizeMb,
      maxFeedbackAttachmentSizeMb: settings.maxFeedbackAttachmentSizeMb,
      signedCookieTtlHours: settings.signedCookieTtlHours,
      invitationExpiryHours: settings.invitationExpiryHours,
    });
    setAdminDomains(settings.allowedAdminDomains ?? []);
    setNotifyOnInvitationAccepted(settings.notifyOnInvitationAccepted ?? true);
    setNotifyFeedbackByEmail(settings.notifyFeedbackByEmail ?? false);
    setDomainsInitialized(true);
  }

  const addDomain = () => {
    const domain = newDomain.trim().toLowerCase().replace(/^@/, '');
    if (domain && !adminDomains.includes(domain)) {
      setAdminDomains([...adminDomains, domain]);
      setNewDomain('');
    }
  };

  const removeDomain = (domain: string) => {
    if (adminDomains.length > 1) {
      setAdminDomains(adminDomains.filter((d) => d !== domain));
    }
  };

  const handleFormSubmit = async (values: SettingsFormValues) => {
    if (!isSuperAdmin) return;
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const updated: PlatformSettings = {
        ...values,
        allowedAdminDomains: adminDomains,
        notifyOnInvitationAccepted,
        notifyFeedbackByEmail,
      };
      await saveSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const domainValidationMode = watch('domainValidationMode');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Platform Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure organization-wide settings for the report portal.
          </p>
        </div>
        {!isSuperAdmin && (
          <Badge variant="secondary">
            <Shield className="mr-1 h-3 w-3" />
            View Only
          </Badge>
        )}
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Organization */}
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>
              Branding and identity settings used in emails and UI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="organizationName">Organization Name</Label>
                <Input
                  id="organizationName"
                  placeholder="e.g., Acme Report Portal"
                  disabled={!isSuperAdmin}
                  {...register('organizationName')}
                />
                {errors.organizationName && (
                  <p className="text-sm text-destructive">{errors.organizationName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="organizationLegalEntity">Legal Entity (email footer)</Label>
                <Input
                  id="organizationLegalEntity"
                  placeholder="e.g., Acme Pty Ltd"
                  disabled={!isSuperAdmin}
                  {...register('organizationLegalEntity')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Domain Restriction */}
        <Card>
          <CardHeader>
            <CardTitle>Admin Domain Restriction</CardTitle>
            <CardDescription>
              Only users with email addresses from these domains can be invited as admins.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {adminDomains.map((domain) => (
                <Badge key={domain} variant="outline" className="gap-1 px-3 py-1.5">
                  @{domain}
                  {isSuperAdmin && adminDomains.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDomain(domain)}
                      className="ml-1 rounded-full hover:bg-accent p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
            {isSuperAdmin && (
              <div className="flex gap-2">
                <Input
                  placeholder="newdomain.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addDomain();
                    }
                  }}
                  className="max-w-xs"
                />
                <Button type="button" variant="outline" size="sm" onClick={addDomain}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Invitation Safety */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Invitation Domain Validation</CardTitle>
            <CardDescription>
              Controls whether customer email domains are validated against the space name when inviting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Validation Mode</Label>
              <Select
                value={domainValidationMode}
                onValueChange={(v) =>
                  setValue('domainValidationMode', v as 'off' | 'warn' | 'strict', {
                    shouldDirty: true,
                  })
                }
                disabled={!isSuperAdmin}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off &mdash; No validation</SelectItem>
                  <SelectItem value="warn">Warn &mdash; Show warning, allow override</SelectItem>
                  <SelectItem value="strict">Strict &mdash; Block mismatched domains</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {domainValidationMode === 'off' && 'Any email can be invited to any space without checks.'}
                {domainValidationMode === 'warn' &&
                  'A warning is shown when the email domain doesn\'t match the space, but the admin can override.'}
                {domainValidationMode === 'strict' &&
                  'Invitations are blocked if the email domain doesn\'t match the space\'s allowed domains.'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Upload Limits */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Limits</CardTitle>
            <CardDescription>
              Maximum file sizes for reports and feedback attachments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxReportFileSizeMb">Max Report File Size (MB)</Label>
                <Input
                  id="maxReportFileSizeMb"
                  type="number"
                  min={1}
                  max={500}
                  disabled={!isSuperAdmin}
                  {...register('maxReportFileSizeMb')}
                />
                {errors.maxReportFileSizeMb && (
                  <p className="text-sm text-destructive">{errors.maxReportFileSizeMb.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxFeedbackAttachmentSizeMb">Max Feedback Attachment Size (MB)</Label>
                <Input
                  id="maxFeedbackAttachmentSizeMb"
                  type="number"
                  min={1}
                  max={100}
                  disabled={!isSuperAdmin}
                  {...register('maxFeedbackAttachmentSizeMb')}
                />
                {errors.maxFeedbackAttachmentSizeMb && (
                  <p className="text-sm text-destructive">
                    {errors.maxFeedbackAttachmentSizeMb.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Session and invitation timeouts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="signedCookieTtlHours">Signed Cookie TTL (hours)</Label>
                <Input
                  id="signedCookieTtlHours"
                  type="number"
                  min={1}
                  max={168}
                  disabled={!isSuperAdmin}
                  {...register('signedCookieTtlHours')}
                />
                {errors.signedCookieTtlHours && (
                  <p className="text-sm text-destructive">{errors.signedCookieTtlHours.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="invitationExpiryHours">Invitation Link Expiry (hours)</Label>
                <Input
                  id="invitationExpiryHours"
                  type="number"
                  min={1}
                  max={168}
                  disabled={!isSuperAdmin}
                  {...register('invitationExpiryHours')}
                />
                {errors.invitationExpiryHours && (
                  <p className="text-sm text-destructive">{errors.invitationExpiryHours.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure email notifications for admin events.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Notify on invitation accepted</Label>
                <p className="text-xs text-muted-foreground">
                  Send an email to the inviting admin when a user accepts their invitation and creates an account.
                </p>
              </div>
              <Switch
                checked={notifyOnInvitationAccepted}
                onCheckedChange={setNotifyOnInvitationAccepted}
                disabled={!isSuperAdmin}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Send feedback notifications by email</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, admins receive an email whenever a customer submits new feedback or replies to a thread.
                </p>
              </div>
              <Switch
                checked={notifyFeedbackByEmail}
                onCheckedChange={setNotifyFeedbackByEmail}
                disabled={!isSuperAdmin}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        {isSuperAdmin && (
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
            {saveSuccess && (
              <p className="text-sm text-green-600">Settings saved successfully.</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {settings.updatedAt && (
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(settings.updatedAt).toLocaleString()}
            {settings.updatedBy && ` by ${settings.updatedBy}`}
          </p>
        )}
      </form>
    </div>
  );
}
