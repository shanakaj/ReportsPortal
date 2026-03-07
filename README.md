# Secure Report Portal

A security-first, multi-tenant AWS serverless application for delivering HTML reports to customers. Each customer has an isolated space with a dedicated S3 bucket. Reports are served via CloudFront with signed cookies, authenticated through API Gateway + Cognito.

## What It Does

Secure Report Portal enables consultancies and service providers to securely deliver HTML-based reports (assessments, audits, reviews) to their customers through a branded, self-service web portal.

### The Problem

Delivering sensitive reports to customers typically involves emailing attachments, sharing links to shared drives, or using generic file-sharing tools. These approaches lack access control, audit trails, and professional presentation.

### The Solution

Report Portal provides a dedicated, secure channel where:

- **Admins** (the service provider) create isolated customer spaces, upload HTML reports, and invite customers
- **Customers** log in with MFA, browse their reports in a clean portal, and provide feedback directly within the platform
- **Super Admins** manage the entire platform, invite other admins, and monitor usage via analytics and audit logs

### Key Business Capabilities

| Capability | Description |
|-----------|-------------|
| **Customer Spaces** | Each customer gets an isolated space with its own S3 bucket. No cross-customer data leakage is possible. |
| **Report Delivery** | Upload HTML reports (with embedded charts, tables, Mermaid diagrams) that customers view in a sandboxed iframe. |
| **Invitation-Only Access** | No self-registration. Admins invite customers by email; invitations expire after 24 hours. |
| **MFA-Enforced Login** | Every user must set up TOTP (authenticator app) on first login. No exceptions. |
| **Feedback System** | Customers can submit feedback on reports with file attachments. Admins receive email + in-app notifications. Threaded conversations with status tracking (open/in-progress/resolved). |
| **Audit Trail** | Every action (login, report view, upload, user change) is logged with 2-year retention. |
| **Analytics** | Track report views, active users, and engagement per space. Export analytics data for reporting. |
| **Impersonation** | Super admins can impersonate customers (read-only) for support and troubleshooting. |
| **Role-Based Access** | Three roles (Super Admin, Admin, Customer) with fine-grained permissions. Admins are scoped to their assigned spaces. |

### Typical Workflow

```mermaid
flowchart LR
    A["1. Super Admin\ncreates space"] --> B["2. Admin uploads\nHTML report"]
    B --> C["3. Admin invites\ncustomer by email"]
    C --> D["4. Customer accepts\n& sets up MFA"]
    D --> E["5. Customer views\nreports via\nsigned cookies"]
    E --> F["6. Customer submits\nfeedback on report"]
```

## Architecture

### System Overview

```mermaid
flowchart TB
    subgraph Users["Users"]
        SA["Super Admin\n(@versent.com.au)"]
        AD["Admin\n(@versent.com.au)"]
        CU["Customer\n(Invited Only)"]
    end

    subgraph Edge["AWS Edge Layer"]
        WAF["AWS WAF\n---\nCore Rule Set\nKnown Bad Inputs\nBot Control\nRate Limiting\nGeo-restriction"]
        CF["CloudFront Distribution\n---\n/ -> SPA\n/api/* -> API Gateway\n/reports/* -> Report S3\nSigned Cookies (3hr TTL)"]
    end

    subgraph Auth["Authentication"]
        Cognito["Cognito User Pool\n---\nMFA Required (TOTP)\nPassword: 12+ chars\nInvitation-only signup"]
    end

    subgraph API["API Layer"]
        APIGW["API Gateway (REST)\n---\nCognito Authorizer\nCORS configured"]
    end

    subgraph Compute["Compute - Java 21 + Spring Boot 3"]
        AuthFn["Auth Function"]
        AdminFn["Admin Function"]
        CustFn["Customer Function"]
        FeedFn["Feedback Function"]
        AnalyticsFn["Analytics Function"]
        AuditFn["Audit Function"]
        NotifFn["Notification Function"]
    end

    subgraph Storage["Data Layer"]
        DDB["DynamoDB\n9 Tables\nKMS Encrypted"]
        S3B["S3 Buckets\nPer-customer isolation\nKMS Encrypted"]
    end

    subgraph Events["Event-Driven"]
        EB["EventBridge"]
        SES["Amazon SES"]
    end

    SA & AD & CU --> WAF --> CF
    CF --> APIGW
    CF -->|"OAC"| S3B
    APIGW <-->|"JWT"| Cognito
    APIGW --> AuthFn & AdminFn & CustFn & FeedFn & AnalyticsFn & AuditFn
    AuthFn & AdminFn & CustFn & FeedFn & AnalyticsFn & AuditFn --> DDB
    AdminFn & CustFn --> S3B
    FeedFn & AdminFn --> EB
    EB --> NotifFn --> SES

    classDef edge fill:#ff9900,stroke:#232f3e,color:#fff
    classDef compute fill:#ed7100,stroke:#232f3e,color:#fff
    classDef storage fill:#3b48cc,stroke:#232f3e,color:#fff
    classDef event fill:#e7157b,stroke:#232f3e,color:#fff
    classDef auth fill:#dd344c,stroke:#232f3e,color:#fff

    class WAF,CF edge
    class AuthFn,AdminFn,CustFn,FeedFn,AnalyticsFn,AuditFn,NotifFn compute
    class DDB,S3B storage
    class EB,SES event
    class Cognito,APIGW auth
```

