# Secure Report Portal — CLAUDE.md

## Project Overview

Build a **security-first**, multi-tenant AWS serverless application for delivering HTML reports to customers. Each customer has an isolated space with their own S3 bucket. Reports are served via CloudFront → S3 (private connectivity), authenticated and authorised through API Gateway + Cognito.

**Security is the #1 priority across every design decision.**

---

## Architecture — AWS Services

| Layer | Service | Purpose |
|-------|---------|---------|
| CDN + Security | **CloudFront + AWS WAF** | Content delivery with WAF protection (rate limiting, geo-blocking, bot protection, SQL injection/XSS rules) |
| Auth | **Cognito User Pool** | User management, MFA, JWT tokens |
| API | **API Gateway (REST)** | Authenticated endpoints for admin and customer operations |
| Compute | **Java 21 Lambda + SnapStart** | Backend business logic (Spring Boot 3) |
| Email | **Amazon SES** | Invitation emails, feedback notifications, password resets |
| Events | **Amazon EventBridge** | Event-driven feedback notifications, async workflows |
| Storage | **S3 (per-customer bucket)** | Isolated report storage — one bucket per customer space |
| Storage | **S3 (feedback bucket)** | Feedback attachments (screenshots, PDFs) |
| Database | **DynamoDB** | Metadata, audit logs, analytics, user records, feedback threads |
| Secrets | **Secrets Manager / KMS** | Encryption keys, sensitive config |
| Monitoring | **CloudWatch + X-Ray** | Logging, tracing, alarms |
| IaC | **CDK v2 (TypeScript)** | All infrastructure as code |

**AWS-native principle:** Use AWS services wherever possible. No third-party SaaS dependencies — all compute, storage, messaging, email, and event handling via AWS services.

---

## Security Requirements — PRIORITY

### AWS WAF on CloudFront (MANDATORY)

Deploy AWS WAF WebACL attached to the CloudFront distribution with the following rule groups:

1. **AWS Managed Rules — Core Rule Set (CRS)** — cross-site scripting, SQL injection, general web exploits
2. **AWS Managed Rules — Known Bad Inputs** — block known malicious request patterns
3. **AWS Managed Rules — Bot Control** — detect and manage bot traffic
4. **Rate limiting rule** — max 1000 requests per 5 minutes per IP (configurable)
5. **Geo-restriction** — default allow Australia only (configurable per deployment)
6. **IP reputation list** — block requests from known malicious IPs
7. **Custom rule: block requests without valid CloudFront headers** — prevent origin bypass

Additional CloudFront security:
- **Origin Access Control (OAC)** for S3 — no direct S3 access
- **HTTPS only** — redirect HTTP to HTTPS, TLS 1.2 minimum
- **Security headers** via CloudFront response headers policy (HSTS, X-Content-Type-Options, X-Frame-Options, CSP)
- **Signed cookies or signed URLs** for report access — time-limited, per-customer-space scoped
- **Custom error pages** — don't leak stack traces or internal paths

### Authentication & Authorisation

- **Cognito User Pool** with:
  - MFA enforced (TOTP preferred, SMS fallback)
  - Password policy: min 12 chars, uppercase, lowercase, number, special char
  - Account lockout after 5 failed attempts
  - JWT tokens with short expiry (15 min access, 1 hour refresh)
  - Device tracking enabled

- **Cognito custom attributes:**
  - `custom:role` — `super_admin`, `admin`, `customer`
  - `custom:customer_space` — the customer space ID (for customers)
  - `custom:invited_by` — who invited this user

- **Impersonation tokens:**
  - When a super admin impersonates a user, the backend issues a short-lived JWT (5 min, auto-refresh) containing: the impersonated user's role and permissions, an `impersonator` claim with the super admin's ID, and a `read_only: true` flag
  - The frontend detects the `impersonator` claim and renders the impersonation banner + disables all write actions
  - The API layer rejects any write operations when `impersonator` claim is present

### S3 Isolation (Per-Customer Bucket)

- Each customer space gets a **dedicated S3 bucket** (not subfolders)
- Bucket naming: `report-portal-{customer-space-id}-{account-id}-{region}`
- S3 bucket policy: only allow access via CloudFront OAC
- Server-side encryption with KMS (customer-managed key)
- Versioning enabled
- Block all public access
- Object lock for compliance (optional, configurable)
- S3 access logging to a dedicated audit bucket

### Report Characteristics (based on actual sample reports)

Reports are **self-contained, single-file HTML documents** — not simple static pages. A typical report:

- **Size:** ~4,000+ lines of HTML/CSS/JS in a single `.html` file
- **Internal navigation:** Multiple tabbed sections with hash-based routing (e.g., `#tab-executive`, `#tab-risk`). **The number and names of tabs vary per report** — one report might have 3 tabs, another might have 12. There is no fixed tab structure. The analytics system must dynamically discover whatever tabs exist in each report
- **Dynamic rendering:** Mermaid architecture diagrams loaded from CDN and rendered at page load
- **Theme support:** Light/dark mode toggle (CSS custom properties)
- **Rich content:** Score tables, heatmaps, risk matrices, gauges, technology landscape tables, compliance checklists, modernisation roadmaps with phased plans
- **Print support:** `@media print` stylesheets for PDF export
- **No external data calls:** Reports do not fetch data from APIs at runtime — all content is embedded in the HTML. They may load CDN resources (fonts, Mermaid JS) but do not make authenticated API calls

This means:
1. The iframe **must allow JavaScript** execution for the report to render correctly
2. The full-tab view is the natural UX — the report is designed to be the entire page, not a panel within a panel
3. Analytics tracking needs to capture which **internal tab** the user is viewing (via hash change events on the iframe), not just "viewed report"
4. The HTML sanitiser on upload must preserve the report's functional JS while stripping potentially harmful external calls

