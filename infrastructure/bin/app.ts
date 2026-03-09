#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/stacks/auth-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { EventsStack } from '../lib/stacks/events-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';
import { SecurityStack } from '../lib/stacks/security-stack';
import { EmailStack } from '../lib/stacks/email-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';
import { GitHubOidcStack } from '../lib/stacks/github-oidc-stack';

export interface EnvironmentConfig {
  account: string;
  region: string;
  domainName: string;
  adminDomainName: string;
  sesDomain: string;
  allowedGeoLocations: string[];
  wafRateLimit: number;
  signedCookieTtlHours: number;
  invitationExpiryHours: number;
  superAdminEmail: string;
  logRetentionDays: number;
  allowedAdminDomains?: string;
}

const app = new cdk.App();

const environmentName = app.node.tryGetContext('environment') || 'dev';
const environments = app.node.tryGetContext('environments');

if (!environments || !environments[environmentName]) {
  throw new Error(
    `Environment "${environmentName}" not found in cdk.json context. ` +
    `Available environments: ${environments ? Object.keys(environments).join(', ') : 'none'}`
  );
}

const envConfig: EnvironmentConfig = environments[environmentName];
const prefix = `ReportPortal-${environmentName}`;

const env: cdk.Environment = {
  account: envConfig.account || process.env.CDK_DEFAULT_ACCOUNT,
  region: envConfig.region || 'ap-southeast-2',
};

const commonTags: Record<string, string> = {
  Project: 'ReportPortal',
  Environment: environmentName,
  ManagedBy: 'CDK',
};

const authStack = new AuthStack(app, `${prefix}-Auth`, {
  env,
  environmentName,
  envConfig,
  tags: commonTags,
  description: `Report Portal Authentication Stack (${environmentName})`,
});

const storageStack = new StorageStack(app, `${prefix}-Storage`, {
  env,
  environmentName,
  envConfig,
  tags: commonTags,
  description: `Report Portal Storage Stack (${environmentName})`,
});

const eventsStack = new EventsStack(app, `${prefix}-Events`, {
  env,
  environmentName,
  envConfig,
  tags: commonTags,
  description: `Report Portal Events Stack (${environmentName})`,
});

const emailStack = new EmailStack(app, `${prefix}-Email`, {
  env,
  environmentName,
  envConfig,
  tags: commonTags,
  description: `Report Portal Email Stack (${environmentName})`,
});

const apiStack = new ApiStack(app, `${prefix}-Api`, {
  env,
  environmentName,
  envConfig,
  userPool: authStack.userPool,
  userPoolClient: authStack.portalAppClient,
  usersTable: storageStack.usersTable,
  spacesTable: storageStack.spacesTable,
  reportsTable: storageStack.reportsTable,
  invitationsTable: storageStack.invitationsTable,
  auditLogTable: storageStack.auditLogTable,
  analyticsTable: storageStack.analyticsTable,
  notificationsTable: storageStack.notificationsTable,
  feedbackThreadsTable: storageStack.feedbackThreadsTable,
  feedbackMessagesTable: storageStack.feedbackMessagesTable,
  feedbackBucket: storageStack.feedbackBucket,
  auditBucket: storageStack.auditBucket,
  encryptionKey: storageStack.encryptionKey,
  eventBus: eventsStack.eventBus,
  platformSettingsTable: storageStack.platformSettingsTable,
  tags: commonTags,
  description: `Report Portal API Stack (${environmentName})`,
});

// WAF must be deployed in us-east-1 for CloudFront association
const securityStack = new SecurityStack(app, `${prefix}-Security`, {
  env: { account: env.account, region: 'us-east-1' },
  environmentName,
  envConfig,
  tags: commonTags,
  crossRegionReferences: true,
  description: `Report Portal Security Stack (${environmentName})`,
});

const frontendStack = new FrontendStack(app, `${prefix}-Frontend`, {
  env,
  environmentName,
  envConfig,
  webAclArn: securityStack.webAclArn,
  api: apiStack.api,
  apiStageName: environmentName,
  originVerifyHeaderName: apiStack.originVerifyHeaderName,
  originVerifyHeaderValue: apiStack.originVerifyHeaderValue,
  tags: commonTags,
  crossRegionReferences: true,
  description: `Report Portal Frontend Stack (${environmentName})`,
});

const monitoringStack = new MonitoringStack(app, `${prefix}-Monitoring`, {
  env,
  environmentName,
  envConfig,
  apiGateway: apiStack.api,
  lambdaFunctions: apiStack.lambdaFunctions,
  dlqQueues: apiStack.dlqQueues,
  encryptionKey: storageStack.encryptionKey,
  tables: [
    storageStack.usersTable,
    storageStack.spacesTable,
    storageStack.reportsTable,
    storageStack.auditLogTable,
    storageStack.analyticsTable,
    storageStack.feedbackThreadsTable,
    storageStack.feedbackMessagesTable,
  ],
  tags: commonTags,
  description: `Report Portal Monitoring Stack (${environmentName})`,
});

// GitHub Actions OIDC — deploy once per account to enable CI/CD
const githubOidcStack = new GitHubOidcStack(app, `ReportPortal-GitHubOIDC`, {
  env,
  githubOrg: 'shanaka-versent',
  githubRepo: 'ReportsPortal',
  tags: commonTags,
  description: 'GitHub Actions OIDC provider and deploy role (one-time setup)',
});

// Stack dependencies
apiStack.addDependency(authStack);
apiStack.addDependency(storageStack);
apiStack.addDependency(eventsStack);
frontendStack.addDependency(securityStack);
frontendStack.addDependency(apiStack);
monitoringStack.addDependency(apiStack);

app.synth();