### CDK Stacks

The infrastructure is organized into 9 CDK stacks with explicit dependencies:

```mermaid
flowchart LR
    subgraph Sydney["ap-southeast-2"]
        Auth["AuthStack\nCognito + Triggers"]
        Storage["StorageStack\n9 DDB Tables + S3 + KMS"]
        Events["EventsStack\nEventBridge Bus"]
        Email["EmailStack\nSES + Bounce Handler"]
        Api["ApiStack\n7 Lambdas + API GW"]
        Frontend["FrontendStack\nCloudFront + S3 Hosting"]
        Monitoring["MonitoringStack\nDashboard + Alarms"]
    end

    subgraph Virginia["us-east-1"]
        Security["SecurityStack\nWAF WebACL"]
    end

    OIDC["GitHubOIDC Stack\nOIDC Provider + Deploy Role"]

    Auth --> Api
    Storage --> Api
    Events --> Api
    Security --> Frontend
    Api --> Frontend
    Api --> Monitoring

    classDef sydney fill:#ff9900,stroke:#232f3e,color:#fff
    classDef virginia fill:#dd344c,stroke:#232f3e,color:#fff
    classDef oidc fill:#2ea44f,stroke:#232f3e,color:#fff

    class Auth,Storage,Events,Email,Api,Frontend,Monitoring sydney
    class Security virginia
    class OIDC oidc
```

### Authentication Flow

```mermaid
flowchart TD
    Login["Login\n(email + password)"] --> SRP["Cognito SRP Auth"]
    SRP -->|NEW_PASSWORD_REQUIRED| FirstLogin["Set New Password\n(12+ chars)"]
    FirstLogin --> MFASetup["MFA Setup\nScan QR Code"]
    MFASetup --> Verify1["Enter TOTP Code"]
    Verify1 --> Dashboard

    SRP -->|SOFTWARE_TOKEN_MFA| MFAVerify["Enter TOTP Code"]
    MFAVerify --> Dashboard["Dashboard\n(Admin or Customer)"]

    Dashboard --> APICall["API Call\n(ID token in Authorization header)"]
    APICall -->|200| Success["Response"]
    APICall -->|401| Refresh["Cognito SDK\nrefreshSession()"]
    Refresh -->|New ID token| Retry["Retry API Call"]
    Refresh -->|Failed| Logout["Clear tokens\nRedirect to login"]

    style Login fill:#ff9900,stroke:#232f3e,color:#fff
    style Dashboard fill:#2ea44f,stroke:#232f3e,color:#fff
    style Logout fill:#dd344c,stroke:#232f3e,color:#fff
```

Key details:
- **ID token** (not access token) is used for API calls — it contains `custom:role` and `custom:customer_space` claims
- **Token refresh** uses Cognito SDK client-side (`refreshSession()`), not a backend endpoint
- **JwtAuthenticationFilter** in each Lambda validates the JWT signature, extracts claims, and populates `SecurityContext` via ThreadLocal
- **SecurityContext** is always cleared in a `finally` block to prevent ThreadLocal leaks

### Report Viewing Flow