### Report Serving Flow (CRITICAL — end-to-end path)

This is the core flow for how a customer views a report:

1. Customer logs in → receives Cognito JWT (access + ID tokens)
2. Customer clicks a report → frontend calls `GET /customer/spaces/{spaceId}/reports/{reportId}`
3. Lambda validates JWT, checks user is assigned to this space, then:
   a. Generates **CloudFront signed cookies** scoped to the customer's S3 bucket path (`/report-portal-{spaceId}/*`)
   b. Signed cookies expire after **3 hours** (configurable) — reports are complex multi-tab documents that users spend extended time reviewing
   c. Returns the report metadata + CloudFront URL
4. Frontend sets the signed cookies and renders the report:
   - **Embedded view:** Report HTML in a sandboxed iframe within the portal layout, feedback panel alongside
   - **Full-tab view (recommended for these reports):** Opens `/report/{spaceId}/{reportId}` in a new browser tab — a dedicated route in the React SPA that renders: the report in a full-viewport iframe (no sidebar, no nav, no portal chrome), a minimal floating toolbar (report title, "Back to portal" link, "Feedback" toggle button), and a slide-out feedback overlay when toggled. The full-tab route still validates auth (JWT in memory or httpOnly cookie) and still uses the same signed cookies for CloudFront access
5. CloudFront validates the signed cookie → OAC fetches from S3 → HTML report renders in iframe
6. Analytics tracking JS (injected via CloudFront Function or embedded in the portal page) captures page views, clicks, and time-on-page — works in both embedded and full-tab modes

**Session expiry handling (CRITICAL):**
- When the 3-hour signed cookie expires, CloudFront returns 403
- The portal/full-tab page detects this (iframe error or fetch failure) and shows a friendly overlay message: "Your session has expired. Please return to the main portal to re-authenticate and reopen this report."
- Include a "Go to portal" button that navigates to the main portal login
- Do NOT auto-refresh or silently re-authenticate — require the user to go back through the portal for security
- In full-tab view, the expired state should be obvious (overlay blocking the report content, not a subtle toast)

**Why signed cookies over presigned URLs:** Signed cookies cover the entire customer space path, so reports with relative asset references (images, CSS, JS within the HTML) all work without needing individual presigned URLs for each asset.

### iframe Security for HTML Reports (MANDATORY)

Reports are rich, interactive, single-file HTML documents. A typical report is ~4,000+ lines with:
- **Internal tab navigation** (variable number of tabs per report) — uses hash-based routing (e.g., `#tab-executive`, `#tab-risk`). Each report defines its own tabs — there is no fixed schema
- **Mermaid architecture diagrams** — dynamically rendered via imported CDN script (`cdn.jsdelivr.net/npm/mermaid`)
- **Light/dark theme toggle** — JS-driven theme switching
- **Tables, score cards, heatmaps, gauges** — all CSS/JS driven within the single HTML file
- **Print-optimised CSS** — `@media print` styles for PDF export

This means the iframe **must allow scripts and same-origin** for the report to function. Apply the following security layers:

- iframe `sandbox` attribute: `sandbox="allow-scripts allow-same-origin"` — allows JS execution (needed for tabs, Mermaid, theme toggle) and same-origin access (needed for hash navigation). Blocks forms, popups, top-navigation, downloads, pointer-lock, and modals
- iframe `allow` attribute: restrict to minimum — no camera, microphone, geolocation, payment, USB, etc.
- **Content Security Policy** on the CloudFront report-serving distribution: `default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; frame-ancestors 'self' https://*.yourdomain.com; connect-src 'self'`
  - Note: `script-src` must include `cdn.jsdelivr.net` for Mermaid rendering. If reports reference other CDNs, add them to the CSP
- Reports served from a **separate CloudFront distribution** (or separate origin/domain) from the portal SPA — so even if report HTML is malicious, it cannot access portal cookies, session, or localStorage
- On upload, run a server-side HTML sanitiser (e.g., OWASP Java HTML Sanitizer) in **allowlist mode** — strip `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`, event handler attributes that reference external URLs (`fetch`, `XMLHttpRequest`, `sendBeacon`), and any `<script src="">` pointing outside the allowed CDN list. **Do NOT strip** inline `<script>` blocks, `<style>` blocks, Mermaid code blocks, or hash-based navigation — these are essential for the report to function. Warn the admin if content was modified, showing a diff summary
- Full-tab view renders the report in a **full-viewport iframe** (`width:100%; height:100vh; border:none`) — the report's own tab navigation becomes the primary UI, which is the intended experience for these complex documents

### CORS Configuration

- **API Gateway:** Enable CORS with `Access-Control-Allow-Origin` set to the specific portal domain(s) only (not `*`). Allow methods: GET, POST, PUT, DELETE, OPTIONS. Allow headers: Authorization, Content-Type, X-Amz-Date
- **CloudFront (report serving):** CORS headers for the report iframe to load from the report-serving CloudFront distribution into the portal SPA domain
- CDK must configure CORS on both API Gateway and CloudFront — this is a guaranteed blocker if missed

---

## Role Model

### Super Admin

- **Pre-seeded on first deployment**: `shanaka.jayasundera@versent.com.au` with temporary password `Admin123!`
- Must reset password and configure MFA on first login
- **Email restriction: MUST be @versent.com.au** — reject any other domain
- Can:
  - **Impersonate any user** — assume the view of any admin or customer to see exactly what they see (read-only impersonation mode with a visible banner "Viewing as: user@email.com"). All impersonation sessions are recorded in the audit log
  - Create and manage customer spaces (which provisions a new S3 bucket)
  - Invite new admins (**invitation only, @versent.com.au emails only**)
  - Invite customers to customer spaces
  - Disable, delete, or reset MFA for any user
  - View full analytics dashboard
  - Upload reports to any customer space
  - View all audit logs
  - Manage WAF rules (via console, not in-app)

