import * as cdk from 'aws-cdk-lib';
import { Template, Match, Capture } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../lib/stacks/auth-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { SecurityStack } from '../lib/stacks/security-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';
import { EventsStack } from '../lib/stacks/events-stack';
import { EmailStack } from '../lib/stacks/email-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';
import { EnvironmentConfig } from '../bin/app';

const testEnvConfig: EnvironmentConfig = {
  account: '123456789012',
  region: 'ap-southeast-2',
  domainName: 'test.reports.example.com',
  adminDomainName: 'test.admin.example.com',
  sesDomain: 'test.reports.example.com',
  allowedGeoLocations: ['AU'],
  wafRateLimit: 1000,
  signedCookieTtlHours: 3,
  invitationExpiryHours: 24,
  superAdminEmail: 'test@versent.com.au',
  logRetentionDays: 30,
};

const testEnv: cdk.Environment = {
  account: '123456789012',
  region: 'ap-southeast-2',
};

describe('SecurityStack - WAF Rules', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new SecurityStack(app, 'TestSecurity', {
      env: { account: '123456789012', region: 'us-east-1' },
      environmentName: 'test',
      envConfig: testEnvConfig,
    });
    template = Template.fromStack(stack);
  });

  test('WAF WebACL is created with CLOUDFRONT scope', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Scope: 'CLOUDFRONT',
      DefaultAction: { Allow: {} },
    });
  });

  test('WAF has AWS Managed Core Rule Set', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: 'AWS-AWSManagedRulesCoreRuleSet',
          Statement: {
            ManagedRuleGroupStatement: {
              VendorName: 'AWS',
              Name: 'AWSManagedRulesCommonRuleSet',
            },
          },
        }),
      ]),
    });
  });

  test('WAF has Known Bad Inputs rule', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: 'AWS-AWSManagedRulesKnownBadInputsRuleSet',
          Statement: {
            ManagedRuleGroupStatement: {
              VendorName: 'AWS',
              Name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
        }),
      ]),
    });
  });

  test('WAF has Bot Control rule', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: 'AWS-AWSManagedRulesBotControlRuleSet',
          Statement: {
            ManagedRuleGroupStatement: {
              VendorName: 'AWS',
              Name: 'AWSManagedRulesBotControlRuleSet',
            },
          },
        }),
      ]),
    });
  });

  test('WAF has rate limiting rule', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: 'RateLimitPerIP',
          Action: { Block: {} },
          Statement: {
            RateBasedStatement: {
              Limit: 1000,
              AggregateKeyType: 'IP',
            },
          },
        }),
      ]),
    });
  });

  test('WAF has geo-restriction rule for Australia', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: 'GeoRestriction',
          Action: { Block: {} },
          Statement: {
            NotStatement: {
              Statement: {
                GeoMatchStatement: {
                  CountryCodes: ['AU'],
                },
              },
            },
          },
        }),
      ]),
    });
  });

  test('WAF has IP reputation list rule', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: 'AWS-AWSManagedRulesIPReputationList',
          Statement: {
            ManagedRuleGroupStatement: {
              VendorName: 'AWS',
              Name: 'AWSManagedRulesAmazonIpReputationList',
            },
          },
        }),
      ]),
    });
  });

  test('WAF does not have CloudFront header validation rule (only for Regional WAF)', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.not(Match.arrayWith([
        Match.objectLike({
          Name: 'CloudFrontHeaderValidation',
        }),
      ])),
    });
  });
});

describe('StorageStack - S3 Buckets', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new StorageStack(app, 'TestStorage', {
      env: testEnv,
      environmentName: 'test',
      envConfig: testEnvConfig,
    });
    template = Template.fromStack(stack);
  });

  test('Feedback bucket has block public access', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  test('Feedback bucket has KMS encryption', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: Match.arrayWith([
          Match.objectLike({
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'aws:kms',
            },
          }),
        ]),
      },
    });
  });

  test('S3 buckets have versioning enabled', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      VersioningConfiguration: {
        Status: 'Enabled',
      },
    });
  });

  test('KMS key has rotation enabled', () => {
    template.hasResourceProperties('AWS::KMS::Key', {
      EnableKeyRotation: true,
    });
  });
});