```mermaid
sequenceDiagram
    actor Customer
    participant Frontend
    participant API Gateway
    participant Lambda
    participant CloudFront
    participant S3

    Customer->>Frontend: Click report
    Frontend->>API Gateway: GET /api/customer/spaces/{id}/reports/{id}
    API Gateway->>Lambda: Validate JWT + space access
    Lambda->>Lambda: Generate signed cookies (3hr TTL)
    Lambda->>Frontend: Metadata + signed cookies
    Frontend->>CloudFront: Load report HTML via /reports/* (with signed cookies)
    CloudFront->>S3: Fetch from customer bucket (OAC)
    S3-->>CloudFront: Report HTML
    CloudFront-->>Frontend: Report HTML
    Frontend->>Frontend: Render in sandboxed iframe
```

### Feedback & Notification Flow

```mermaid
sequenceDiagram
    actor Customer
    actor Admin
    participant API
    participant DynamoDB
    participant EventBridge
    participant Lambda as Notification Lambda
    participant SES

    Customer->>API: POST feedback (message + attachment)
    API->>DynamoDB: Store thread + message
    API->>EventBridge: Publish feedback.new
    EventBridge->>Lambda: Trigger
    Lambda->>DynamoDB: Create admin notification
    Lambda->>SES: Send email to space admins
    SES-->>Admin: Email notification

    Admin->>API: POST reply to thread
    API->>DynamoDB: Store reply
    API->>EventBridge: Publish feedback.reply
    EventBridge->>Lambda: Trigger
    Lambda->>SES: Send email to customer
```

## CI/CD Pipeline

All CI/CD runs through GitHub Actions. No local deployment scripts are needed — `scripts/deploy.sh` is a thin wrapper that triggers the GitHub Actions workflow.

### Pipeline Architecture

```mermaid
flowchart TD
    subgraph FEATURE["Feature Branch"]
        PR["PR to main"]
    end

    subgraph MAIN["main Branch"]
        MERGE["Push / Merge"]
        MANUAL["Manual Trigger"]
    end

    PR -->|"CI only"| CI
    MERGE -->|"CI only"| CI
    MANUAL -->|"CD"| CD

    subgraph CI["CI - Continuous Integration (ci.yml)"]
        direction LR
        BE_CI["Backend\nmvn package + JUnit 5\n40+ unit tests"]
        FE_CI["Frontend\nESLint + Vitest + build"]
        INFRA_CI["Infrastructure\nCDK compile + Jest\n50+ assertions"]
    end

    subgraph CD["CD - Continuous Deployment (deploy.yml)"]
        direction TB
        CDK_DEPLOY["1. Deploy Infra\nBuild Lambda JARs\nCDK deploy all stacks"]
        CDK_DEPLOY -->|"Cognito IDs\nCloudFront domain"| FE_BUILD
        FE_BUILD["2. Build Frontend\nInject env from CDK outputs\nnpm run build"]
        FE_BUILD --> FE_DEPLOY
        FE_DEPLOY["3. Ship Frontend\nS3 sync + CF invalidation"]
    end

    subgraph VERIFY["Verify - Post-Deploy"]
        direction LR
        API_TEST["API Smoke Tests\nHeaders, auth, WAF"]
        E2E_TEST["Playwright E2E\n7 scenarios, MFA, RBAC"]
    end

    FE_DEPLOY --> API_TEST & E2E_TEST

    classDef branch fill:#f5f5f5,stroke:#666,color:#333
    classDef mainBranch fill:#e6f0ff,stroke:#4a86c8,color:#333
    classDef ci fill:#2ea44f,stroke:#1a7f37,color:#fff
    classDef cd fill:#ff9900,stroke:#cc7a00,color:#fff
    classDef verify fill:#3b48cc,stroke:#2a35a0,color:#fff

    class PR branch
    class MERGE,MANUAL mainBranch
    class BE_CI,FE_CI,INFRA_CI ci
    class CDK_DEPLOY,FE_BUILD,FE_DEPLOY cd
    class API_TEST,E2E_TEST verify
```

### Workflows

| Workflow | Trigger | Stage | Purpose |
|----------|---------|-------|---------|
| `ci.yml` | PR + push to `main` | **CI** | Lint, test, build — fast feedback on every change |
| `deploy.yml` | Manual (`workflow_dispatch`) | **CD** | Deploy infra → Build frontend (with real env) → Deploy to S3 |
| `api-tests.yml` | Post-deploy or manual | **Verify** | API smoke tests (no browser needed) |
| `e2e-tests.yml` | Post-deploy or manual | **Verify** | Playwright E2E tests with browser |

### Why Frontend Builds After CDK Deploy