### Admin

- **Invitation only** — can ONLY be created by a super admin sending an invitation
- **Email restriction: MUST be @versent.com.au** — reject any other domain at both invitation time and registration
- Cannot self-register — there is no admin signup flow
- Can:
  - View and manage assigned customer spaces
  - Invite and manage customers/users in their assigned spaces (invite, disable, re-enable, delete, reset MFA)
  - Upload reports to customer spaces
  - View analytics for their assigned spaces
  - View audit logs for their assigned spaces
- Cannot:
  - **Invite or manage other admins** (only super admin can)
  - Impersonate users
  - Delete customer spaces
  - Access spaces they're not assigned to

### Customer

- **Invited by admin or super admin** to a specific customer space
- Accepts invitation → sets password → configures MFA → first login
- Can only access reports in their assigned customer space(s)
- Cannot upload, delete, or modify reports
- Full name, valid Australian phone number, and company name required at registration

---

## Customer Invitation Flow

1. Admin/super admin enters customer email and selects target customer space
2. **Domain mismatch warning**: If the customer's email domain doesn't match the customer space name, show a warning and require confirmation (e.g., inviting `user@aws.com` to "versent" space → warn). **Exception:** `@versent.com.au` emails never trigger the warning
3. System sends invitation email via **Amazon SES** with a time-limited link (24 hours expiry)
4. Customer clicks link → registration form (full name, Australian phone number, company, password)
5. Customer sets up MFA (mandatory)
6. On first successful login, the inviting admin receives an **in-app notification** (shown as a notification badge/bell icon in the admin portal header) AND an **email notification** via SES
7. All invitation and registration activity is recorded in the audit log

---

## Email Service — Amazon SES

- **Verified domain:** Configure SES with a verified sending domain (e.g., `noreply@reports.yourdomain.com`)
- **SES sandbox:** For dev/staging, SES starts in sandbox mode (verified recipients only). Prod requires production access request
- **Email templates** (stored in SES or as Lambda-rendered HTML):
  - `invitation-email` — "You've been invited to access reports on [space name]. Click here to register."
  - `admin-invitation-email` — "You've been invited as an admin to the Report Portal."
  - `first-login-notification` — "[Customer name] has logged in for the first time to [space name]."
  - `password-reset` — standard Cognito password reset (customise via Cognito message templates)
  - `mfa-reset-notification` — "Your MFA has been reset by an admin."
  - `feedback-new` — well-formatted HTML email: "[Customer name] left feedback on [report name] in [space name]". Includes: feedback subject, full message content (rendered HTML), report name with direct link to the thread in admin portal, customer name + company, timestamp. Styled with Versent branding
  - `feedback-reply` — "[Admin/Customer name] replied to feedback on [report name]". Same well-formatted layout as above with the reply content and a link to the full thread
  - `feedback-resolved` — "Feedback thread '[subject]' on [report name] has been marked as resolved by [admin name]"
- **Bounce/complaint handling:** Configure SES to publish bounces and complaints to an SNS topic → Lambda handler that marks users as `email_bounced` in DynamoDB
- All emails must include: unsubscribe link (for notifications only, not transactional), Versent branding, no-reply address

---

## Frontend — React + Vite + Tailwind CSS

**Tooling for both portals (admin + customer):**
- **React 18** with TypeScript
- **Vite** for build tooling (fast dev server, optimised production builds)
- **Tailwind CSS** for styling — utility-first, no custom CSS framework needed
- **shadcn/ui** for component library — accessible, composable, Tailwind-native components (buttons, dialogs, tables, forms, toasts, dropdowns)
- **React Router v6** for client-side routing
- **TanStack Query (React Query)** for server state management — handles caching, refetching, pagination, loading/error states
- **Axios** for HTTP client (interceptors for JWT refresh, error handling)
- **React Hook Form + Zod** for form validation
- **Recharts** for analytics dashboard charts
- **date-fns** for date formatting (lightweight, tree-shakeable)

**Auth UI:** Build a **custom auth UI** (not Cognito Hosted UI). The custom UI provides full control over branding, UX flow (especially the first-login + MFA setup journey), and impersonation banner rendering. Use the `amazon-cognito-identity-js` SDK or `@aws-amplify/auth` (auth module only, not full Amplify) to interact with Cognito directly from the frontend.

**Auth flow implementation:**
- Login page → call Cognito `initiateAuth` → if MFA required → show MFA input → call `respondToAuthChallenge` → receive tokens
- Store tokens in memory (not localStorage — XSS risk). Use a React context provider. Refresh token stored in httpOnly cookie if possible, otherwise in memory with auto-refresh
- On 401 response, attempt token refresh → if refresh fails, redirect to login
- First-login flow: detect `NEW_PASSWORD_REQUIRED` challenge → show password reset + MFA setup screens

**Notifications system (in-app):**
- Bell icon in admin portal header with unread count badge
- Notification dropdown showing recent events (customer first login, invitation accepted, etc.)
- Store notifications in DynamoDB (`PK: NOTIFICATION#{userId}`, `SK: {timestamp}`) with read/unread status
- Poll every 60 seconds via React Query, or use API Gateway WebSocket for real-time (Claude Code should decide based on complexity)

---

## Admin Portal (React SPA)

Served from a separate CloudFront distribution (or path-based routing).