describe('StorageStack - DynamoDB Tables', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new StorageStack(app, 'TestStorage', {
      env: testEnv,
      environmentName: 'test',
      envConfig: testEnvConfig,
    });
    template = Template.fromStack(stack);
  });

  test('Users table exists with correct keys', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'report-portal-users-test',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
    });
  });

  test('Spaces table exists with GSI', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'report-portal-spaces-test',
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'spaceName-index',
        }),
      ]),
    });
  });

  test('Reports table exists', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'report-portal-reports-test',
    });
  });

  test('Invitations table has TTL', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'report-portal-invitations-test',
      TimeToLiveSpecification: {
        AttributeName: 'expiresAtTtl',
        Enabled: true,
      },
    });
  });

  test('AuditLog table has TTL', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'report-portal-audit-log-test',
      TimeToLiveSpecification: {
        AttributeName: 'ttl',
        Enabled: true,
      },
    });
  });

  test('Analytics table has report-analytics-index GSI', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'report-portal-analytics-test',
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'report-analytics-index',
        }),
      ]),
    });
  });

  test('Notifications table has TTL', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'report-portal-notifications-test',
      TimeToLiveSpecification: {
        AttributeName: 'ttl',
        Enabled: true,
      },
    });
  });

  test('FeedbackThreads table has all required GSIs', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'report-portal-feedback-threads-test',
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({ IndexName: 'report-threads-index' }),
        Match.objectLike({ IndexName: 'space-threads-index' }),
        Match.objectLike({ IndexName: 'status-index' }),
      ]),
    });
  });

  test('FeedbackMessages table exists', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'report-portal-feedback-messages-test',
    });
  });

  test('All DynamoDB tables use customer-managed KMS encryption', () => {
    const tables = template.findResources('AWS::DynamoDB::Table');
    const tableCount = Object.keys(tables).length;
    expect(tableCount).toBe(10); // 10 tables total

    for (const [, resource] of Object.entries(tables)) {
      const props = (resource as Record<string, unknown>)['Properties'] as Record<string, unknown>;
      const encryption = props['SSESpecification'] as Record<string, unknown> | undefined;
      expect(encryption).toBeDefined();
      if (encryption) {
        expect(encryption['SSEEnabled']).toBe(true);
        expect(encryption['SSEType']).toBe('KMS');
      }
    }
  });

  test('All DynamoDB tables use PAY_PER_REQUEST billing', () => {
    const tables = template.findResources('AWS::DynamoDB::Table');
    for (const [, resource] of Object.entries(tables)) {
      const props = (resource as Record<string, unknown>)['Properties'] as Record<string, unknown>;
      expect(props['BillingMode']).toBe('PAY_PER_REQUEST');
    }
  });
});

describe('AuthStack - Cognito', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new AuthStack(app, 'TestAuth', {
      env: testEnv,
      environmentName: 'test',
      envConfig: testEnvConfig,
    });
    template = Template.fromStack(stack);
  });

  test('Cognito User Pool exists with MFA required', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      MfaConfiguration: 'ON',
    });
  });

  test('Cognito has correct password policy', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      Policies: {
        PasswordPolicy: Match.objectLike({
          MinimumLength: 12,
          RequireLowercase: true,
          RequireUppercase: true,
          RequireNumbers: true,
          RequireSymbols: true,
        }),
      },
    });
  });

  test('Cognito has custom attributes', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      Schema: Match.arrayWith([
        Match.objectLike({
          Name: 'role',
          AttributeDataType: 'String',
          Mutable: true,
        }),
        Match.objectLike({
          Name: 'customer_space',
          AttributeDataType: 'String',
          Mutable: true,
        }),
        Match.objectLike({
          Name: 'invited_by',
          AttributeDataType: 'String',
          Mutable: false,
        }),
      ]),
    });
  });

  test('Cognito has device tracking enabled', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      DeviceConfiguration: {
        ChallengeRequiredOnNewDevice: true,
        DeviceOnlyRememberedOnUserPrompt: true,
      },
    });
  });

  test('Cognito has advanced security enforced', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolAddOns: {
        AdvancedSecurityMode: 'ENFORCED',
      },
    });
  });

  test('Self-signup is disabled', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: Match.objectLike({
        AllowAdminCreateUserOnly: true,
      }),
    });
  });

  test('User pool has pre-signup Lambda trigger', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      LambdaConfig: {
        PreSignUp: Match.anyValue(),
      },
    });
  });

  test('App clients have correct token validity', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      AccessTokenValidity: 15,
      IdTokenValidity: 15,
      RefreshTokenValidity: 60,
    });
  });

  test('Super admin seeding custom resource exists', () => {
    template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
      SuperAdminEmail: 'test@versent.com.au',
    });
  });
});

describe('EventsStack', () => {
  let eventsTemplate: Template;

  beforeAll(() => {
    const app = new cdk.App();

    const eventsStack = new EventsStack(app, 'TestEvents', {
      env: testEnv,
      environmentName: 'test',
      envConfig: testEnvConfig,
    });
    eventsTemplate = Template.fromStack(eventsStack);
  });

  test('Custom event bus is created', () => {
    eventsTemplate.hasResourceProperties('AWS::Events::EventBus', {
      Name: 'report-portal-events-test',
    });
  });

  // Note: EventBridge rules (feedback.new, feedback.reply, user.first_login) are
  // defined in ApiStack to avoid circular dependencies. They are tested in the
  // 'Cost Protection - ApiStack' describe block below which already instantiates
  // the full ApiStack.
});

