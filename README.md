# Secure Report Portal

A security-first, multi-tenant AWS serverless application for delivering HTML reports to customers. Each customer has an isolated space with a dedicated S3 bucket. Reports are served via CloudFront with signed cookies, authenticated through API Gateway + Cognito.

## Architecture

```mermaid
flowchart TD
    subgraph Internet
        User["Browser / Client"]
    end

    subgraph Edge["AWS Edge Layer"]
        WAF["AWS WAF\n7 Rule Groups"]
        CF_SPA["CloudFront\nPortal SPA"]
        CF_Reports["CloudFront\nReport Serving\n(Signed Cookies)"]
    end

    subgraph Frontend["Frontend Hosting"]
        S3_SPA["S3 Bucket\nReact SPA"]
    end

    subgraph API["API Layer"]
        APIGW["API Gateway\nREST + Cognito Authorizer"]
        Cognito["Cognito User Pool\nMFA Enforced"]
    end

    subgraph Compute["Compute Layer"]
        Auth["Auth\nLambda"]
        Admin["Admin\nLambda"]
        Customer["Customer\nLambda"]
        Feedback["Feedback\nLambda"]
        Analytics["Analytics\nLambda"]
        Audit["Audit\nLambda"]
        Notification["Notification\nLambda"]
        CognitoTrigger["Cognito\nTriggers"]
    end

    subgraph Storage["Data & Storage"]
        DDB[("DynamoDB\n9 Tables")]
        S3_Cust["S3 Buckets\nPer-Customer\n(KMS Encrypted)"]
    end

    subgraph Events["Event & Messaging"]
        EB["EventBridge\nEvent Bus"]
        SES["Amazon SES\nEmail Service"]
    end

    subgraph Monitoring
        CW["CloudWatch\nLogs & Metrics"]
        Alarms["CloudWatch\nAlarms"]
    end

    User --> WAF
    WAF --> CF_SPA
    WAF --> CF_Reports
    CF_SPA --> S3_SPA
    CF_Reports -->|OAC| S3_Cust
    CF_SPA --> APIGW
    APIGW --> Cognito
    APIGW --> Auth
    APIGW --> Admin
    APIGW --> Customer
    APIGW --> Feedback
    APIGW --> Analytics
    APIGW --> Audit
    Cognito --> CognitoTrigger

    Auth --> DDB
    Auth --> Cognito
    Admin --> DDB
    Admin --> S3_Cust
    Admin --> EB
    Customer --> DDB
    Customer --> CF_Reports
    Feedback --> DDB
    Feedback --> EB
    Analytics --> DDB
    Audit --> DDB
    Notification --> DDB
    Notification --> SES

    EB --> Notification

    Auth --> CW
    Admin --> CW
    Customer --> CW
    Feedback --> CW
    CW --> Alarms

    classDef edge fill:#ff9900,stroke:#232f3e,color:#fff
    classDef compute fill:#ed7100,stroke:#232f3e,color:#fff
    classDef storage fill:#3b48cc,stroke:#232f3e,color:#fff
    classDef event fill:#e7157b,stroke:#232f3e,color:#fff
    classDef monitor fill:#2ea44f,stroke:#232f3e,color:#fff

    class WAF,CF_SPA,CF_Reports edge
    class Auth,Admin,Customer,Feedback,Analytics,Audit,Notification,CognitoTrigger compute
    class DDB,S3_Cust,S3_SPA storage
    class EB,SES event
    class CW,Alarms monitor
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
- **Content Security Policy** on report-serving CloudFront
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
    Frontend->>API Gateway: GET /customer/spaces/{spaceId}/reports/{reportId}
    API Gateway->>Lambda: Validate JWT + space access
    Lambda->>CloudFront: Generate signed cookies (3hr TTL)
    Lambda->>Frontend: Return metadata + CloudFront URL + cookies
    Frontend->>CloudFront: Load report HTML (with signed cookies)
    CloudFront->>S3: Fetch from customer bucket (OAC)
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
    A[Push to feature branch] --> B[Build & Lint]
    B --> C[Unit Tests]
    C --> D[Deploy to Dev]
    D --> E[API Tests]
    E --> F[E2E Tests - Playwright]

    F --> G{Tests Pass?}

    G -- Yes --> H[PR to main]
    H --> I[Deploy to Staging]
    I --> J[Full Test Suite]
    J --> K{Tests Pass?}

    K -- Yes --> L[Manual Approval]
    L --> M[Deploy to Prod]

    G -- No --> N[Create GitHub Issue]
    K -- No --> N

    N --> O[Fix branch]
    O --> P[PR with fix]
    P --> Q[Merge]
    Q --> B
```

---

## Environment Variables

See `.env.example` files in `frontend/` and `backend/` directories for required configuration.
