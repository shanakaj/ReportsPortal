# ReportsPortal — Project Instructions

## Architecture Overview

- **Frontend**: React + Vite + TypeScript (SPA served via CloudFront)
- **Backend**: 7 Spring Boot Lambda functions behind API Gateway (via `aws-serverless-java-container-springboot3` + `StreamLambdaHandler`)
- **Infrastructure**: AWS CDK (TypeScript) — Cognito, DynamoDB, S3, CloudFront, WAF, EventBridge
- **Auth**: Cognito with mandatory MFA (TOTP), three roles: `super_admin`, `admin`, `customer`
- **Reports**: HTML files stored in S3, served via CloudFront with signed cookies
- **E2E Tests**: Playwright with 8 video demo scenarios + 8 functional test suites (137 tests)

## Key Conventions

- Lambda handler pattern: `StreamLambdaHandler` wraps Spring Boot `@RestController` via `SpringBootLambdaContainerHandler`
- JAR packaging: `spring-boot-maven-plugin` must have `<skip>true</skip>` (Lambda can't load BOOT-INF layout)
- S3 report key structure: `reports/{reportId}/{fileName}` (HTML + assets under same reportId)
- CDK handler reference format: `com.versent.reportportal.{module}.StreamLambdaHandler`
- IAM descriptions: ASCII only (no em dashes or Unicode)
- CI triggers on PR + push to main; CD is manual dispatch only

## Feature Backlog

### PDF Report Support
- Support uploading and viewing PDF reports alongside HTML reports
- PDF files should render in the iframe viewer (browsers natively render PDFs in iframes)
- Update `ReportUpload` component to accept `.pdf` files in addition to `.html`/`.htm`
- Backend: accept `application/pdf` content type in presigned URL generation
- CSP headers may need `plugin-types` or `object-src` adjustments for PDF rendering

### Report Asset Visibility
- When uploading HTML + images, only the HTML report should appear in the report list
- Image assets (PNG, JPG, SVG, etc.) are supporting files — they must NOT be listed as separate reports
- They exist solely so `<img src="relative-path.png">` references in the HTML resolve correctly via CloudFront
- The report list should filter to show only HTML/PDF entries, not image assets

### E2E / Video Test Completeness
- All README user journeys must be covered by Playwright video tests
- Video tests use real report fixtures from the `quickreport` project (not inline HTML strings)
- Video 02 demonstrates multi-file upload (HTML + images)
- Video 08 demonstrates the full AppXray report upload
- When PDF support is added, include a video scenario showing PDF upload and viewing