describe('EmailStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new EmailStack(app, 'TestEmail', {
      env: testEnv,
      environmentName: 'test',
      envConfig: testEnvConfig,
    });
    template = Template.fromStack(stack);
  });

  test('SES email identity is created', () => {
    template.hasResourceProperties('AWS::SES::EmailIdentity', {
      EmailIdentity: testEnvConfig.sesDomain,
    });
  });

  test('All required SES templates are created', () => {
    const templates = template.findResources('AWS::SES::Template');
    const templateCount = Object.keys(templates).length;
    expect(templateCount).toBe(8); // invitation, admin-invitation, first-login, password-reset, mfa-reset, feedback-new, feedback-reply, feedback-resolved
  });

  test('Bounce/complaint SNS topic exists', () => {
    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: 'report-portal-ses-bounces-test',
    });
  });

  test('Bounce handler Lambda is subscribed to SNS topic', () => {
    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'lambda',
    });
  });
});

describe('Lambda Functions - SnapStart', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new AuthStack(app, 'TestAuth', {
      env: testEnv,
      environmentName: 'test',
      envConfig: testEnvConfig,
    });
    template = Template.fromStack(stack);
  });

  test('Pre-signup Lambda has SnapStart enabled', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'java21',
      SnapStart: {
        ApplyOn: 'PublishedVersions',
      },
    });
  });
});

// ========== Cost Protection Tests ==========

describe('Cost Protection - ApiStack (DLQs & Concurrency)', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();

    const authStack = new AuthStack(app, 'TestAuth2', {
      env: testEnv,
      environmentName: 'test',
      envConfig: testEnvConfig,
    });

    const storageStack = new StorageStack(app, 'TestStorage2', {
      env: testEnv,
      environmentName: 'test',
      envConfig: testEnvConfig,
    });

    const eventsStack = new EventsStack(app, 'TestEvents2', {
      env: testEnv,
      environmentName: 'test',
      envConfig: testEnvConfig,
    });

    const apiStack = new ApiStack(app, 'TestApi2', {
      env: testEnv,
      environmentName: 'test',
      envConfig: testEnvConfig,
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
    });

    template = Template.fromStack(apiStack);
  });

  test('All Lambda functions have ReservedConcurrentExecutions set', () => {
    const functions = template.findResources('AWS::Lambda::Function');
    const javaFunctions = Object.entries(functions).filter(([, resource]) => {
      const props = (resource as Record<string, unknown>)['Properties'] as Record<string, unknown>;
      return props['Runtime'] === 'java21';
    });

    expect(javaFunctions.length).toBeGreaterThanOrEqual(7);
    for (const [name, resource] of javaFunctions) {
      const props = (resource as Record<string, unknown>)['Properties'] as Record<string, unknown>;
      expect(props['ReservedConcurrentExecutions']).toBeDefined();
      expect(props['ReservedConcurrentExecutions']).toBe(5); // non-prod = 5
    }
  });

  test('All Lambda functions have a Dead Letter Queue configured', () => {
    const functions = template.findResources('AWS::Lambda::Function');
    const javaFunctions = Object.entries(functions).filter(([, resource]) => {
      const props = (resource as Record<string, unknown>)['Properties'] as Record<string, unknown>;
      return props['Runtime'] === 'java21';
    });

    for (const [name, resource] of javaFunctions) {
      const props = (resource as Record<string, unknown>)['Properties'] as Record<string, unknown>;
      expect(props['DeadLetterConfig']).toBeDefined();
    }
  });

  test('7 SQS DLQs are created with 14-day retention', () => {
    const queues = template.findResources('AWS::SQS::Queue');
    const dlqQueues = Object.entries(queues).filter(([, resource]) => {
      const props = (resource as Record<string, unknown>)['Properties'] as Record<string, unknown>;
      const name = props['QueueName'] as string | undefined;
      return name && name.includes('-dlq-');
    });

    expect(dlqQueues.length).toBe(7);
    for (const [, resource] of dlqQueues) {
      const props = (resource as Record<string, unknown>)['Properties'] as Record<string, unknown>;
      expect(props['MessageRetentionPeriod']).toBe(1209600); // 14 days in seconds
    }
  });

  test('DLQs are KMS encrypted', () => {
    const queues = template.findResources('AWS::SQS::Queue');
    const dlqQueues = Object.entries(queues).filter(([, resource]) => {
      const props = (resource as Record<string, unknown>)['Properties'] as Record<string, unknown>;
      const name = props['QueueName'] as string | undefined;
      return name && name.includes('-dlq-');
    });

    for (const [, resource] of dlqQueues) {
      const props = (resource as Record<string, unknown>)['Properties'] as Record<string, unknown>;
      expect(props['KmsMasterKeyId']).toBeDefined();
    }
  });

  // EventBridge rules are defined in ApiStack (not EventsStack) to avoid circular deps
  test('EventBridge rule for feedback.new exists', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: {
        source: ['report-portal'],
        'detail-type': ['feedback.new'],
      },
    });
  });

  test('EventBridge rule for feedback.reply exists', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: {
        source: ['report-portal'],
        'detail-type': ['feedback.reply'],
      },
    });
  });

  test('EventBridge rule for user.first_login exists', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: {
        source: ['report-portal'],
        'detail-type': ['user.first_login'],
      },
    });
  });
});

