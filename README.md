# Secure Report Portal

A security-first, multi-tenant AWS serverless application for delivering HTML reports to customers. Each customer has an isolated space with a dedicated S3 bucket. Reports are served via CloudFront with signed cookies, authenticated through API Gateway + Cognito.

## Architecture

### End-to-End System Architecture

The following diagram shows the complete serverless architecture across all AWS regions and layers, including every service, data flow, and security boundary.

```mermaid
flowchart TB
    subgraph Users["👤 Users"]
        SA["Super Admin\n(@versent.com.au)"]
        AD["Admin\n(@versent.com.au)"]
        CU["Customer\n(Invited Only)"]
    end

    subgraph Edge["AWS Edge Layer (us-east-1 + ap-southeast-2)"]
        WAF["🛡️ AWS WAF\n─────────────────\n• Core Rule Set (CRS)\n• Known Bad Inputs\n• Bot Control\n• Rate Limit: 1000/5min\n• Geo-block: AU only\n• SQL Injection / XSS\n• Path Traversal"]
        CF["☁️ CloudFront\nConsolidated Distribution\n─────────────────\n• / → SPA (Portal)\n• /api/* → API Gateway\n• /reports/* → Report S3\n• Signed Cookies (3hr TTL)\n• HSTS, CSP, OAC\n• HTTP/2 + HTTP/3"]
    end

    subgraph Hosting["Frontend Hosting (ap-southeast-2)"]
        S3_SPA["📦 S3 – SPA Bucket\n─────────────────\nReact 18 + TypeScript\nVite + Tailwind CSS\nshadcn/ui Components"]
    end

    subgraph Auth["Authentication Layer"]
        Cognito["🔐 Cognito User Pool\n─────────────────\n• MFA Required (TOTP + SMS)\n• Password: 12+ chars\n• Invitation-only signup\n• 15min access / 1hr refresh\n• Custom attrs: role, space"]
        PreSignup["⚡ Pre-Signup Trigger\n(Lambda)\n─────────────────\n• Validate invitation token\n• Check email domain\n• SnapStart enabled"]
    end

    subgraph API["API Layer"]
        APIGW["🌐 API Gateway (REST)\n─────────────────\n• Cognito Authorizer\n• CORS configured\n• Request validation"]
    end

    subgraph Compute["Compute Layer – Java 21 + Spring Boot 3 (Lambda)"]
        AuthFn["⚡ Auth Function\n512MB / 30s\n─────────────────\n• POST /auth/login\n• POST /auth/mfa-verify\n• POST /auth/forgot-password\n• POST /auth/change-password\n• POST /auth/first-login"]
        AdminFn["⚡ Admin Function\n1536MB / 30s\n─────────────────\n• CRUD /admin/spaces\n• Upload /reports\n• POST /invite\n• POST /invite-admin\n• User mgmt (disable/enable/MFA)\n• POST /impersonate"]
        CustFn["⚡ Customer Function\n1024MB / 30s\n─────────────────\n• GET /customer/spaces\n• GET /reports (+ signed cookies)\n• PUT /preferences"]
        FeedFn["⚡ Feedback Function\n1024MB / 30s\n─────────────────\n• CRUD /feedback threads\n• POST /reply\n• PUT /status\n• POST /attachments\n• GET /admin/feedback/inbox"]
        AnalyticsFn["⚡ Analytics Function\n1024MB / 30s\n─────────────────\n• GET /admin/analytics/spaces\n• GET /admin/analytics/users\n• POST /admin/analytics/export"]
        AuditFn["⚡ Audit Function\n1024MB / 30s\n─────────────────\n• GET /admin/audit-log\n• Paginated queries"]
        NotifFn["⚡ Notification Function\n1024MB / 30s\n─────────────────\n• GET /notifications\n• PUT /read, /read-all\n• GET /count\n• EventBridge target (5 events)"]
    end

    subgraph Storage["Data Layer (ap-southeast-2)"]
        subgraph DDB["🗄️ DynamoDB (PAY_PER_REQUEST + KMS)"]
            T1["Users Table\nPK: USER#id | SK: PROFILE\nGSI: email-index"]
            T2["Spaces Table\nPK: SPACE#id | SK: META\nGSI: spaceName-index"]
            T3["Reports Table\nPK: SPACE#id | SK: REPORT#id"]
            T4["Invitations Table\nPK: INVITE#token | SK: META\n24hr TTL"]
            T5["AuditLog Table\nPK: AUDIT#date | SK: EVENT#ts\n2-year retention"]
            T6["Analytics Table\nPK: ANALYTICS#space | SK: EVENT#ts\nGSI: report-analytics-index"]
            T7["Notifications Table\nPK: NOTIFICATION#user | SK: ts#id\nGSI: unread-index"]
            T8["FeedbackThreads Table\nPK: THREAD#id | SK: META\n3 GSIs: report, space, status"]
            T9["FeedbackMessages Table\nPK: THREAD#id | SK: MESSAGE#id"]
        end
        subgraph S3["📦 S3 Buckets (KMS Encrypted)"]
            S3_Cust["Customer Report Buckets\n─────────────────\n• Per-customer isolation\n• Versioning enabled\n• Glacier archive (2yr)\n• Server access logging\n• Block public access"]
            S3_Feedback["Feedback Attachments\nBucket"]
            S3_Audit["Audit Log Archive\nBucket"]
        end
        KMS["🔑 KMS\nCustomer-Managed Key\nAnnual Rotation"]
    end

    subgraph Events["Event-Driven Layer"]
        EB["📡 EventBridge\nCustom Event Bus\n─────────────────\n• 90-day archive\n• 5 event rules\n• 3 retries / 1hr max"]
        subgraph EventTypes["Event Types"]
            E1["feedback.new"]
            E2["feedback.reply"]
            E3["user.first_login"]
            E4["feedback.resolved"]
            E5["invitation.accepted"]
        end
        SES["📧 Amazon SES\n─────────────────\n• Domain identity\n• Bounce/complaint SNS\n• Bounce handler Lambda"]
    end

    subgraph Monitoring["Observability Layer"]
        CW["📊 CloudWatch\n─────────────────\n• Structured JSON logs\n• Custom dashboard\n• API latency: p50/p95/p99\n• Lambda duration & errors\n• DDB consumed capacity"]
        Alarms["🚨 CloudWatch Alarms\n─────────────────\n• Lambda error rate\n• API 4xx/5xx rates\n• DDB throttling\n• SNS alert topic"]
        XRay["🔍 X-Ray\nDistributed Tracing"]
    end

    %% User flows
    SA & AD & CU --> WAF
    WAF --> CF
    CF --> S3_SPA
    CF -->|"OAC"| S3_Cust
    CF --> APIGW

    %% Auth flows
    APIGW <-->|"JWT validation"| Cognito
    Cognito --> PreSignup

    %% API to Lambda routing
    APIGW --> AuthFn
    APIGW --> AdminFn
    APIGW --> CustFn
    APIGW --> FeedFn
    APIGW --> AnalyticsFn
    APIGW --> AuditFn

    %% Lambda to data
    AuthFn --> T1 & T4 & T5
    AuthFn <--> Cognito
    AdminFn --> T1 & T2 & T3 & T4 & T5
    AdminFn --> S3_Cust
    AdminFn --> EB
    CustFn --> T1 & T2 & T3
    CustFn -->|"Generate signed cookies"| CF
    FeedFn --> T8 & T9 & T5
    FeedFn --> S3_Feedback
    FeedFn --> EB
    AnalyticsFn --> T6
    AuditFn --> T5
    NotifFn --> T7
    NotifFn --> SES

    %% Event flows
    EB --> E1 & E2 & E3 & E4 & E5
    E1 & E2 & E3 & E4 & E5 --> NotifFn

    %% KMS encryption
    KMS -.->|"Encrypts"| S3_Cust & S3_Feedback & S3_Audit & DDB

    %% Monitoring
    AuthFn & AdminFn & CustFn & FeedFn & AnalyticsFn & AuditFn & NotifFn --> CW
    AuthFn & AdminFn & CustFn & FeedFn --> XRay
    CW --> Alarms

    %% Styles
    classDef edge fill:#ff9900,stroke:#232f3e,color:#fff
    classDef compute fill:#ed7100,stroke:#232f3e,color:#fff
    classDef storage fill:#3b48cc,stroke:#232f3e,color:#fff
    classDef event fill:#e7157b,stroke:#232f3e,color:#fff
    classDef monitor fill:#2ea44f,stroke:#232f3e,color:#fff
    classDef auth fill:#dd344c,stroke:#232f3e,color:#fff
    classDef kms fill:#8c4fff,stroke:#232f3e,color:#fff

    class WAF,CF edge
    class AuthFn,AdminFn,CustFn,FeedFn,AnalyticsFn,AuditFn,NotifFn,PreSignup compute
    class T1,T2,T3,T4,T5,T6,T7,T8,T9,S3_Cust,S3_Feedback,S3_Audit,S3_SPA storage
    class EB,SES,E1,E2,E3,E4,E5 event
    class CW,Alarms,XRay monitor
    class Cognito,APIGW auth
    class KMS kms
```

