/**
 * Centralised UI selectors for all E2E tests.
 * Uses data-testid attributes where available, falls back to role/label/text selectors.
 */
export const selectors = {
  // ─── Login Page ───────────────────────────────────────────────────────
  login: {
    emailInput: '[data-testid="login-email"], [data-testid="email-input"], input[type="email"], [aria-label*="Email" i]',
    passwordInput: '[data-testid="login-password"], [data-testid="password-input"], input[type="password"], [aria-label*="Password" i]',
    submitButton: '[data-testid="login-submit"], [data-testid="sign-in"], button:has-text("Sign In"), button:has-text("Login"), button[type="submit"]',
    errorMessage: '[data-testid="login-error"], [data-testid="auth-error"], [role="alert"], .text-destructive',
    forgotPasswordLink: '[data-testid="forgot-password"], a:has-text("Forgot password"), a:has-text("Forgot"), a:has-text("Reset")',
    loadingSpinner: '[data-testid="login-loading"], [role="progressbar"], [aria-label="Loading"]',
  },

  // ─── MFA Page ─────────────────────────────────────────────────────────
  mfa: {
    codeInput: '[data-testid="mfa-code"], input[name="mfaCode"], input[placeholder*="code"], input[aria-label*="MFA" i], input[aria-label*="Code" i], input[aria-label*="OTP" i]',
    submitButton: '[data-testid="mfa-submit"], button:has-text("Verify"), button:has-text("Submit")',
    errorMessage: '[data-testid="mfa-error"], [role="alert"]',
    resendLink: '[data-testid="mfa-resend"], a:has-text("Resend")',
    setupQrCode: '[data-testid="mfa-qr-code"], img[alt*="QR"]',
    setupSecretKey: '[data-testid="mfa-secret-key"]',
  },

  // ─── First Login / Password Reset ────────────────────────────────────
  firstLogin: {
    newPasswordInput: '[data-testid="new-password"], input[name="newPassword"], input[aria-label*="New Password" i]',
    confirmPasswordInput: '[data-testid="confirm-password"], input[name="confirmPassword"], input[aria-label*="Confirm" i]',
    submitButton: '[data-testid="set-password-submit"], button:has-text("Set Password"), button[type="submit"]',
    mfaSetupSection: '[data-testid="mfa-setup"]',
  },

  // ─── Forgot Password ─────────────────────────────────────────────────
  forgotPassword: {
    emailInput: '[data-testid="forgot-email"], input[name="email"], input[type="email"]',
    submitButton: '[data-testid="forgot-submit"], button:has-text("Send Code"), button:has-text("Reset"), button[type="submit"]',
    codeInput: '[data-testid="reset-code"], input[name="code"]',
    newPasswordInput: '[data-testid="reset-new-password"], input[name="newPassword"]',
    confirmPasswordInput: '[data-testid="reset-confirm-password"], input[name="confirmPassword"]',
    resetSubmitButton: '[data-testid="reset-submit"], button:has-text("Reset Password")',
    successMessage: '[data-testid="reset-success"]',
  },

  // ─── Navigation ───────────────────────────────────────────────────────
  nav: {
    sidebar: '[data-testid="sidebar"], nav[role="navigation"], aside',
    dashboardLink: '[data-testid="nav-dashboard"], a:has-text("Dashboard")',
    spacesLink: '[data-testid="nav-spaces"], nav a:has-text("Spaces"), aside a:has-text("Spaces"), a:has-text("Customers")',
    usersLink: '[data-testid="nav-users"], a:has-text("Users")',
    analyticsLink: '[data-testid="nav-analytics"], a:has-text("Analytics")',
    auditLogLink: '[data-testid="nav-audit-log"], [data-testid="nav-audit"], a:has-text("Audit Log"), a:has-text("Audit")',
    feedbackLink: '[data-testid="nav-feedback"], a:has-text("Feedback")',
    settingsLink: '[data-testid="nav-settings"], a:has-text("Settings")',
    notificationBell: '[data-testid="notification-bell"], [data-testid="notifications"], button[aria-label*="notification"], [aria-label*="Notification"]',
    notificationsButton: '[data-testid="notification-bell"], [data-testid="notifications"], button[aria-label*="notification"], [aria-label*="Notification"]',
    auditLink: '[data-testid="nav-audit-log"], [data-testid="nav-audit"], a:has-text("Audit Log"), a:has-text("Audit")',
    profileButton: '[data-testid="user-menu"], [data-testid="nav-profile"], button:has-text("Profile")',
    notificationBadge: '[data-testid="notification-badge"]',
    userMenu: '[data-testid="user-menu"], [data-testid="nav-profile"], button:has-text("Profile")',
    logoutButton: '[data-testid="logout"], button:has-text("Logout"), button:has-text("Sign Out")',
  },

  // ─── Dashboard ────────────────────────────────────────────────────────
  dashboard: {
    container: '[data-testid="dashboard"], main, [role="main"]',
    overviewSection: '[data-testid="dashboard-overview"]',
    recentActivity: '[data-testid="recent-activity"]',
    spaceCount: '[data-testid="space-count"]',
    userCount: '[data-testid="user-count"]',
    welcomeMessage: '[data-testid="welcome-message"]',
  },

  // ─── Space List ───────────────────────────────────────────────────────
  spaceList: {
    container: '[data-testid="space-list"], [role="list"], table',
    spaceCard: '[data-testid="space-card"], tr[data-testid*="space"], [role="listitem"]',
    spaceName: '[data-testid="space-name"]',
    createButton: '[data-testid="create-space"], button:has-text("Create Space"), button:has-text("Create"), button:has-text("New Space")',
    searchInput: '[data-testid="space-search"], [data-testid="search-spaces"], input[placeholder*="Search" i]',
    emptyState: '[data-testid="spaces-empty"], [data-testid="empty-state"]',
    loadMoreButton: 'button:has-text("Load More"), button:has-text("Show More")',
  },

  // ─── Create Space Dialog ──────────────────────────────────────────────
  createSpace: {
    dialog: '[data-testid="create-space-dialog"], [role="dialog"], div.fixed:has(button:has-text("Create Space"))',
    nameInput: '[data-testid="space-name-input"], input[name="spaceName"], input[name="name"], input[aria-label*="name" i]',
    nameInfoTooltip: '[data-testid="space-name-info"]',
    submitButton: '[data-testid="create-space-submit"], button:has-text("Create"), button:has-text("Save"), button[type="submit"]',
    cancelButton: '[data-testid="create-space-cancel"], button:has-text("Cancel")',
    errorMessage: '[data-testid="create-space-error"]',
  },

  // ─── Space Detail ─────────────────────────────────────────────────────
  spaceDetail: {
    container: '[data-testid="space-detail"]',
    reportsList: '[data-testid="reports-list"], [data-testid="report-list"], table',
    reportCard: '[data-testid="report-card"], tr[data-testid*="report"], [data-testid*="report-item"]',
    reportName: '[data-testid="report-name"]',
    uploadButton: '[data-testid="upload-report"], button:has-text("Upload")',
    uploadDropzone: '[data-testid="upload-dropzone"]',
    uploadFileInput: '[data-testid="upload-file-input"], input[type="file"]',
    inviteButton: '[data-testid="invite-user"], [data-testid="invite-customer"], button:has-text("Invite")',
    deleteReportButton: '[data-testid="delete-report"]',
    deleteSpaceButton: '[data-testid="delete-space"], button:has-text("Delete Space")',
    emptyState: '[data-testid="reports-empty"], [data-testid="empty-state"]',
  },

  // ─── Invite User Dialog ───────────────────────────────────────────────
  inviteUser: {
    dialog: '[data-testid="invite-dialog"], [role="dialog"]',
    emailInput: '[data-testid="invite-email"], input[name="email"], input[type="email"], input[aria-label*="Email" i]',
    submitButton: '[data-testid="invite-submit"], button:has-text("Send Invitation"), button:has-text("Invite"), button:has-text("Send"), button[type="submit"]',
    cancelButton: '[data-testid="invite-cancel"], button:has-text("Cancel")',
    domainWarning: '[data-testid="domain-mismatch-warning"], [data-testid="domain-warning"]',
    confirmButton: '[data-testid="invite-confirm"], button:has-text("Confirm")',
    successMessage: '[data-testid="invite-success"]',
    errorMessage: '[data-testid="invite-error"], [role="alert"], .text-destructive',
  },

  // ─── Report Viewer ────────────────────────────────────────────────────
  reportViewer: {
    container: '[data-testid="report-viewer"], [data-testid="report-detail"]',
    iframe: '[data-testid="report-iframe"], iframe[data-testid="report-iframe"], iframe',
    embeddedView: '[data-testid="embedded-view"]',
    fullTabView: '[data-testid="full-tab-view"]',
    openFullTabButton: '[data-testid="open-full-tab"], button:has-text("Open Full View"), button:has-text("Full Tab"), button:has-text("Open in new tab"), a:has-text("Open Full View"), a:has-text("Open")',
    backToPortalButton: '[data-testid="back-to-portal"], [data-testid="go-to-portal"], a:has-text("Back to portal"), a:has-text("Go to portal"), a:has-text("Back")',
    floatingToolbar: '[data-testid="floating-toolbar"]',
    reportTitle: '[data-testid="report-title"]',
    feedbackToggle: '[data-testid="feedback-toggle"], button:has-text("Feedback"), button:has-text("Comment")',
    sessionExpiredOverlay: '[data-testid="session-expired"], [data-testid="session-expired-overlay"], [data-testid="expired-overlay"]',
    sessionExpiredGoToPortal: '[data-testid="session-expired-cta"], [data-testid="go-to-portal"], button:has-text("Go to portal"), a:has-text("Go to portal")',
    viewModeToggle: '[data-testid="view-mode-toggle"]',
  },

  // ─── Feedback Panel ───────────────────────────────────────────────────
  feedback: {
    panel: '[data-testid="feedback-panel"]',
    overlay: '[data-testid="feedback-overlay"]',
    threadList: '[data-testid="feedback-thread-list"], [data-testid="feedback-threads"], [data-testid="thread-list"]',
    threadItem: '[data-testid="feedback-thread"], [data-testid*="thread-item"]',
    threadSubject: '[data-testid="thread-subject"]',
    threadStatus: '[data-testid="thread-status"]',
    newThreadButton: '[data-testid="new-feedback"], button:has-text("New Feedback"), button:has-text("New Thread")',
    subjectInput: '[data-testid="feedback-subject"], input[name="subject"], input[aria-label*="Subject" i], input[aria-label*="Title" i]',
    messageEditor: '[data-testid="feedback-message"], textarea[name="message"], textarea, [contenteditable="true"]',
    attachButton: '[data-testid="feedback-attach"], button:has-text("Attach")',
    attachFileInput: '[data-testid="feedback-attach-input"], input[type="file"]',
    submitButton: '[data-testid="feedback-submit"], [data-testid="submit-feedback"], button:has-text("Submit"), button:has-text("Send"), button:has-text("Create")',
    messageList: '[data-testid="message-list"]',
    messageItem: '[data-testid="message-item"], [data-testid="feedback-message-item"]',
    messageAuthor: '[data-testid="message-author"], [data-testid="author-badge"]',
    messageRole: '[data-testid="message-role"]',
    messageContent: '[data-testid="message-content"]',
    replyInput: '[data-testid="reply-input"], textarea[name="reply"], textarea, [contenteditable="true"]',
    replySubmit: '[data-testid="reply-submit"], button:has-text("Reply"), button:has-text("Send")',
    resolveButton: '[data-testid="resolve-thread"], button:has-text("Resolve")',
    archiveButton: '[data-testid="archive-thread"], button:has-text("Archive")',
    resolvedBadge: '[data-testid="resolved-badge"], [data-testid="thread-status"]:has-text("Resolved"), :has-text("Resolved")',
    inboxContainer: '[data-testid="feedback-inbox"]',
    inboxFilter: '[data-testid="feedback-filter"]',
    inboxSpaceFilter: '[data-testid="feedback-space-filter"]',
    inboxStatusFilter: '[data-testid="feedback-status-filter"]',
    unreadBadge: '[data-testid="feedback-unread-badge"]',
  },

  // ─── User Management ──────────────────────────────────────────────────
  userManagement: {
    container: '[data-testid="user-management"], [data-testid="user-list"]',
    userTable: '[data-testid="user-table"], table',
    userRow: '[data-testid="user-row"], tr[data-testid*="user"]',
    roleFilter: '[data-testid="role-filter"], select[aria-label*="Role" i], [role="combobox"]',
    spaceFilter: '[data-testid="space-filter"]',
    searchInput: '[data-testid="user-search"]',
    inviteAdminButton: '[data-testid="invite-admin"], button:has-text("Invite Admin")',
    disableButton: '[data-testid="disable-user"], button:has-text("Disable"), button:has-text("Deactivate")',
    enableButton: '[data-testid="enable-user"], button:has-text("Enable"), button:has-text("Activate")',
    deleteButton: '[data-testid="delete-user"], button:has-text("Delete User")',
    resetMfaButton: '[data-testid="reset-mfa"], button:has-text("Reset MFA")',
    viewAsButton: '[data-testid="view-as"], button:has-text("View as"), button:has-text("Impersonate")',
  },

  // ─── Impersonation ────────────────────────────────────────────────────
  impersonation: {
    banner: '[data-testid="impersonation-banner"], [role="alert"]:has-text("Viewing as"), [role="alert"]:has-text("Impersonating")',
    bannerText: '[data-testid="impersonation-banner-text"]',
    exitButton: '[data-testid="exit-impersonation"], button:has-text("Exit impersonation"), button:has-text("Exit"), button:has-text("Stop")',
    readOnlyTooltip: '[data-testid="read-only-tooltip"]',
  },

  // ─── Analytics Dashboard ──────────────────────────────────────────────
  analytics: {
    container: '[data-testid="analytics-dashboard"], [data-testid="analytics"]',
    chartContainer: '[data-testid="analytics-chart"], [data-testid="chart"]',
    accessChart: '[data-testid="access-chart"]',
    timeSpentChart: '[data-testid="time-spent-chart"]',
    tabBreakdownChart: '[data-testid="tab-breakdown-chart"]',
    dateRangeSelector: '[data-testid="date-range"], [data-testid="date-filter"]',
    exportButton: '[data-testid="analytics-export"], button:has-text("Export")',
    spaceSelector: '[data-testid="analytics-space-selector"]',
    userSelector: '[data-testid="analytics-user-selector"]',
    rechartsContainer: '.recharts-wrapper, .recharts-responsive-container',
  },

  // ─── Audit Log ────────────────────────────────────────────────────────
  auditLog: {
    container: '[data-testid="audit-log"]',
    logTable: '[data-testid="audit-table"], table',
    logEntry: '[data-testid="audit-entry"], tbody tr',
    dateFilter: '[data-testid="audit-date-filter"]',
    userFilter: '[data-testid="audit-user-filter"], [data-testid="audit-actor-filter"]',
    actionFilter: '[data-testid="audit-action-filter"]',
    spaceFilter: '[data-testid="audit-space-filter"]',
    emptyState: '[data-testid="audit-empty"], [data-testid="empty-state"]',
  },

  // ─── Customer Portal ──────────────────────────────────────────────────
  customerPortal: {
    spaceList: '[data-testid="customer-spaces"]',
    spaceCard: '[data-testid="customer-space-card"], [data-testid="customer-space"], [data-testid="space-card"]',
    reportBrowser: '[data-testid="report-browser"], [data-testid="customer-reports"]',
    reportCard: '[data-testid="customer-report-card"], [data-testid="customer-report"], [data-testid="report-card"]',
    openReportButton: '[data-testid="open-report"], button:has-text("Open Report"), a:has-text("Open Report")',
  },

  // ─── Consent Banner ───────────────────────────────────────────────────
  consent: {
    banner: '[data-testid="consent-banner"]',
    acceptButton: '[data-testid="consent-accept"], button:has-text("Accept")',
    dismissButton: '[data-testid="consent-dismiss"], button:has-text("Dismiss"), button:has-text("Decline")',
  },

  // ─── Notifications ────────────────────────────────────────────────────
  notifications: {
    dropdown: '[data-testid="notification-dropdown"]',
    badge: '[data-testid="notification-badge"]',
    item: '[data-testid="notification-item"]',
    markAllRead: 'button:has-text("Mark all"), button:has-text("Read all")',
    emptyState: '[data-testid="no-notifications"]',
  },

  // ─── Platform Settings ───────────────────────────────────────────────
  settings: {
    container: '[data-testid="settings-page"], main:has(h2:has-text("Platform Settings"))',
    viewOnlyBadge: '[data-testid="settings-view-only"], :has-text("View Only")',
    // Organization section
    orgNameInput: '#organizationName, [data-testid="org-name-input"]',
    orgLegalEntityInput: '#organizationLegalEntity, [data-testid="org-legal-entity-input"]',
    // Admin domains section
    domainBadge: '[data-testid="admin-domain-badge"], .gap-1.px-3',
    domainInput: '[data-testid="admin-domain-input"], input[placeholder*="domain" i]',
    addDomainButton: '[data-testid="add-domain"], button:has-text("Add")',
    removeDomainButton: '[data-testid="remove-domain"]',
    // Domain validation mode
    validationModeSelect: '[data-testid="validation-mode-select"], button[role="combobox"]',
    validationModeOff: '[data-testid="validation-off"], [role="option"]:has-text("Off")',
    validationModeWarn: '[data-testid="validation-warn"], [role="option"]:has-text("Warn")',
    validationModeStrict: '[data-testid="validation-strict"], [role="option"]:has-text("Strict")',
    // Upload limits
    maxReportSizeInput: '#maxReportFileSizeMb, [data-testid="max-report-size"]',
    maxAttachmentSizeInput: '#maxFeedbackAttachmentSizeMb, [data-testid="max-attachment-size"]',
    // Security
    cookieTtlInput: '#signedCookieTtlHours, [data-testid="cookie-ttl"]',
    invitationExpiryInput: '#invitationExpiryHours, [data-testid="invitation-expiry"]',
    // Notifications
    notifyInvitationSwitch: '[data-testid="notify-invitation-switch"], button[role="switch"]:near(:has-text("invitation"))',
    notifyFeedbackSwitch: '[data-testid="notify-feedback-switch"], button[role="switch"]:near(:has-text("feedback"))',
    // Save
    saveButton: '[data-testid="save-settings"], button:has-text("Save Settings")',
    saveSuccess: '[data-testid="save-success"], :has-text("Settings saved successfully")',
    saveError: '[data-testid="save-error"], .text-destructive',
    // Metadata
    lastUpdated: '[data-testid="settings-last-updated"]',
  },

  // ─── Common / Shared ─────────────────────────────────────────────────
  common: {
    toast: '[data-testid="toast"], [role="status"]',
    toastSuccess: '[data-testid="toast-success"], .toast-success',
    toastError: '[data-testid="toast-error"], .toast-error, [role="alert"]',
    confirmDialog: '[data-testid="confirm-dialog"], [role="alertdialog"]',
    confirmYes: '[data-testid="confirm-yes"], button:has-text("Confirm"), button:has-text("Yes")',
    confirmNo: '[data-testid="confirm-no"], button:has-text("Cancel"), button:has-text("No")',
    loadingOverlay: '[data-testid="loading"], [role="progressbar"], [aria-label="Loading"]',
    pagination: '[data-testid="pagination"]',
    paginationNext: '[data-testid="pagination-next"]',
    paginationPrev: '[data-testid="pagination-prev"]',
    errorPage: '[data-testid="error-page"], [data-testid="not-found"]',
    notFoundPage: '[data-testid="not-found"]',
    forbiddenPage: '[data-testid="forbidden"], [data-testid="access-denied"]',
    emptyState: '[data-testid="empty-state"]',
  },
} as const;