describe('Cost Protection - MonitoringStack (Budget, Anomaly, Circuit Breaker)', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();

    const authStack = new AuthStack(app, 'TestAuth3', {
      env: testEnv,
      environmentName: 'test',
      envConfig: testEnvConfig,
    });

    const storageStack = new StorageStack(app, 'TestStorage3', {
      env: testEnv,
      environmentName: 'test',
      envConfig: testEnvConfig,
    });

    const eventsStack = new EventsStack(app, 'TestEvents3', {
      env: testEnv,
      environmentName: 'test',
      envConfig: testEnvConfig,
    });

    const apiStack = new ApiStack(app, 'TestApi3', {
      env: testEnv,
      environmentName: 'test',
      envConfig: testEnvConfig,
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
    });

    const monitoringStack = new MonitoringStack(app, 'TestMonitoring3', {
      env: testEnv,
      environmentName: 'test',
      envConfig: testEnvConfig,
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
    });

    template = Template.fromStack(monitoringStack);
  });

  test('Budget resource exists with $10 monthly threshold', () => {
    template.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: Match.objectLike({
        BudgetType: 'COST',
        TimeUnit: 'MONTHLY',
        BudgetLimit: {
          Amount: 10,
          Unit: 'USD',
        },
      }),
    });
  });

  test('Budget has 4 notification thresholds (50%, 80%, 100% actual + 100% forecasted)', () => {
    template.hasResourceProperties('AWS::Budgets::Budget', {
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({
          Notification: Match.objectLike({ NotificationType: 'ACTUAL', Threshold: 50 }),
        }),
        Match.objectLike({
          Notification: Match.objectLike({ NotificationType: 'ACTUAL', Threshold: 80 }),
        }),
        Match.objectLike({
          Notification: Match.objectLike({ NotificationType: 'ACTUAL', Threshold: 100 }),
        }),
        Match.objectLike({
          Notification: Match.objectLike({ NotificationType: 'FORECASTED', Threshold: 100 }),
        }),
      ]),
    });
  });

  test('Cost Anomaly Monitor exists with DIMENSIONAL type', () => {
    template.hasResourceProperties('AWS::CE::AnomalyMonitor', {
      MonitorType: 'DIMENSIONAL',
      MonitorDimension: 'SERVICE',
    });
  });

  test('Cost Anomaly Subscription exists with IMMEDIATE frequency', () => {
    template.hasResourceProperties('AWS::CE::AnomalySubscription', {
      Frequency: 'IMMEDIATE',
    });
  });

  test('Circuit breaker Lambda exists with concurrency = 1', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs20.x',
      ReservedConcurrentExecutions: 1,
    });
  });

  test('Circuit breaker Lambda has DLQ configured', () => {
    const functions = template.findResources('AWS::Lambda::Function');
    const circuitBreakerFn = Object.entries(functions).find(([, resource]) => {
      const props = (resource as Record<string, unknown>)['Properties'] as Record<string, unknown>;
      return props['Runtime'] === 'nodejs20.x';
    });

    expect(circuitBreakerFn).toBeDefined();
    if (circuitBreakerFn) {
      const props = (circuitBreakerFn[1] as Record<string, unknown>)['Properties'] as Record<string, unknown>;
      expect(props['DeadLetterConfig']).toBeDefined();
    }
  });

  test('DLQ depth alarms exist for each queue', () => {
    const alarms = template.findResources('AWS::CloudWatch::Alarm');
    const dlqAlarms = Object.entries(alarms).filter(([, resource]) => {
      const props = (resource as Record<string, unknown>)['Properties'] as Record<string, unknown>;
      const name = props['AlarmName'] as string | undefined;
      return name && name.includes('dlq-depth');
    });

    expect(dlqAlarms.length).toBe(7);
  });
});