The deploy pipeline solves a **chicken-and-egg problem**: the frontend needs Cognito and CloudFront values that only exist after CDK deploys.

```
CDK Deploy → extracts outputs → generates .env.production → frontend build uses real values
```

The `skip_infra` flag skips CDK deploy and looks up existing values from CloudFormation stacks — useful for frontend-only deploys.

### First-Time CI/CD Setup

```mermaid
flowchart LR
    A["1. CDK bootstrap\n(both regions)"] --> B["2. Deploy OIDC stack\nbootstrap-github-oidc.sh"]
    B --> C["3. Configure GitHub\nEnvironment variables"]
    C --> D["4. Trigger deploy\ngh workflow run"]
```

**One-time steps:**

```bash
# 1. Bootstrap CDK (required once per account per region)
cd infrastructure
cdk bootstrap aws://ACCOUNT_ID/ap-southeast-2
cdk bootstrap aws://ACCOUNT_ID/us-east-1

# 2. Deploy GitHub OIDC provider + deploy role
./scripts/bootstrap-github-oidc.sh dev

# 3. Configure GitHub (Settings -> Environments -> create "dev")
#    Variable: AWS_DEPLOY_ROLE_ARN = <role ARN from step 2>
#    Secret:   E2E_ADMIN_EMAIL = <test admin email>
#    Secret:   E2E_ADMIN_PASSWORD = <test admin password>

# 4. Trigger deployment
gh workflow run deploy.yml -f environment=dev
# Or use the convenience wrapper:
./scripts/deploy.sh dev --watch
```

The OIDC stack creates an IAM role scoped to your GitHub repo only. GitHub Actions gets temporary credentials via OIDC federation — no long-lived AWS keys are stored anywhere.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Java 21, Spring Boot 3, Spring Cloud Function, Lambda SnapStart |
| Infrastructure | CDK v2 (TypeScript), 9 stacks |
| Auth | Cognito User Pool (MFA enforced, TOTP) |
| Database | DynamoDB (9 tables, KMS encrypted) |
| Storage | S3 (per-customer bucket isolation, KMS) |
| CDN | CloudFront (consolidated distribution) + WAF |
| Email | Amazon SES |
| Events | Amazon EventBridge |
| CI/CD | GitHub Actions (OIDC auth, no stored keys) |

## Project Structure

```
ReportsPortal/
├── .github/workflows/
│   ├── ci.yml                    # CI: lint, test, build on PR/push
│   ├── deploy.yml                # CD: full deploy pipeline
│   ├── api-tests.yml             # API smoke tests (reusable)
│   └── e2e-tests.yml             # Playwright E2E tests (reusable)
├── scripts/
│   ├── deploy.sh                 # Wrapper for gh workflow run
│   └── bootstrap-github-oidc.sh  # One-time OIDC setup
├── infrastructure/               # CDK v2 TypeScript
│   ├── bin/                      # CDK app entry point
│   ├── lib/
│   │   ├── stacks/               # 9 stacks
│   │   └── constructs/           # Reusable constructs
│   └── test/                     # CDK assertion tests
├── backend/                      # Java 21 + Spring Boot 3
│   ├── shared/                   # Shared library (security, models)
│   ├── auth-function/            # Authentication Lambda
│   ├── admin-function/           # Admin operations Lambda
│   ├── customer-function/        # Customer operations Lambda
│   ├── feedback-function/        # Feedback system Lambda
│   ├── analytics-function/       # Analytics Lambda
│   ├── audit-function/           # Audit log Lambda
│   ├── notification-function/    # Notification delivery Lambda
│   └── cognito-triggers/         # Cognito pre-signup trigger
├── frontend/                     # React SPA
│   └── src/
│       ├── components/           # UI components
│       ├── pages/                # Route pages
│       ├── contexts/             # Auth, notification contexts
│       ├── services/             # API layer
│       └── types/                # TypeScript interfaces
├── e2e/                          # Playwright E2E tests
│   ├── tests/                    # Test specs
│   └── scripts/                  # API smoke test script
└── docker-compose.yml            # Local dev (DynamoDB Local)
```

## Security

### Authentication Pipeline

```mermaid
flowchart LR
    Browser -->|"ID token\n(Bearer header)"| CloudFront
    CloudFront -->|"Origin verify\nheader"| APIGW["API Gateway"]
    APIGW -->|"Cognito\nauthorizer"| Lambda
    Lambda -->|"JwtAuthenticationFilter\npopulates SecurityContext"| Handler["Request Handler\n(RoleChecker enforces\npermissions)"]
```

