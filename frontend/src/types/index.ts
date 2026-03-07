export enum Role {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  CUSTOMER = 'customer',
}

export interface User {
  userId: string;
  email: string;
  fullName: string;
  phone?: string;
  company?: string;
  role: Role;
  customerSpaces: string[];
  invitedBy?: string;
  status: 'active' | 'disabled' | 'pending';
  mfaEnabled: boolean;
  createdAt: string;
  lastLogin?: string;
  analyticsConsent: boolean;
  preferredViewMode: 'embedded' | 'full-tab';
}

export interface Space {
  spaceId: string;
  spaceName: string;
  s3BucketName: string;
  createdBy: string;
  createdAt: string;
  status: 'active' | 'provisioning' | 'deleted';
  reportCount?: number;
  userCount?: number;
  allowedCustomerDomains?: string[];
}

export interface PlatformSettings {
  organizationName: string;
  organizationLegalEntity: string;
  allowedAdminDomains: string[];
  domainValidationMode: 'off' | 'warn' | 'strict';
  maxReportFileSizeMb: number;
  maxFeedbackAttachmentSizeMb: number;
  signedCookieTtlHours: number;
  invitationExpiryHours: number;
  notifyOnInvitationAccepted: boolean;
  notifyFeedbackByEmail: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Report {
  reportId: string;
  spaceId: string;
  fileName: string;
  s3Key: string;
  uploadedBy: string;
  uploadedAt: string;
  fileSize: number;
  status: 'active' | 'deleted';
  cloudFrontUrl?: string;
  hasUnreadFeedback?: boolean;
}

export interface Invitation {
  token: string;
  email: string;
  targetSpaceId: string;
  role: Role;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired';
  acceptedAt?: string;
}

export interface AuditLogEntry {
  eventId: string;
  timestamp: string;
  actor: string;
  actorEmail: string;
  action: string;
  target: string;
  ipAddress: string;
  userAgent: string;
  result: 'success' | 'failure';
  metadata?: Record<string, string>;
}

export interface AnalyticsData {
  spaceId: string;
  reportId?: string;
  userId?: string;
  eventType: 'report_open' | 'tab_view' | 'report_close' | 'session_heartbeat';
  tabHash?: string;
  tabLabel?: string;
  durationSeconds: number;
  viewMode: 'embedded' | 'full-tab';
  device?: string;
  browser?: string;
  timestamp: string;
}

export interface AnalyticsSummary {
  totalViews: number;
  uniqueUsers: number;
  avgDurationSeconds: number;
  tabBreakdown: TabAnalytics[];
  accessBySpace: SpaceAccessData[];
  accessFrequency: AccessFrequencyData[];
}

export interface TabAnalytics {
  tabHash: string;
  tabLabel: string;
  totalTimeSeconds: number;
  viewCount: number;
}

export interface SpaceAccessData {
  spaceId: string;
  spaceName: string;
  accessCount: number;
  uniqueUsers: number;
}

export interface AccessFrequencyData {
  date: string;
  count: number;
}

export interface Notification {
  notificationId: string;
  type:
    | 'invitation_accepted'
    | 'first_login'
    | 'mfa_reset'
    | 'report_uploaded'
    | 'feedback_new'
    | 'feedback_reply'
    | 'feedback_resolved';
  message: string;
  relatedSpaceId?: string;
  relatedUserId?: string;
  relatedThreadId?: string;
  read: boolean;
  createdAt: string;
}

export interface FeedbackThread {
  threadId: string;
  spaceId: string;
  reportId: string;
  subject: string;
  status: 'open' | 'resolved' | 'archived';
  createdBy: string;
  createdByName: string;
  createdByRole: Role;
  createdAt: string;
  lastMessageAt: string;
  lastMessageBy: string;
  messageCount: number;
  unreadByAdmin: boolean;
  unreadByCustomer: boolean;
  latestMessagePreview?: string;
  reportName?: string;
  spaceName?: string;
}

export interface FeedbackMessage {
  messageId: string;
  threadId: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  message: string;
  attachments: FeedbackAttachment[];
  createdAt: string;
}

export interface FeedbackAttachment {
  attachmentId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  url: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

export interface AuthChallengeResult {
  challengeName: 'NEW_PASSWORD_REQUIRED' | 'SOFTWARE_TOKEN_MFA' | 'SMS_MFA';
  session: string;
  challengeParameters?: Record<string, string>;
}

export interface LoginResult {
  tokens?: AuthTokens;
  challenge?: AuthChallengeResult;
  user?: User;
}

export interface ReportViewData {
  report: Report;
  cloudFrontUrl: string;
  signedCookies: Record<string, string>;
}