### Features:
- **Login** — email + password + MFA
- **Dashboard** — overview of all customer spaces, recent activity
- **Customer Space Management:**
  - Create new space (provisions S3 bucket, sets up access policies)
    - **Info label on the space name field:** ℹ️ *"Use a name that matches your customer's email domain (e.g., 'versent' for @versent.com.au, 'woodside' for @woodside.com.au). This ensures customers can be invited without triggering domain mismatch warnings."*
    - Space name input should auto-suggest a sanitised version if admin types a domain (e.g., typing `woodside.com.au` auto-suggests `woodside`)
    - Validate: lowercase, alphanumeric + hyphens only, 3-50 chars, unique across all spaces
  - View existing spaces
  - Upload HTML reports to a space (drag-and-drop or file picker, max 50MB per file)
  - Delete reports from a space
- **User Management:**
  - Invite customers to spaces (with email domain mismatch warning — see Customer Invitation Flow)
  - View invited/active/disabled users per space
  - Disable, re-enable, delete users
  - Reset user MFA
  - Super admin only: invite new admins
- **Impersonation (Super Admin only):**
  - "View as" button next to each admin and customer user
  - Launches the appropriate portal (admin or customer) in impersonation mode
  - Persistent banner at top: "You are viewing as: {user name} ({user email}) — [Exit impersonation]"
  - Read-only mode — all write actions (upload, invite, delete, etc.) are disabled with tooltip "Disabled: impersonation mode is read-only"
  - All navigation and report views work identically to the impersonated user's actual experience
  - Impersonation start/end events recorded in audit log
- **Analytics Dashboard:**
  - Who accessed each space and when
  - Time spent on reports (per user, per report)
  - **Per-tab breakdown within each report** — dynamically rendered from whatever tabs the report contains (not a fixed column set). Show tab name + time spent as a breakdown chart. If a report has 3 tabs, show 3 rows. If another has 12, show 12 rows
  - Access frequency and patterns
  - Exportable data
- **Feedback Management:**
  - **Feedback inbox** — centralised view of all feedback threads across all spaces the admin has access to, sorted by most recent activity
  - Unread count badge on feedback inbox (like an email inbox)
  - Filter by: space, report, customer, status (open/resolved/archived)
  - Reply to customer feedback directly — threaded conversation, same rich text editor as customer side
  - Mark threads as **resolved** or **archived** (customer sees status change)
  - **Feedback broadcast:** When a customer posts new feedback, **all admins assigned to that space** receive: (1) an in-app notification with a preview of the feedback, (2) an SES email notification with the full feedback content, report name, customer name, and a direct link to the thread in the admin portal. Email is well-formatted HTML — not a plain text dump
  - Admin can also initiate a feedback thread on a report (proactive outreach — e.g., "Let us know if the Q3 numbers look correct")
  - Feedback threads are per-report, not per-space — so each report has its own conversation history
- **Report Viewer (Admin):**
  - Same two-mode viewer as customer (embedded + full-tab) so admins can see exactly what the customer sees
  - In admin view, feedback panel shows all threads for that report with customer names
- **Audit Log Viewer:**
  - All admin actions (invitations, uploads, deletions, user management)
  - All customer access events
  - Filterable by date, user, space, action type

---

## Customer Portal (React SPA)

Served via CloudFront (same or separate distribution).

### Features:
- **Login** — email + password + MFA
- **First login flow** — password reset + MFA setup if coming from invitation
- **Report Browser** — browse and open HTML reports in their assigned space(s)
- **Report Viewer — two modes:**
  - **Embedded view:** Report rendered in a sandboxed iframe within the portal layout, with the feedback/discussion panel alongside it (split view or collapsible side panel). Suitable for quick checks, but the portal's sidebar/header reduces available space for the report's own multi-tab navigation
  - **Full-tab view (recommended, default):** "Open report" button opens the report in a dedicated browser tab — clean, distraction-free, no portal navigation/sidebar/header. The report's own internal tab navigation (Executive Summary, Assessment, Risk Register, etc.) becomes the primary UI. Minimal floating toolbar in the corner containing: Versent logo, report title, "Back to portal" link, "Feedback" button (opens slide-out feedback overlay). Full-tab view still uses signed cookies for auth and still tracks analytics
  - Customer can toggle between views. Default is full-tab (better for these complex multi-tab reports)
  - **Session expiry UX:** When 3-hour signed cookie expires, show a full-screen overlay on the report: "Your viewing session has expired. Please return to the main portal to re-authenticate." with a prominent "Go to portal" button. Do not attempt silent re-auth — require explicit return to portal
- **Feedback & Discussion panel:**
  - Visible alongside each report (side panel in embedded view, overlay in full-tab view)
  - Threaded conversations per report — customer posts feedback, admins reply, back-and-forth in one place
  - Rich text input — bold, italic, bullet points, code blocks (use a lightweight editor like Tiptap or Lexical)
  - File attachments on feedback (screenshots, supporting docs) — stored in a dedicated feedback S3 bucket, max 10MB per attachment, image/PDF only
  - Each message shows: author name, role badge (Customer / Admin / Super Admin), timestamp, avatar initial
  - Unread indicator on reports that have new replies the customer hasn't seen
  - @mention support — customer can @mention to notify specific admins (optional, Claude Code decides if complexity is justified)
- **Responsive** — must work on mobile (Chrome 110+, Firefox 110+, Safari 16+, Edge 110+)

---

## Analytics Tracking

Track all user interactions for the analytics dashboard:

- Page views (which report, when, duration)
- **Internal tab navigation within reports (DYNAMIC — not hardcoded):** Each report has a different number and naming of tabs. The analytics system must:
  1. Listen for `hashchange` events from the report iframe (via `postMessage` bridge if cross-origin)
  2. Capture the raw hash value (e.g., `#tab-risk`, `#tab-executive`) as the tab identifier — do NOT map to a fixed list of known tabs
  3. Record: tab hash, human-readable label (extracted from the nav link text if available via postMessage, otherwise use the hash), time entered, time spent
  4. Store tab-level analytics per report per user, so the admin dashboard can show "User X spent 12 min on #tab-risk, 3 min on #tab-executive" — whatever tabs that particular report happens to have
  5. The analytics dashboard must dynamically render whatever tab names it finds in the data, not assume a fixed set of columns
- Session duration (per report, per internal tab)
- Device type, browser
- Login/logout events
- Download attempts (if applicable)
- Report view mode used (embedded vs full-tab)

**Implementation:** Inject a lightweight analytics bridge script into the portal's iframe wrapper page (NOT into the report HTML itself). This script:
- Listens for `hashchange` on the iframe's `contentWindow` (if same-origin) or uses `postMessage` (if cross-origin)
- On each hash change: logs previous tab duration, starts timer for new tab
- Batches analytics events and sends via `navigator.sendBeacon` to the analytics API endpoint every 30 seconds or on page `beforeunload`
- Falls back gracefully if the report doesn't use hash-based navigation (just tracks overall report view time)

Store in DynamoDB with TTL-based retention (1 year active, then archive to S3 Glacier).

**Privacy:** Users must consent to analytics tracking at first login. Show consent banner. Record consent in user profile.

---

## Audit Logging

All actions are recorded:

- Admin: login, invite, upload, delete, user management actions
- Customer: login, report access, session events
- Feedback: thread created, reply posted, status changed (open/resolved/archived), attachment uploaded
- **Impersonation: session start (who impersonated whom), all pages/reports viewed during impersonation, session end**
- System: space creation, bucket provisioning, WAF events

Store in DynamoDB (2 years active, then archive to S3 Glacier).

Include: timestamp, actor (user ID + email), action, target resource, IP address, user agent, result (success/failure).

---

## API Design

### Auth Endpoints
- `POST /auth/login` — Cognito auth flow
- `POST /auth/mfa-verify` — MFA verification
- `POST /auth/forgot-password` — password reset flow
- `POST /auth/change-password` — authenticated password change
- `POST /auth/first-login` — first login flow (password reset + MFA setup)

### Admin Endpoints (requires admin or super_admin role)
- `GET /admin/spaces?cursor={cursor}&limit={limit}` — list customer spaces (paginated, default limit=20, max 100)
- `POST /admin/spaces` — create new customer space
- `DELETE /admin/spaces/{spaceId}` — delete space (super_admin only)
- `POST /admin/spaces/{spaceId}/reports` — upload report (presigned URL flow)
- `DELETE /admin/spaces/{spaceId}/reports/{reportId}` — delete report
- `GET /admin/spaces/{spaceId}/reports?cursor={cursor}&limit={limit}` — list reports in space (paginated)
- `POST /admin/spaces/{spaceId}/invite` — invite customer to space
- `GET /admin/users?role={role}&spaceId={spaceId}&cursor={cursor}&limit={limit}` — list users (paginated, filterable)
- `PUT /admin/users/{userId}/disable` — disable user
- `PUT /admin/users/{userId}/enable` — re-enable user
- `DELETE /admin/users/{userId}` — delete user
- `PUT /admin/users/{userId}/reset-mfa` — reset user MFA