Every API request passes through:
1. **CloudFront WAF** — Rate limiting, geo-restriction, managed rules
2. **API Gateway Cognito Authorizer** — Validates JWT signature and expiry
3. **JwtAuthenticationFilter** (Spring Boot) — Extracts claims, populates ThreadLocal `SecurityContext`
4. **RoleChecker** — Enforces role-based permissions per endpoint

### MFA Enforcement

Every user must enrol TOTP-based MFA on first login. No exceptions, no SMS fallback.

```mermaid
flowchart LR
    A["Temp Password\n(email)"] --> B["Set New Password\n(12+ chars)"]
    B --> C["Scan QR Code\n(authenticator app)"]
    C --> D["Verify TOTP\n(6-digit code)"]
    D --> E["Dashboard\n(MFA complete)"]
```

- **Mandatory TOTP** — Cognito configured with `MFA: REQUIRED`, `SOFTWARE_TOKEN_MFA` only
- **QR code** generated client-side (`qrcode.react`), no secret sent to external services
- **Admin MFA reset** — Forces user to re-enrol on next login
- **No SMS fallback** — Eliminates SIM-swap attack vectors

### Security Layers

| Layer | Protection |
|-------|-----------|
| **Network** | Dual WAF (CloudFront + API GW), rate limiting (1000/5min), geo-restriction (AU), origin verification header |
| **Identity** | Cognito MFA (TOTP), invitation-only, 15min access / 1hr refresh tokens, JWT validation in each Lambda |
| **Data** | Per-customer S3 isolation, KMS encryption (customer-managed key), CloudFront signed cookies (3hr TTL) |
| **Application** | Role-based access (3 roles), impersonation read-only mode, HTML sanitization (OWASP), iframe sandboxing |
| **Audit** | All operations logged, 2-year retention, exportable |

## Role Model

| Role | Access |
|------|--------|
| **Super Admin** | Full access, impersonation, admin invitations, space CRUD (@versent.com.au only) |
| **Admin** | Manage assigned spaces, invite customers, upload reports, user management (@versent.com.au only) |
| **Customer** | View reports in assigned spaces, submit feedback (invited only) |

## Testing

### Test Coverage

```mermaid
flowchart TD
    subgraph Unit["Unit Tests (CI - every PR)"]
        BE["Backend (JUnit 5 + Mockito)\n40+ tests across 6 services\n- JwtAuthenticationFilter\n- SecurityContext lifecycle\n- RBAC enforcement\n- Impersonation read-only"]
        FE["Frontend (Vitest)\n- AuthContext state\n- ID token usage\n- Token refresh flow\n- Form validation"]
        INFRA["Infrastructure (Jest)\n50+ CDK assertions\n- WAF rules\n- DynamoDB schemas\n- S3 + KMS config"]
    end

    subgraph Integration["Post-Deploy Tests"]
        API["API Smoke Tests\n- SPA accessibility\n- Security headers\n- Auth endpoint responses\n- Protected endpoint 401s\n- WAF validation"]
        E2E["Playwright E2E\n100+ scenarios\n- Auth flows (MFA)\n- Role-based access\n- Impersonation\n- Report viewing\n- Feedback lifecycle"]
    end

    classDef unit fill:#2ea44f,stroke:#232f3e,color:#fff
    classDef integ fill:#3b48cc,stroke:#232f3e,color:#fff

    class BE,FE,INFRA unit
    class API,E2E integ
```

### Regression Tests for Critical Fixes

| Bug | Root Cause | Regression Test |
|-----|-----------|-----------------|
| Login redirect loop | Missing `JwtAuthenticationFilter` — `SecurityContext` never populated | `JwtAuthenticationFilterTest`: 7 tests covering filter lifecycle |
| Protected endpoints always 403 | Frontend sent access token (missing `custom:role`) instead of ID token | `AuthContext.test.tsx`: asserts `setTokens()` receives ID token |
| Token refresh 404 | Called non-existent `POST /auth/refresh` backend endpoint | `api.test.ts`: asserts refresh uses Cognito SDK `refreshSession()` |
| ThreadLocal leak | `SecurityContext.clear()` not called on exception path | `securityContextClearedEvenOnException` test |

### Running Tests