### CDK Stack Dependency Graph

This diagram shows the 8 CDK stacks and their deployment dependencies.

```mermaid
flowchart LR
    subgraph Region_Sydney["ap-southeast-2"]
        AuthStack["🔐 AuthStack\n─────────────────\n• Cognito User Pool\n• Pre-Signup Trigger\n• App Clients"]
        StorageStack["🗄️ StorageStack\n─────────────────\n• 9 DynamoDB Tables\n• 3 S3 Buckets\n• KMS Key"]
        EventsStack["📡 EventsStack\n─────────────────\n• EventBridge Bus\n• 90-day Archive"]
        EmailStack["📧 EmailStack\n─────────────────\n• SES Domain Identity\n• Bounce SNS Topic\n• Bounce Handler Lambda"]
        ApiStack["⚡ ApiStack\n─────────────────\n• API Gateway\n• 7 Lambda Functions\n• EventBridge Rules\n• IAM Policies"]
        FrontendStack["☁️ FrontendStack\n─────────────────\n• 1 CloudFront Distribution\n  (/, /api/*, /reports/*)\n• S3 Hosting Buckets\n• Security Headers\n• Signed Cookie Config"]
        MonitoringStack["📊 MonitoringStack\n─────────────────\n• CloudWatch Dashboard\n• SNS Alarm Topic\n• Metric Alarms"]
    end

    subgraph Region_Virginia["us-east-1"]
        SecurityStack["🛡️ SecurityStack\n─────────────────\n• WAF WebACL\n• 7 Managed Rule Groups\n• Rate Limiting"]
    end

    AuthStack --> ApiStack
    StorageStack --> ApiStack
    EventsStack --> ApiStack
    EmailStack --> ApiStack
    SecurityStack --> FrontendStack
    ApiStack --> MonitoringStack

    classDef sydney fill:#ff9900,stroke:#232f3e,color:#fff
    classDef virginia fill:#dd344c,stroke:#232f3e,color:#fff

    class AuthStack,StorageStack,EventsStack,EmailStack,ApiStack,FrontendStack,MonitoringStack sydney
    class SecurityStack virginia
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Java 21, Spring Boot 3, Spring Cloud Function, Lambda SnapStart |
| Infrastructure | CDK v2 (TypeScript) |
| Auth | Cognito User Pool (MFA enforced) |
| Database | DynamoDB |
| Storage | S3 (per-customer bucket isolation) |
| CDN | CloudFront + WAF |
| Email | Amazon SES |
| Events | Amazon EventBridge |

## Project Structure

```
ReportsPortal/
├── infrastructure/          # CDK v2 TypeScript
│   ├── bin/                 # CDK app entry point
│   ├── lib/
│   │   ├── stacks/          # Auth, Storage, API, Events, Frontend, Security, Email, Monitoring
│   │   └── constructs/      # Reusable constructs (WAF, customer bucket, Lambda)
│   └── test/                # CDK assertion tests
├── backend/                 # Java 21 + Spring Boot 3
│   ├── shared/              # Shared library (models, security, services, DTOs)
│   ├── auth-function/       # Authentication Lambda
│   ├── admin-function/      # Admin operations Lambda
│   ├── customer-function/   # Customer operations Lambda
│   ├── feedback-function/   # Feedback system Lambda
│   ├── analytics-function/  # Analytics Lambda
│   ├── audit-function/      # Audit log Lambda
│   ├── notification-function/ # Notification delivery Lambda
│   └── cognito-triggers/    # Cognito pre-signup trigger
├── frontend/                # React SPA (admin + customer portal)
│   ├── src/
│   │   ├── components/      # UI, layout, auth, admin, customer, feedback components
│   │   ├── pages/           # Route pages (admin, customer, auth)
│   │   ├── hooks/           # Custom hooks
│   │   ├── contexts/        # Auth, notification contexts
│   │   ├── services/        # API service layer
│   │   └── types/           # TypeScript interfaces
│   └── public/
├── docker-compose.yml       # Local dev (DynamoDB Local)
└── CLAUDE.md                # Full project specification
```

## Prerequisites

- **Java 21** (with JAVA_HOME set)
- **Maven 3.9+** (or use included wrapper `./mvnw`)
- **Node.js 20+** and **npm 10+**
- **AWS CDK CLI** (`npm install -g aws-cdk`)
- **AWS SAM CLI** (for local Lambda testing)
- **Docker** (for DynamoDB Local)
- **AWS CLI v2** (configured with appropriate credentials)

## Local Development

### 1. Start Local Services

```bash
docker compose up -d
```

This starts:
- **DynamoDB Local** on port 8000
- **DynamoDB Admin UI** on port 8001 (http://localhost:8001)
- Automatically creates all required DynamoDB tables

### 2. Build Backend

```bash
cd backend
./mvnw clean package -DskipTests
```

### 3. Run Backend Locally (SAM CLI)

```bash
cd backend
sam local start-api --template template.yaml --port 3001 --warm-containers EAGER
```

### 4. Run Frontend

```bash
cd frontend
cp .env.example .env.development
# Edit .env.development with local config
npm install
npm run dev
```

Frontend runs on http://localhost:5173, proxying API calls to SAM on port 3001.

### 5. Run Tests

```bash
# Backend tests
cd backend && ./mvnw test

