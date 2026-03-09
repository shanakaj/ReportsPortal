# ReportsPortal — Project Instructions

## Architecture Overview

- **Frontend**: React + Vite + TypeScript (SPA served via CloudFront)
- **Backend**: 7 Spring Boot Lambda functions behind API Gateway (via `aws-serverless-java-container-springboot3` + `StreamLambdaHandler`)
- **Infrastructure**: AWS CDK (TypeScript) — Cognito, DynamoDB, S3, CloudFront, WAF, EventBridge
- **Auth**: Cognito with mandatory MFA (TOTP), three roles: `super_admin`, `admin`, `customer`
- **Reports**: Multi-format files (HTML, PDF, Word, Excel, PPT, images) stored in S3, served via CloudFront with signed cookies
- **E2E Tests**: Playwright with 8 video demo scenarios + 8 functional test suites (137 tests)

## Key Conventions

- Lambda handler pattern: `StreamLambdaHandler` wraps Spring Boot `@RestController` via `SpringBootLambdaContainerHandler`
- JAR packaging: `spring-boot-maven-plugin` must have `<skip>true</skip>` (Lambda can't load BOOT-INF layout)
- S3 report key structure: `reports/{reportId}/{fileName}` (HTML + assets under same reportId)
- CDK handler reference format: `com.versent.reportportal.{module}.StreamLambdaHandler`
- IAM descriptions: ASCII only (no em dashes or Unicode)
- CI triggers on PR + push to main; CD is manual dispatch only
- File type utilities centralised in `frontend/src/lib/file-utils.ts` — all components use shared MIME/category logic
- When adding new parameters to `.env`, always update the corresponding `.env.example` file with placeholder values and comments

## Supported Report Formats

| Category | Extensions | Inline View | New Tab |
|---|---|---|---|
| HTML | `.html`, `.htm` | iframe (with asset images) | Full tab viewer |
| PDF | `.pdf` | iframe | Full tab viewer |
| Image | `.png`, `.jpg`, `.gif`, `.svg`, `.webp` | `<img>` tag | Full tab viewer |
| Word | `.doc`, `.docx` | Download prompt | Download |
| Excel | `.xls`, `.xlsx` | Download prompt | Download |
| PowerPoint | `.ppt`, `.pptx` | Download prompt | Download |

- HTML reports can include accompanying image assets (uploaded together, stored under same reportId)
- Asset images are NOT shown in the report list — only the main report file appears
- Non-viewable formats (Word, Excel, PPT) show a download button instead of an embedded viewer

## AWS Cost Protection — Mandatory

All infrastructure changes MUST include cost protection measures. This project uses CDK (TypeScript), so all rules below use CDK constructs.

### Budget Alerts
- Every deployment MUST have a `aws_budgets.CfnBudget` with a **$10/month** threshold (adjust per environment)
- Budget MUST be scoped to only the AWS services used in this stack using `CostFilters` on `Service`:
  - `AWS Lambda`, `Amazon DynamoDB`, `Amazon S3`, `Amazon CloudFront`, `Amazon API Gateway`, `Amazon Simple Email Service`, `Amazon EventBridge`, `Amazon Cognito`, `AWS WAF`, `AWS Key Management Service`
- Email alerts MUST fire at **50%, 80%, 100% actual** spend and **100% forecasted**
- Never use account-wide budgets — always filter to project-specific services
- Budget construct belongs in `MonitoringStack`

### Lambda Concurrency Limits
- Every `lambda.Function` MUST have `reservedConcurrentExecutions` set — no exceptions
- **Production**: `reservedConcurrentExecutions: 10` (adjust per function's expected load)
- **Non-production (dev/staging)**: `reservedConcurrentExecutions: 5` (limited but functional)
- Use environment-aware expression: `environment === 'prod' ? 10 : 5`
- Applies to all 8 functions: auth, admin, customer, feedback, analytics, audit, notification, cognito-trigger

### Dead Letter Queues (DLQ)
- Every Lambda function MUST have a corresponding SQS Dead Letter Queue
- DLQ message retention: **14 days** (`retentionPeriod: cdk.Duration.days(14)`)
- Create DLQs for each Lambda in `ApiStack` alongside the function definitions
- DLQs must be KMS-encrypted using the shared project KMS key from `StorageStack`

### Cost Anomaly Detection
- Every deployment MUST have a `ce.CfnAnomalyMonitor` with `monitorType: 'DIMENSIONAL'` and `monitorDimension: 'SERVICE'`
- `ce.CfnAnomalySubscription` set to `frequency: 'IMMEDIATE'`
- Alert threshold: `ANOMALY_TOTAL_IMPACT_ABSOLUTE >= 5` (i.e., $5 impact)
- Route alerts through the existing SNS alarm topic in `MonitoringStack`
- SNS topic policy MUST allow `costalerts.amazonaws.com` to publish

### Lambda Circuit Breaker Pattern
Every deployment MUST implement circuit breaker CloudWatch Alarms per Lambda function:
- **DLQ depth alarm**: `ApproximateNumberOfMessagesVisible > 5` over 5 minutes
- **Error alarm**: Lambda `Errors > 10` over 5 minutes
- **Throttle alarm**: Lambda `Throttles > 5` over 5 minutes
- All alarms publish to the shared SNS alarm topic in `MonitoringStack`

**Auto-disable mechanism** — A dedicated circuit breaker Lambda that:
- Subscribes to the cost alerts SNS topic
- When budget threshold is breached, calls `putFunctionConcurrency` with `ReservedConcurrentExecutions: 0` on all protected functions
- Sends SNS notification listing which functions were disabled
- The circuit breaker Lambda itself has `reservedConcurrentExecutions: 1`
- Implemented as a Node.js Lambda (lightweight, no Spring Boot overhead) in `MonitoringStack`

### CDK File Structure for Cost Protection
```
infrastructure/lib/stacks/monitoring-stack.ts  — Budget, anomaly detection, circuit breaker Lambda, alarms
infrastructure/lib/stacks/api-stack.ts         — Each Lambda must have reservedConcurrentExecutions + DLQ
infrastructure/lib/constructs/                 — Reusable DLQ + alarm construct per Lambda
```

### Key Rules
- NEVER deploy a Lambda function without `reservedConcurrentExecutions`
- NEVER deploy a Lambda function without a DLQ
- NEVER create a deployment without a stack-scoped budget with alerts at 50%, 80%, and 100%
- NEVER use account-wide budgets — always scope to project services
- ALWAYS implement the circuit breaker auto-disable pattern
- ALWAYS use environment-aware concurrency (`prod` = 10, non-prod = 5)

## Feature Backlog

### E2E / Video Test Completeness
- All README user journeys must be covered by Playwright video tests
- Video tests use real report fixtures from the `quickreport` project (not inline HTML strings)
- Video 02 demonstrates multi-file upload (HTML + images)
- Video 08 demonstrates the full AppXray report upload
- Include a video scenario showing PDF upload and viewing
