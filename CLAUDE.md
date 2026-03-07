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

## Feature Backlog

### E2E / Video Test Completeness
- All README user journeys must be covered by Playwright video tests
- Video tests use real report fixtures from the `quickreport` project (not inline HTML strings)
- Video 02 demonstrates multi-file upload (HTML + images)
- Video 08 demonstrates the full AppXray report upload
- Include a video scenario showing PDF upload and viewing