# Frontend tests
cd frontend && npm test

# CDK tests
cd infrastructure && npm test
```

## Deployment

### First-Time Setup

```bash
# Install CDK dependencies
cd infrastructure
npm install

# Bootstrap CDK (one-time per account/region)
cdk bootstrap aws://ACCOUNT_ID/ap-southeast-2

# Deploy all stacks
cdk deploy --all --context environment=dev
```

### Deploy to Specific Environment

```bash
# Development
cdk deploy --all --context environment=dev

# Staging
cdk deploy --all --context environment=staging

# Production
cdk deploy --all --context environment=prod
```

### Post-Deployment

After first deployment, the super admin account is seeded:
- **Email:** shanaka.jayasundera@versent.com.au
- **Temporary password:** Admin123!
- Must reset password and configure MFA on first login

## Security Highlights

- **AWS WAF** with managed rules (CRS, bot control, rate limiting, geo-restriction)
- **Per-customer S3 bucket isolation** with KMS encryption
- **CloudFront signed cookies** for report access (3-hour TTL)
- **Cognito MFA enforced** (TOTP preferred)
- **JWT tokens** with 15-min access / 1-hour refresh expiry
- **Single CloudFront distribution** with path-based routing (`/`, `/api/*`, `/reports/*`)
- **Content Security Policy** on report-serving paths
- **iframe sandboxing** for HTML reports
- **HTML sanitization** on upload (OWASP Java HTML Sanitizer)
- **CORS** explicitly configured on API Gateway and CloudFront
- **Audit logging** on all operations (2-year retention)
- **Origin Access Control** on all S3 buckets

## Role Model

| Role | Access |
|------|--------|
| **Super Admin** | Full access, impersonation, admin invitations (@versent.com.au only) |
| **Admin** | Manage assigned spaces, invite customers, upload reports (@versent.com.au only) |
| **Customer** | View reports in assigned spaces, submit feedback |

## User Journeys

The following Mermaid diagrams illustrate the key user journeys and system flows within the Secure Report Portal.

---

### 1. Super Admin Journey

The Super Admin has full control over the platform, including creating customer spaces, inviting admins and customers, uploading reports, viewing analytics, and impersonating customers for support purposes.

```mermaid
journey
    title Super Admin Journey
    section Authentication
      Login with credentials: 5: Super Admin
      Complete MFA challenge: 5: Super Admin
    section Dashboard
      View dashboard overview: 5: Super Admin
    section Space Management
      Create customer space: 5: Super Admin
      Invite admin (versent.com.au only): 5: Super Admin
      Invite customer to space: 5: Super Admin
    section Report Management
      Upload reports to space: 5: Super Admin
      View report (embedded iframe): 5: Super Admin
      View report (full-tab mode): 5: Super Admin
    section Monitoring
      View analytics dashboard: 5: Super Admin
      View audit log: 5: Super Admin
    section Impersonation
      Impersonate customer (read-only): 3: Super Admin
      Browse as customer: 3: Super Admin
      Exit impersonation: 5: Super Admin
```

---

### 2. Admin Journey

Admins manage their assigned customer spaces, upload reports, invite customers, handle feedback, and review analytics scoped to the spaces they are responsible for.

```mermaid
journey
    title Admin Journey
    section Authentication
      Login with credentials: 5: Admin
      Complete MFA challenge: 5: Admin
    section Space Management
      View assigned spaces: 5: Admin
      Upload report to space: 5: Admin
      Invite customer (domain mismatch warning): 4: Admin
    section User Management
      Disable user: 4: Admin
      Enable user: 4: Admin
      Reset user MFA: 4: Admin
    section Feedback
      View feedback threads: 5: Admin
      Reply to customer feedback: 5: Admin
    section Monitoring
      View space analytics: 5: Admin
      View audit log (assigned spaces): 5: Admin
```

---

### 3. Customer Journey

Customers are invited by an Admin or Super Admin, complete registration with MFA setup, and can then browse their spaces, view reports, and submit feedback.

```mermaid
journey
    title Customer Journey
    section Onboarding
      Receive invitation email: 5: Customer
      Accept invitation link: 5: Customer
      Register (name, phone, company, password): 4: Customer
      Setup MFA (TOTP): 4: Customer
    section Authentication
      First login with new credentials: 5: Customer
    section Report Viewing
      Browse assigned spaces: 5: Customer
      Open report (full-tab default): 5: Customer
      Navigate report tabs: 5: Customer
    section Feedback
      Submit feedback with attachment: 4: Customer
      Receive reply notification: 5: Customer
      View resolved feedback: 5: Customer
```

---

### 4. Report Viewing Flow

This sequence diagram shows the end-to-end flow when a customer opens a report, including JWT validation, CloudFront signed cookie generation, and sandboxed iframe rendering.

```mermaid
sequenceDiagram
    actor Customer
    participant Frontend
    participant API Gateway
    participant Lambda
    participant CloudFront
    participant S3

    Customer->>Frontend: Click report
    Frontend->>API Gateway: GET /api/customer/spaces/{spaceId}/reports/{reportId}
    API Gateway->>Lambda: Validate JWT + space access
    Lambda->>Lambda: Generate signed cookies (3hr TTL)
    Lambda->>Frontend: Return metadata + CloudFront /reports/* URL + cookies
    Frontend->>CloudFront: Load report HTML via /reports/* (with signed cookies)
    CloudFront->>S3: Strip /reports prefix, fetch from report bucket (OAC)
    S3-->>CloudFront: Report HTML
    CloudFront-->>Frontend: Report HTML
    Frontend->>Frontend: Render in sandboxed iframe

    Note over Frontend: Session expiry triggers overlay and re-auth required
```

---

### 5. Feedback and Notification Flow

This sequence diagram shows how feedback is submitted, stored, and how notifications are delivered to admins and customers through EventBridge and SES.

```mermaid
sequenceDiagram
    actor Customer
    actor Admin
    participant API
    participant DynamoDB
    participant EventBridge
    participant NotificationLambda as Notification Lambda
    participant SES

    Customer->>API: POST feedback (message + optional attachment)
    API->>DynamoDB: Store thread + message
    API->>EventBridge: Publish feedback.new
    EventBridge->>NotificationLambda: Trigger
    NotificationLambda->>DynamoDB: Create admin notifications
    NotificationLambda->>SES: Send email to space admins
    SES-->>Admin: Email notification

    Note over Admin: Admin sees notification in portal

    Admin->>API: POST reply to feedback thread
    API->>DynamoDB: Store reply message
    API->>EventBridge: Publish feedback.reply
    EventBridge->>NotificationLambda: Trigger
    NotificationLambda->>DynamoDB: Create customer notification
    NotificationLambda->>SES: Send email to customer
    SES-->>Customer: Email notification
```

---

### 6. Invitation Flow

This sequence diagram illustrates the complete customer invitation lifecycle, from the admin sending an invite through to the customer completing registration and MFA setup.

```mermaid
sequenceDiagram
    actor Admin
    participant API
    participant Lambda
    participant DynamoDB
    participant SES
    participant Cognito
    participant EventBridge
    participant NotificationLambda as Notification Lambda
    actor Customer

    Admin->>API: POST invite (email, spaceId)
    API->>Lambda: Validate (domain check, role check)
    Lambda->>DynamoDB: Store invitation (24hr TTL)
    Lambda->>SES: Send invitation email
    SES-->>Customer: Invitation email with link

    Customer->>Customer: Click invitation link
    Customer->>API: Load registration form
    Customer->>API: POST register (name, phone, company, password)
    API->>Cognito: Create user + set attributes
    Cognito-->>Customer: User created

    Customer->>Cognito: Setup MFA (TOTP)
    Cognito-->>Customer: MFA configured

    Customer->>API: First login
    API->>EventBridge: Publish user.first_login
    EventBridge->>NotificationLambda: Trigger
    NotificationLambda->>DynamoDB: Create notification for inviting admin
    NotificationLambda->>SES: Send email to inviting admin
    SES-->>Admin: Customer accepted invitation
```

---

### 7. CI/CD Pipeline Flow

This flowchart shows the continuous integration and deployment pipeline, from code push through automated testing to production deployment with manual approval gates.

```mermaid
flowchart TD
    subgraph Trigger["🚀 Trigger"]
        Push["Push to feature branch"]
    end

    subgraph Build["🔨 Build & Lint Stage"]
        direction TB
        BE_Build["Backend Build\n─────────────────\n./mvnw clean package\n(8 Java modules → JARs)"]
        FE_Build["Frontend Build\n─────────────────\nnpm run build\n(TypeScript + Vite bundle)"]
        FE_Lint["Frontend Lint\n─────────────────\nnpm run lint\n(ESLint + Prettier)"]
        CDK_Compile["CDK Compile\n─────────────────\nnpx tsc\n(TypeScript check)"]
        CDK_Synth["CDK Synth\n─────────────────\nnpx cdk synth\n(Generate CloudFormation)"]
    end

    subgraph UnitTest["🧪 Unit Test Stage"]
        direction TB
        BE_Test["Backend Tests\n─────────────────\n./mvnw test\n(JUnit 5 + Mockito)"]
        FE_Test["Frontend Tests\n─────────────────\nnpm test\n(Vitest + React Testing Library)"]
        CDK_Test["CDK Tests\n─────────────────\nnpm test\n(Jest + CDK Assertions)"]
    end

    subgraph DevDeploy["📦 Deploy to Dev"]
        direction TB
        CDK_Dev["cdk deploy --all\n--context environment=dev\n─────────────────\n• AuthStack\n• StorageStack\n• EventsStack\n• EmailStack\n• SecurityStack (us-east-1)\n• ApiStack\n• FrontendStack\n• MonitoringStack"]
        FE_Deploy_Dev["Frontend Deploy\n─────────────────\nS3 sync + CloudFront\ninvalidation"]
    end

    subgraph IntegrationTest["🔗 Integration Test Stage"]
        direction TB
        API_Test["API Tests\n─────────────────\n• Auth endpoint tests\n• Admin CRUD tests\n• Customer access tests\n• Feedback flow tests\n• Role-based access tests"]
        E2E_Test["E2E Tests (Playwright)\n─────────────────\n• Login + MFA flow\n• Space management\n• Report upload & view\n• Feedback submission\n• Admin workflows\n• Customer journeys"]
    end

    subgraph StagingDeploy["📦 Deploy to Staging"]
        direction TB
        CDK_Staging["cdk deploy --all\n--context environment=staging"]
        FE_Deploy_Staging["Frontend Deploy\n─────────────────\nS3 sync + CloudFront\ninvalidation"]
        Full_Test["Full Test Suite\n─────────────────\n• All unit tests\n• All integration tests\n• All E2E tests\n• Performance tests"]
    end

    subgraph ProdDeploy["🚢 Deploy to Production"]
        direction TB
        Approval["✋ Manual Approval Gate\n─────────────────\nRequired sign-off from\nauthorized team member"]
        CDK_Prod["cdk deploy --all\n--context environment=prod"]
        FE_Deploy_Prod["Frontend Deploy\n─────────────────\nS3 sync + CloudFront\ninvalidation"]
        Smoke["Smoke Tests\n─────────────────\n• Health check endpoints\n• Critical path validation"]
    end

    subgraph FailureHandling["❌ Failure Handling"]
        GH_Issue["Create GitHub Issue\n─────────────────\n• Failed stage details\n• Error logs\n• Stack trace"]
        Fix["Fix on branch\n─────────────────\nDeveloper investigates\nand applies fix"]
        PR_Fix["PR with fix\n─────────────────\nCode review +\nRe-run pipeline"]
    end

    %% Main flow
    Push --> BE_Build & FE_Build & FE_Lint & CDK_Compile
    CDK_Compile --> CDK_Synth
    BE_Build & FE_Build & FE_Lint & CDK_Synth --> BE_Test & FE_Test & CDK_Test
    BE_Test & FE_Test & CDK_Test --> CDK_Dev
    CDK_Dev --> FE_Deploy_Dev
    FE_Deploy_Dev --> API_Test
    API_Test --> E2E_Test

    E2E_Test --> DevPass{Tests Pass?}

    DevPass -- Yes --> PR["Create PR to main"]
    PR --> CDK_Staging
    CDK_Staging --> FE_Deploy_Staging
    FE_Deploy_Staging --> Full_Test

    Full_Test --> StagingPass{Tests Pass?}

    StagingPass -- Yes --> Approval
    Approval --> CDK_Prod
    CDK_Prod --> FE_Deploy_Prod
    FE_Deploy_Prod --> Smoke

    %% Failure flows
    DevPass -- No --> GH_Issue
    StagingPass -- No --> GH_Issue
    GH_Issue --> Fix
    Fix --> PR_Fix
    PR_Fix -->|"Merge & re-trigger"| BE_Build

    %% Styles
    classDef trigger fill:#6366f1,stroke:#232f3e,color:#fff
    classDef build fill:#f59e0b,stroke:#232f3e,color:#fff
    classDef test fill:#3b82f6,stroke:#232f3e,color:#fff
    classDef deploy fill:#10b981,stroke:#232f3e,color:#fff
    classDef fail fill:#ef4444,stroke:#232f3e,color:#fff
    classDef gate fill:#8b5cf6,stroke:#232f3e,color:#fff

    class Push trigger
    class BE_Build,FE_Build,FE_Lint,CDK_Compile,CDK_Synth build
    class BE_Test,FE_Test,CDK_Test,API_Test,E2E_Test,Full_Test,Smoke test
    class CDK_Dev,FE_Deploy_Dev,CDK_Staging,FE_Deploy_Staging,CDK_Prod,FE_Deploy_Prod deploy
    class GH_Issue,Fix,PR_Fix fail
    class Approval gate
```

---

## Environment Variables

See `.env.example` files in `frontend/` and `backend/` directories for required configuration.