### Super Admin Only Endpoints
- `POST /admin/invite-admin` — invite new admin (versent.com.au only)
- `POST /admin/impersonate/{userId}` — start impersonation session (returns scoped JWT with impersonated user's permissions + `impersonator` claim). Read-only: no write/delete/invite actions allowed while impersonating
- `DELETE /admin/impersonate` — end impersonation session, return to super admin context

### Customer Endpoints (requires customer role)
- `GET /customer/spaces` — list assigned spaces
- `GET /customer/spaces/{spaceId}/reports?cursor={cursor}&limit={limit}` — list reports (paginated)
- `GET /customer/spaces/{spaceId}/reports/{reportId}` — get report (returns signed cookies + CloudFront URL)
- `PUT /customer/preferences` — update user preferences (view mode: embedded/full-tab, notification settings)

### Notification Endpoints (authenticated users)
- `GET /notifications?unreadOnly={bool}&cursor={cursor}&limit={limit}` — list notifications (paginated)
- `PUT /notifications/{notificationId}/read` — mark notification as read
- `PUT /notifications/read-all` — mark all notifications as read
- `GET /notifications/count` — get unread notification count (lightweight endpoint for polling)

### Feedback Endpoints (authenticated users — customers and admins)
- `GET /spaces/{spaceId}/reports/{reportId}/feedback?cursor={cursor}&limit={limit}` — list feedback threads for a report (paginated). Returns threads with latest message preview and unread count
- `POST /spaces/{spaceId}/reports/{reportId}/feedback` — create new feedback thread (body: `{ subject, message, attachments[] }`)
- `GET /feedback/threads/{threadId}?cursor={cursor}&limit={limit}` — get full thread with all messages (paginated)
- `POST /feedback/threads/{threadId}/reply` — reply to a thread (body: `{ message, attachments[] }`)
- `PUT /feedback/threads/{threadId}/status` — update thread status: `open`, `resolved`, `archived` (admin/super_admin only)
- `POST /feedback/threads/{threadId}/attachments` — upload attachment (returns presigned PUT URL to feedback S3 bucket, max 10MB, image/PDF only)
- `GET /admin/feedback/inbox?spaceId={id}&status={status}&cursor={cursor}&limit={limit}` — admin feedback inbox across all assigned spaces (paginated, filterable)
- `GET /admin/feedback/inbox/count` — unread feedback count across all spaces (for badge)

**Feedback notification flow (AWS-native):**
1. Customer posts feedback → Lambda writes to DynamoDB → publishes event to **Amazon EventBridge**
2. EventBridge rule matches `feedback.new` or `feedback.reply` events → triggers **notification Lambda**
3. Notification Lambda: (a) writes in-app notifications to DynamoDB for all admins assigned to the space, (b) sends formatted HTML email via **SES** to each admin with report name, customer name, feedback preview, and direct link
4. When admin replies → same flow in reverse: EventBridge → notification Lambda → in-app notification + SES email to the customer
5. All feedback activity recorded in audit log

### Analytics Endpoints (admin/super_admin)
- `GET /admin/analytics/spaces/{spaceId}?from={date}&to={date}` — space analytics (date-filtered)
- `GET /admin/analytics/users/{userId}?from={date}&to={date}` — user analytics (date-filtered)
- `POST /admin/analytics/export` — export analytics data (returns presigned URL to CSV/JSON file in S3)

### Audit Endpoints (admin/super_admin)
- `GET /admin/audit-log?actor={userId}&action={type}&spaceId={id}&from={date}&to={date}&cursor={cursor}&limit={limit}` — query audit log (paginated, filterable)

**Pagination standard:** All paginated endpoints use cursor-based pagination (DynamoDB `LastEvaluatedKey` encoded as opaque base64 cursor). Response format:
```json
{
  "items": [...],
  "nextCursor": "base64encodedkey",
  "hasMore": true
}
```

---

## Backend — Java 21 + Spring Boot 3 + Lambda SnapStart

**Framework:** Spring Boot 3 with Spring Cloud Function for AWS Lambda integration.

**Why Spring Boot 3:**
- Spring Security provides role-based access, JWT validation, and custom authorisation filters out of the box — critical for impersonation, admin vs super_admin enforcement, and per-space access control
- Best ecosystem support for Cognito, DynamoDB, S3, SES via AWS SDK v2 + Spring Cloud AWS
- SnapStart eliminates the cold start penalty — ~200-300ms cold starts with full Spring context

**Key dependencies:**
- `spring-cloud-function-adapter-aws` — Lambda adapter
- `spring-cloud-aws-starter-dynamodb` — DynamoDB enhanced client
- `spring-cloud-aws-starter-s3` — S3 presigned URLs
- `spring-cloud-aws-starter-ses` — SES email sending
- `software.amazon.awssdk:cognitoidentityprovider` — Cognito admin operations
- `software.amazon.awssdk:eventbridge` — EventBridge event publishing
- `spring-boot-starter-security` — Security filters, JWT validation
- `spring-boot-starter-validation` — Input validation (Jakarta Bean Validation)
- `owasp-java-html-sanitizer` — HTML report sanitisation on upload + feedback message sanitisation

**Lambda packaging strategy:**
- One Lambda per domain function group: `auth-function`, `admin-function`, `customer-function`, `feedback-function`, `analytics-function`, `audit-function`, `notification-function` (EventBridge target for async notification delivery)
- Each Lambda is a Spring Boot app with Spring Cloud Function exposing the relevant handler
- **SnapStart enabled** on all Lambda functions via CDK configuration
- Shared library module for: DynamoDB entity models, security utilities, SES email service, common DTOs

**Runtime details:**
- **Java 21** with **Lambda SnapStart** enabled on all functions
- **DynamoDB client:** AWS SDK v2 enhanced client with Spring Cloud AWS auto-configuration
- **S3 operations:** presigned URLs for upload/download (never pass report bytes through Lambda). Upload flow: Lambda generates presigned PUT URL → frontend uploads directly to S3 → Lambda records metadata in DynamoDB
- **Cognito operations:** Admin SDK for user management (create user, disable, reset MFA, etc.)
- **Input validation:** Jakarta Bean Validation on all request DTOs. Sanitise HTML report content server-side on upload
- **Error handling:** `@ControllerAdvice` global exception handler returning structured JSON error responses. Never leak stack traces or internal paths
- **Impersonation support:** Custom Spring Security filter that detects `impersonator` claim in JWT, sets `SecurityContext` with impersonated user's authorities, and injects a `readOnly=true` flag. A second filter intercepts all POST/PUT/DELETE requests and rejects them with 403 when `readOnly=true`
- **Logging:** Structured JSON logging (Logback + logstash-logback-encoder) with correlation IDs for X-Ray tracing

---

## Infrastructure — CDK v2 (TypeScript)

All infrastructure defined in CDK. Key stacks/constructs:

- **Auth Stack:** Cognito User Pool, App Clients, custom attributes, pre-signup Lambda trigger (email domain validation)
- **Storage Stack:** S3 bucket factory (creates per-customer buckets), feedback attachments bucket, KMS keys, audit bucket
- **API Stack:** API Gateway, Lambda functions, Cognito authoriser, CORS configuration
- **Events Stack:** EventBridge custom event bus (`report-portal-events`), rules for feedback notifications, target Lambda functions
- **Frontend Stack:** CloudFront distributions (portal + report-serving), S3 static site buckets, OAC
- **Security Stack:** WAF WebACL, WAF rules, security headers policy, CloudFront signed cookie key pairs
- **Email Stack:** SES verified domain, email templates (including feedback templates), bounce/complaint SNS topic + handler Lambda
- **Monitoring Stack:** CloudWatch dashboards, alarms, X-Ray configuration

### Cognito Pre-Signup Trigger (CRITICAL)

Lambda trigger on Cognito that enforces:
- For `super_admin` and `admin` roles: email domain MUST be `@versent.com.au` — reject otherwise
- For `admin` role: must have a valid invitation token — reject self-signup
- For `customer` role: must have a valid invitation token — reject self-signup
- Log all signup attempts (success and rejection) to audit log

---

## Data Model (DynamoDB)

### Tables:

**Users Table** — `PK: USER#{userId}`, `SK: PROFILE`
- email, fullName, phone, company, role, customerSpaces[], invitedBy, status, mfaEnabled, createdAt, lastLogin, analyticsConsent, preferredViewMode (embedded/full-tab, default: **full-tab**)

**Spaces Table** — `PK: SPACE#{spaceId}`, `SK: META`
- spaceName, s3BucketName, createdBy, createdAt, status
- GSI: `spaceName-index` for lookup by name

**Reports Table** — `PK: SPACE#{spaceId}`, `SK: REPORT#{reportId}`
- fileName, s3Key, uploadedBy, uploadedAt, fileSize, status

**Invitations Table** — `PK: INVITE#{token}`, `SK: META`
- email, targetSpaceId, role, invitedBy, createdAt, expiresAt, status, acceptedAt
- TTL on expiresAt for automatic cleanup

**AuditLog Table** — `PK: AUDIT#{date}`, `SK: {timestamp}#{eventId}`
- actor, action, target, ipAddress, userAgent, result, metadata
- TTL for archival (2 years)

**Analytics Table** — `PK: ANALYTICS#{spaceId}#{date}`, `SK: {timestamp}#{eventId}`
- userId, reportId, eventType (report_open, tab_view, report_close, session_heartbeat), tabHash (e.g., `#tab-risk`), tabLabel (human-readable, e.g., "Risk Register" — extracted from nav link text if available), durationSeconds, viewMode (embedded/full-tab), device, browser, metadata
- TTL for archival (1 year)
- GSI: `report-analytics-index` — PK: `REPORT#{spaceId}#{reportId}`, SK: `{timestamp}` (for per-report analytics queries)

**Notifications Table** — `PK: NOTIFICATION#{userId}`, `SK: {timestamp}#{notificationId}`
- type (invitation_accepted, first_login, mfa_reset, report_uploaded, feedback_new, feedback_reply, etc.), message, relatedSpaceId, relatedUserId, relatedThreadId, read (boolean), createdAt
- GSI: `unread-index` — PK: `NOTIFICATION#{userId}`, SK: `createdAt`, filter: `read = false` (for fast unread count)
- TTL: 90 days (notifications auto-expire)

**FeedbackThreads Table** — `PK: THREAD#{threadId}`, `SK: META`
- spaceId, reportId, subject, status (open/resolved/archived), createdBy (userId), createdByRole, createdAt, lastMessageAt, lastMessageBy, messageCount, unreadByAdmin (boolean), unreadByCustomer (boolean)
- GSI: `report-threads-index` — PK: `REPORT#{spaceId}#{reportId}`, SK: `lastMessageAt` (for listing threads per report, sorted by recent activity)
- GSI: `space-threads-index` — PK: `SPACE#{spaceId}`, SK: `lastMessageAt` (for admin inbox filtered by space)
- GSI: `status-index` — PK: `STATUS#{status}`, SK: `lastMessageAt` (for filtering by open/resolved/archived)

**FeedbackMessages Table** — `PK: THREAD#{threadId}`, `SK: MSG#{timestamp}#{messageId}`
- authorId, authorName, authorRole (customer/admin/super_admin), message (rich text stored as HTML), attachments[] (S3 keys), createdAt, editedAt
- Messages are append-only — no editing or deleting (audit integrity)

**Feedback Attachments S3 Bucket:**
- Dedicated bucket: `report-portal-feedback-{account-id}-{region}`
- Key pattern: `{spaceId}/{threadId}/{messageId}/{filename}`
- Max 10MB per file, allowed types: image/png, image/jpeg, image/gif, application/pdf
- Server-side encryption with KMS
- Lifecycle rule: move to Glacier after 2 years
- Served via presigned GET URLs (not CloudFront — low traffic, no caching needed)

---

## Deployment

- **CDK deploy** provisions all infrastructure
- **Super admin seeded** via Cognito admin API during deployment (post-deploy script in CDK custom resource)
- **SES setup:** Domain verification via CDK (Route53 records if custom domain used). Dev/staging use SES sandbox with verified test emails
- **CI/CD:** GitHub Actions — lint, test, build, cdk synth, cdk deploy
- **Environments:** dev, staging, prod (parameterised via CDK context)

---

## Testing Strategy

### Backend (Java / Spring Boot 3)
- **Unit tests:** JUnit 5 + Mockito for all service classes, security filters, and validators. Minimum 80% coverage on business logic
- **Integration tests:** `@SpringBootTest` with DynamoDB Local (Docker) for repository layer testing. Use Testcontainers for DynamoDB Local
- **Security tests:** Dedicated test class verifying: admin cannot access super_admin endpoints, customer cannot access admin endpoints, impersonation JWT is rejected on write operations, non-versent.com.au emails are rejected for admin/super_admin roles, expired invitation tokens are rejected, customer cannot access feedback threads in spaces they're not assigned to, feedback attachments reject files over 10MB and non-image/PDF types
- **Contract tests:** Validate API request/response DTOs match the API specification above

### Frontend (React)
- **Unit tests:** Vitest + React Testing Library for component logic
- **Integration tests:** Test auth flows (login → MFA → dashboard), impersonation banner rendering, role-based menu visibility
- **E2E tests (optional but recommended):** Playwright against a deployed dev environment — test the full invitation → registration → first login → report viewing flow

### Infrastructure
- **CDK assertions:** `aws-cdk-lib/assertions` to verify WAF rules exist, S3 buckets have encryption/block-public-access, Lambda has SnapStart enabled, CORS is configured
- **Snapshot tests:** CDK snapshot tests to catch unintended infrastructure drift

---

## Local Development Setup

**Backend:**
- **SAM CLI** (`sam local start-api`) for running Lambda functions locally with hot reload
- **DynamoDB Local** via Docker (`amazon/dynamodb-local`) for database operations
- **LocalStack** (optional) for S3, SES, and Cognito emulation — or use a shared dev AWS account with isolated resources
- Maven wrapper (`./mvnw`) for build consistency
- `.env.local` file for local config (Cognito pool ID, DynamoDB endpoint override, etc.)

**Frontend:**
- `npm run dev` → Vite dev server with hot module replacement
- Proxy API calls to either SAM local (`http://localhost:3001`) or the deployed dev API Gateway
- `.env.development` for local API endpoint and Cognito config
- Mock auth context for developing UI without Cognito (bypass login in dev mode with a mock JWT)

**Docker Compose (recommended):**
- `docker-compose.yml` in repo root that starts: DynamoDB Local (port 8000), SAM CLI API (port 3001), and optionally LocalStack
- Frontend dev server runs natively via `npm run dev`

---

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Max concurrent users | 100 |
| Max customer spaces | 200 |
| Max report file size | 50 MB per HTML file |
| Report load time | < 3 seconds |
| API response time | < 500ms (p95) |
| Availability | 99.9% |
| Browser support | Chrome 110+, Firefox 110+, Safari 16+, Edge 110+ |
| Mobile | Responsive — customer portal must be usable on mobile |
| Data retention (audit) | 2 years active, then S3 Glacier |
| Data retention (analytics) | 1 year active, then S3 Glacier |

---

## Open Items

| # | Item | Default |
|---|------|---------|
| 1 | Custom domain names | `reports.yourdomain.com` (customer), `admin.yourdomain.com` (admin) |
| 2 | Per-space branding | Logo + primary colour configurable per space |
| 3 | Invitation link expiry | 24 hours, admin can resend |
| 4 | Session concurrency | Allow multiple sessions (one per device) |
| 5 | AWS region | ap-southeast-2 (Sydney) |
| 6 | SES sending domain | `noreply@reports.yourdomain.com` (requires DNS verification) |
| 7 | Notification delivery | Polling (60s) vs WebSocket — Claude Code decides based on complexity |
| 8 | Signed cookie TTL | **3 hours** per report viewing session. On expiry: block report with re-auth overlay, no silent refresh |

---

## Key Constraints for Claude Code

1. **Security is the priority** — WAF, encryption, isolation, least privilege everywhere
2. **AWS-native services only** — no third-party SaaS. Use EventBridge (not Twilio/SendGrid), SES (not Mailgun), DynamoDB (not MongoDB Atlas), CloudFront (not Cloudflare), Cognito (not Auth0). Zero external dependencies
3. **Admins and super admins: @versent.com.au emails ONLY** — enforce at Cognito trigger level AND application level (double validation)
4. **Admins are invitation-only from super admin** — no self-registration for admin role. Admins can manage/invite customers but NOT other admins
5. **Super admin impersonation** — super admin can assume any user's view (read-only) to see exactly what they see. Full audit trail on all impersonation sessions
6. **Per-customer S3 bucket** — not subfolders, full bucket isolation
7. **Java 21 + Spring Boot 3 + Spring Cloud Function + Lambda SnapStart** — do NOT use Quarkus or Micronaut
8. **CDK v2 TypeScript** for all infrastructure — no CloudFormation YAML, no Terraform, no SAM templates for infra
9. **React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui** for both portals. Custom auth UI (not Cognito Hosted UI)
10. **Report viewing: full-tab is the default** — reports are complex multi-tab HTML documents (~4,000+ lines with variable number of internal tabs, Mermaid diagrams, theme toggle). Full-tab view gives the report's own navigation full viewport. Embedded view available as alternative. 3-hour signed cookie TTL. On expiry: show re-auth overlay, require return to portal — no silent refresh
11. **Feedback & discussion system** — threaded conversations per report, rich text, file attachments. EventBridge-driven notifications to all space admins (in-app + well-formatted SES email). Admins reply from admin portal, customers reply from customer portal. No back-and-forth emails needed
12. **Report serving via CloudFront signed cookies (3-hour TTL)** — not presigned S3 URLs. Reports rendered in sandboxed iframe with CSP that allows Mermaid CDN and inline scripts (required for report functionality)
13. **All list endpoints must be paginated** — cursor-based pagination using DynamoDB LastEvaluatedKey
14. **Amazon SES** for all emails (invitations, feedback notifications, password resets). Well-formatted HTML email templates with Versent branding
15. **Amazon EventBridge** for async event-driven workflows (feedback notifications, first-login notifications)
16. **CORS must be explicitly configured** on API Gateway and CloudFront
17. **You decide the folder structure** — organise the monorepo however produces the cleanest, most maintainable result
18. **Include tests** — JUnit 5 + Mockito for backend, Vitest + React Testing Library for frontend, CDK assertions for infrastructure
19. **Include local dev setup** — Docker Compose with DynamoDB Local + SAM CLI
20. **Strip all metadata** — author: "Shanaka Jayasundera", email: "shanaka.jayasundera@versent.com.au", company: "Versent". Remove all library/tool fingerprints from generated files
21. **No commits from Claude** — all git commits must be authored by `shanaka-versent`. Never add Co-Authored-By lines or reference AI/Claude in commit messages
22. **Back-port fixes to automation scripts** — when manually fixing any issue during development, always update the relevant automation/setup scripts so the fix is included in future deployments and the issue does not recur

---

*Version 1.6 — Shanaka Jayasundera, Versent — March 2026*