```bash
# Backend unit tests
cd backend && ./mvnw test

# Frontend unit tests
cd frontend && npm test

# CDK assertion tests
cd infrastructure && npm test

# E2E tests (requires deployed environment)
cd e2e && BASE_URL=https://your-cloudfront-domain npx playwright test

# API smoke tests (requires deployed environment)
BASE_URL=https://your-cloudfront-domain node e2e/scripts/api-smoke-test.mjs
```

## Local Development

### 1. Start Local Services

```bash
docker compose up -d    # DynamoDB Local on :8000, Admin UI on :8001
```

### 2. Build & Run Backend

```bash
cd backend
./mvnw clean package -DskipTests
sam local start-api --template template.yaml --port 3001 --warm-containers EAGER
```

### 3. Run Frontend

```bash
cd frontend
cp .env.example .env.development
npm install && npm run dev    # http://localhost:5173
```

## Environment Configuration

Environments are configured in `infrastructure/cdk.json`:

```json
{
  "dev": {
    "account": "123456789012",
    "region": "ap-southeast-2",
    "domainName": "dev.reports.yourdomain.com",
    "allowedGeoLocations": ["AU"],
    "wafRateLimit": 1000,
    "signedCookieTtlHours": 3,
    "invitationExpiryHours": 24,
    "superAdminEmail": "admin@yourdomain.com",
    "logRetentionDays": 30
  }
}
```

### Data Retention

| Resource | dev / staging | prod |
|----------|--------------|------|
| Cognito User Pool | `DESTROY` | `RETAIN` |
| DynamoDB Tables | `DESTROY` | `RETAIN` |
| S3 Buckets | `DESTROY` | `RETAIN` |

### Environment Variables

**Frontend** (`frontend/.env.example`):
```
VITE_API_BASE_URL=http://localhost:3001
VITE_COGNITO_USER_POOL_ID=ap-southeast-2_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_REGION=ap-southeast-2
VITE_CLOUDFRONT_DOMAIN=https://portal.yourdomain.com
```

**Backend** (`backend/.env.example`):
```
DYNAMODB_ENDPOINT=http://localhost:8000
COGNITO_USER_POOL_ID=ap-southeast-2_XXXXXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=ap-southeast-2
SES_SENDER_EMAIL=noreply@reports.yourdomain.com
```

## User Journeys

### Super Admin

```mermaid
journey
    title Super Admin Journey
    section Authentication
      Login with credentials: 5: Super Admin
      Complete MFA challenge: 5: Super Admin
    section Space Management
      Create customer space: 5: Super Admin
      Invite admin (@versent.com.au): 5: Super Admin
      Invite customer to space: 5: Super Admin
    section Report Management
      Upload reports to space: 5: Super Admin
      View report (iframe + full-tab): 5: Super Admin
    section Monitoring
      View analytics dashboard: 5: Super Admin
      View audit log: 5: Super Admin
    section Impersonation
      Impersonate customer (read-only): 3: Super Admin
      Exit impersonation: 5: Super Admin
```

### Admin

```mermaid
journey
    title Admin Journey
    section Authentication
      Login with MFA: 5: Admin
    section Space Management
      View assigned spaces: 5: Admin
      Upload report to space: 5: Admin
      Invite customer: 4: Admin
    section Feedback
      View feedback threads: 5: Admin
      Reply to customer: 5: Admin
    section Monitoring
      View space analytics: 5: Admin
```

### Customer

```mermaid
journey
    title Customer Journey
    section Onboarding
      Receive invitation email: 5: Customer
      Register (name, phone, company): 4: Customer
      Setup MFA (TOTP): 4: Customer
    section Report Viewing
      Browse assigned spaces: 5: Customer
      Open report (full-tab): 5: Customer
    section Feedback
      Submit feedback with attachment: 4: Customer
      View admin reply: 5: Customer
```

### Invitation Flow

```mermaid
sequenceDiagram
    actor Admin
    participant API
    participant DynamoDB
    participant SES
    participant Cognito
    actor Customer

    Admin->>API: POST invite (email, spaceId)
    API->>DynamoDB: Store invitation (24hr TTL)
    API->>SES: Send invitation email
    SES-->>Customer: Email with link

    Customer->>API: POST register (name, password)
    API->>Cognito: Create user + set attributes
    Customer->>Cognito: Setup MFA (TOTP)
    Customer->>API: First login
    API->>SES: Notify admin (invitation accepted)
```
