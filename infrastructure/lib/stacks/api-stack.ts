import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../bin/app';
import { JavaLambdaFunction } from '../constructs/lambda-function-construct';
import { WafWebAcl } from '../constructs/waf-construct';

export interface ApiStackProps extends cdk.StackProps {
  environmentName: string;
  envConfig: EnvironmentConfig;
  userPool: cognito.IUserPool;
  userPoolClient: cognito.IUserPoolClient;
  usersTable: dynamodb.ITable;
  spacesTable: dynamodb.ITable;
  reportsTable: dynamodb.ITable;
  invitationsTable: dynamodb.ITable;
  auditLogTable: dynamodb.ITable;
  analyticsTable: dynamodb.ITable;
  notificationsTable: dynamodb.ITable;
  feedbackThreadsTable: dynamodb.ITable;
  feedbackMessagesTable: dynamodb.ITable;
  feedbackBucket: s3.IBucket;
  auditBucket: s3.IBucket;
  encryptionKey: kms.IKey;
  eventBus: events.IEventBus;
  platformSettingsTable: dynamodb.ITable;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly lambdaFunctions: lambda.IFunction[];
  public readonly originVerifyHeaderName: string;
  public readonly originVerifyHeaderValue: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const {
      environmentName,
      envConfig,
      userPool,
      userPoolClient,
      usersTable,
      spacesTable,
      reportsTable,
      invitationsTable,
      auditLogTable,
      analyticsTable,
      notificationsTable,
      feedbackThreadsTable,
      feedbackMessagesTable,
      feedbackBucket,
      auditBucket,
      encryptionKey,
      eventBus,
      platformSettingsTable,
    } = props;

    // Common Lambda environment variables
    const commonEnv: Record<string, string> = {
      USERS_TABLE: usersTable.tableName,
      SPACES_TABLE: spacesTable.tableName,
      REPORTS_TABLE: reportsTable.tableName,
      INVITATIONS_TABLE: invitationsTable.tableName,
      AUDIT_LOG_TABLE: auditLogTable.tableName,
      ANALYTICS_TABLE: analyticsTable.tableName,
      NOTIFICATIONS_TABLE: notificationsTable.tableName,
      FEEDBACK_THREADS_TABLE: feedbackThreadsTable.tableName,
      FEEDBACK_MESSAGES_TABLE: feedbackMessagesTable.tableName,
      FEEDBACK_BUCKET: feedbackBucket.bucketName,
      AUDIT_BUCKET: auditBucket.bucketName,
      COGNITO_USER_POOL_ID: userPool.userPoolId,
      COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
      EVENT_BUS_NAME: eventBus.eventBusName,
      SES_DOMAIN: envConfig.sesDomain,
      ENVIRONMENT: environmentName,
      ENCRYPTION_KEY_ARN: encryptionKey.keyArn,
      SIGNED_COOKIE_TTL_HOURS: String(envConfig.signedCookieTtlHours),
      INVITATION_EXPIRY_HOURS: String(envConfig.invitationExpiryHours),
      PORTAL_DOMAIN: envConfig.domainName,
      ADMIN_DOMAIN: envConfig.adminDomainName,
      PLATFORM_SETTINGS_TABLE: platformSettingsTable.tableName,
    };

    const backendCodePath = '../backend';

    // ========== Lambda Functions ==========

    // Auth Function
    const authFunction = new JavaLambdaFunction(this, 'AuthFunction', {
      functionName: 'auth',
      description: 'Handles authentication flows (login, MFA, password reset)',
      handler: 'com.versent.reportportal.auth.handler.AuthHandler::handleRequest',
      codePath: `${backendCodePath}/auth-function/target/auth-function.jar`,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: commonEnv,
      environmentName,
    });

    // Admin Function
    const adminFunction = new JavaLambdaFunction(this, 'AdminFunction', {
      functionName: 'admin',
      description: 'Handles admin operations (spaces, users, reports, impersonation)',
      handler: 'com.versent.reportportal.admin.handler.AdminHandler::handleRequest',
      codePath: `${backendCodePath}/admin-function/target/admin-function.jar`,
      memorySize: 1536,
      timeout: cdk.Duration.seconds(30),
      environment: commonEnv,
      environmentName,
    });

    // Customer Function
    const customerFunction = new JavaLambdaFunction(this, 'CustomerFunction', {
      functionName: 'customer',
      description: 'Handles customer operations (spaces, reports, preferences)',
      handler: 'com.versent.reportportal.customer.handler.CustomerHandler::handleRequest',
      codePath: `${backendCodePath}/customer-function/target/customer-function.jar`,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: commonEnv,
      environmentName,
    });

    // Feedback Function
    const feedbackFunction = new JavaLambdaFunction(this, 'FeedbackFunction', {
      functionName: 'feedback',
      description: 'Handles feedback threads, messages, and attachments',
      handler: 'com.versent.reportportal.feedback.handler.FeedbackHandler::handleRequest',
      codePath: `${backendCodePath}/feedback-function/target/feedback-function.jar`,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: commonEnv,
      environmentName,
    });

    // Analytics Function
    const analyticsFunction = new JavaLambdaFunction(this, 'AnalyticsFunction', {
      functionName: 'analytics',
      description: 'Handles analytics data collection and reporting',
      handler: 'com.versent.reportportal.analytics.handler.AnalyticsHandler::handleRequest',
      codePath: `${backendCodePath}/analytics-function/target/analytics-function.jar`,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: commonEnv,
      environmentName,
    });

    // Audit Function
    const auditFunction = new JavaLambdaFunction(this, 'AuditFunction', {
      functionName: 'audit',
      description: 'Handles audit log queries',
      handler: 'com.versent.reportportal.audit.handler.AuditHandler::handleRequest',
      codePath: `${backendCodePath}/audit-function/target/audit-function.jar`,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: commonEnv,
      environmentName,
    });

    // Notification Function
    const notificationFunction = new JavaLambdaFunction(this, 'NotificationFunction', {
      functionName: 'notification',
      description: 'Handles notification delivery (EventBridge target) and notification queries',
      handler: 'com.versent.reportportal.notification.handler.NotificationHandler::handleRequest',
      codePath: `${backendCodePath}/notification-function/target/notification-function.jar`,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: commonEnv,
      environmentName,
    });

    this.lambdaFunctions = [
      authFunction.function,
      adminFunction.function,
      customerFunction.function,
      feedbackFunction.function,
      analyticsFunction.function,
      auditFunction.function,
      notificationFunction.function,
    ];

    // ========== EventBridge Rules (targeting notification function) ==========
    const eventRuleDefaults = {
      retryAttempts: 3,
      maxEventAge: cdk.Duration.hours(1),
    };

    new events.Rule(this, 'FeedbackNewRule', {
      ruleName: `report-portal-feedback-new-${environmentName}`,
      description: 'Triggers notification when new feedback is posted',
      eventBus,
      eventPattern: { source: ['report-portal'], detailType: ['feedback.new'] },
    }).addTarget(new targets.LambdaFunction(notificationFunction.alias, eventRuleDefaults));

    new events.Rule(this, 'FeedbackReplyRule', {
      ruleName: `report-portal-feedback-reply-${environmentName}`,
      description: 'Triggers notification when feedback reply is posted',
      eventBus,
      eventPattern: { source: ['report-portal'], detailType: ['feedback.reply'] },
    }).addTarget(new targets.LambdaFunction(notificationFunction.alias, eventRuleDefaults));

    new events.Rule(this, 'UserFirstLoginRule', {
      ruleName: `report-portal-user-first-login-${environmentName}`,
      description: 'Triggers notification when a user logs in for the first time',
      eventBus,
      eventPattern: { source: ['report-portal'], detailType: ['user.first_login'] },
    }).addTarget(new targets.LambdaFunction(notificationFunction.alias, eventRuleDefaults));

    new events.Rule(this, 'FeedbackResolvedRule', {
      ruleName: `report-portal-feedback-resolved-${environmentName}`,
      description: 'Triggers notification when feedback thread is resolved',
      eventBus,
      eventPattern: { source: ['report-portal'], detailType: ['feedback.resolved'] },
    }).addTarget(new targets.LambdaFunction(notificationFunction.alias, eventRuleDefaults));

    new events.Rule(this, 'InvitationAcceptedRule', {
      ruleName: `report-portal-invitation-accepted-${environmentName}`,
      description: 'Triggers notification when an invitation is accepted',
      eventBus,
      eventPattern: { source: ['report-portal'], detailType: ['invitation.accepted'] },
    }).addTarget(new targets.LambdaFunction(notificationFunction.alias, eventRuleDefaults));

    // ========== IAM Permissions (Least Privilege) ==========

    const allTables = [
      usersTable, spacesTable, reportsTable, invitationsTable,
      auditLogTable, analyticsTable, notificationsTable,
      feedbackThreadsTable, feedbackMessagesTable,
    ];

    // Auth function: Cognito + Users + Invitations + AuditLog + Settings (read)
    this.grantTableReadWrite(authFunction, [usersTable, invitationsTable, auditLogTable]);
    this.grantTableRead(authFunction, [platformSettingsTable]);
    authFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:InitiateAuth',
        'cognito-idp:RespondToAuthChallenge',
        'cognito-idp:ForgotPassword',
        'cognito-idp:ConfirmForgotPassword',
        'cognito-idp:ChangePassword',
        'cognito-idp:AssociateSoftwareToken',
        'cognito-idp:VerifySoftwareToken',
        'cognito-idp:SetUserMFAPreference',
      ],
      resources: [userPool.userPoolArn],
    }));

    // Admin function: all tables + settings + S3 + Cognito admin + EventBridge + SES
    this.grantTableReadWrite(adminFunction, [...allTables, platformSettingsTable]);
    feedbackBucket.grantReadWrite(adminFunction.function);
    encryptionKey.grantEncryptDecrypt(adminFunction.function);
    adminFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminDisableUser',
        'cognito-idp:AdminEnableUser',
        'cognito-idp:AdminDeleteUser',
        'cognito-idp:AdminResetUserPassword',
        'cognito-idp:AdminUpdateUserAttributes',
        'cognito-idp:AdminGetUser',
        'cognito-idp:ListUsers',
        'cognito-idp:AdminSetUserMFAPreference',
      ],
      resources: [userPool.userPoolArn],
    }));
    adminFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['events:PutEvents'],
      resources: [eventBus.eventBusArn],
    }));
    adminFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendTemplatedEmail'],
      resources: ['*'],
      conditions: {
        StringEquals: {
          'ses:FromAddress': `noreply@${envConfig.sesDomain}`,
        },
      },
    }));
    // S3 bucket creation for new customer spaces
    adminFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:CreateBucket',
        's3:PutBucketPolicy',
        's3:PutBucketEncryption',
        's3:PutBucketVersioning',
        's3:PutBucketPublicAccessBlock',
        's3:PutBucketLogging',
        's3:PutBucketCors',
      ],
      resources: [`arn:aws:s3:::report-portal-*`],
    }));
    // Presigned URL generation for customer space buckets
    adminFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject', 's3:GetObject', 's3:DeleteObject'],
      resources: [`arn:aws:s3:::report-portal-*/*`],
    }));

    // Customer function: users, spaces, reports, analytics, audit + CloudFront signed cookies
    this.grantTableReadWrite(customerFunction, [
      usersTable, spacesTable, reportsTable, analyticsTable, auditLogTable,
    ]);
    customerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudfront:CreateSignedUrl', 'cloudfront:CreateSignedCookie'],
      resources: ['*'],
    }));
    customerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter/report-portal/${environmentName}/cloudfront/*`,
      ],
    }));

    // Feedback function: feedback tables + S3 + EventBridge + Audit
    this.grantTableReadWrite(feedbackFunction, [
      feedbackThreadsTable, feedbackMessagesTable, auditLogTable,
      usersTable, spacesTable, reportsTable,
    ]);
    feedbackBucket.grantReadWrite(feedbackFunction.function);
    encryptionKey.grantEncryptDecrypt(feedbackFunction.function);
    feedbackFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['events:PutEvents'],
      resources: [eventBus.eventBusArn],
    }));

    // Analytics function: analytics + users + spaces + reports tables
    this.grantTableReadWrite(analyticsFunction, [analyticsTable]);
    this.grantTableRead(analyticsFunction, [usersTable, spacesTable, reportsTable]);
    // S3 for analytics export
    auditBucket.grantWrite(analyticsFunction.function);

    // Audit function: read audit log, users, spaces
    this.grantTableRead(auditFunction, [auditLogTable, usersTable, spacesTable]);

    // Notification function: notifications + users + spaces + SES
    this.grantTableReadWrite(notificationFunction, [notificationsTable]);
    this.grantTableRead(notificationFunction, [usersTable, spacesTable, reportsTable]);
    notificationFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendTemplatedEmail'],
      resources: ['*'],
      conditions: {
        StringEquals: {
          'ses:FromAddress': `noreply@${envConfig.sesDomain}`,
        },
      },
    }));

    // ========== API Gateway ==========

    const accessLogGroup = new logs.LogGroup(this, 'ApiAccessLogs', {
      logGroupName: `/aws/apigateway/report-portal-api-${environmentName}`,
      retention: logs.RetentionDays.SIX_MONTHS,
      removalPolicy: environmentName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `report-portal-api-${environmentName}`,
      description: `Report Portal API (${environmentName})`,
      deployOptions: {
        stageName: environmentName,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: environmentName !== 'prod',
        metricsEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(accessLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: [
          `https://${envConfig.domainName}`,
          `https://${envConfig.adminDomainName}`,
        ],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Authorization',
          'Content-Type',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
        maxAge: cdk.Duration.hours(1),
      },
      endpointTypes: [apigateway.EndpointType.REGIONAL],
    });

    // Cognito Authorizer
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      authorizerName: `report-portal-authorizer-${environmentName}`,
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    const authMethodOptions: apigateway.MethodOptions = {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // IAM role for API Gateway to invoke Lambda functions
    // This replaces per-route Lambda permissions to avoid the 20KB resource policy limit
    const apiGatewayRole = new iam.Role(this, 'ApiGatewayLambdaRole', {
      roleName: `report-portal-apigw-lambda-${environmentName}`,
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      description: 'Role for API Gateway to invoke Lambda functions',
    });

    // Grant invoke on all function aliases
    [authFunction, adminFunction, customerFunction, feedbackFunction,
     analyticsFunction, auditFunction, notificationFunction].forEach(fn => {
      fn.alias.grantInvoke(apiGatewayRole);
    });

    // Lambda integrations using credentials role (no per-route Lambda permissions)
    const authIntegration = new apigateway.LambdaIntegration(authFunction.alias, {
      proxy: true,
      credentialsRole: apiGatewayRole,
    });
    const adminIntegration = new apigateway.LambdaIntegration(adminFunction.alias, {
      proxy: true,
      credentialsRole: apiGatewayRole,
    });
    const customerIntegration = new apigateway.LambdaIntegration(customerFunction.alias, {
      proxy: true,
      credentialsRole: apiGatewayRole,
    });
    const feedbackIntegration = new apigateway.LambdaIntegration(feedbackFunction.alias, {
      proxy: true,
      credentialsRole: apiGatewayRole,
    });
    const analyticsIntegration = new apigateway.LambdaIntegration(analyticsFunction.alias, {
      proxy: true,
      credentialsRole: apiGatewayRole,
    });
    const auditIntegration = new apigateway.LambdaIntegration(auditFunction.alias, {
      proxy: true,
      credentialsRole: apiGatewayRole,
    });
    const notificationIntegration = new apigateway.LambdaIntegration(notificationFunction.alias, {
      proxy: true,
      credentialsRole: apiGatewayRole,
    });

    // ========== Auth Endpoints (no Cognito authorizer - pre-auth) ==========
    const authResource = this.api.root.addResource('auth');
    authResource.addResource('login').addMethod('POST', authIntegration);
    authResource.addResource('mfa-verify').addMethod('POST', authIntegration);
    authResource.addResource('forgot-password').addMethod('POST', authIntegration);
    authResource.addResource('change-password').addMethod('POST', authIntegration, authMethodOptions);
    authResource.addResource('first-login').addMethod('POST', authIntegration);

    // ========== Admin Endpoints ==========
    const adminResource = this.api.root.addResource('admin');

    // Spaces
    const adminSpaces = adminResource.addResource('spaces');
    adminSpaces.addMethod('GET', adminIntegration, authMethodOptions);
    adminSpaces.addMethod('POST', adminIntegration, authMethodOptions);

    const adminSpaceById = adminSpaces.addResource('{spaceId}');
    adminSpaceById.addMethod('DELETE', adminIntegration, authMethodOptions);

    // Reports within spaces
    const adminReports = adminSpaceById.addResource('reports');
    adminReports.addMethod('GET', adminIntegration, authMethodOptions);
    adminReports.addMethod('POST', adminIntegration, authMethodOptions);

    const adminReportById = adminReports.addResource('{reportId}');
    adminReportById.addMethod('DELETE', adminIntegration, authMethodOptions);

    // Invite customer to space
    adminSpaceById.addResource('invite').addMethod('POST', adminIntegration, authMethodOptions);

    // Users
    const adminUsers = adminResource.addResource('users');
    adminUsers.addMethod('GET', adminIntegration, authMethodOptions);

    const adminUserById = adminUsers.addResource('{userId}');
    adminUserById.addResource('disable').addMethod('PUT', adminIntegration, authMethodOptions);
    adminUserById.addResource('enable').addMethod('PUT', adminIntegration, authMethodOptions);
    adminUserById.addMethod('DELETE', adminIntegration, authMethodOptions);
    adminUserById.addResource('reset-mfa').addMethod('PUT', adminIntegration, authMethodOptions);

    // Platform settings (super admin only)
    const adminSettings = adminResource.addResource('settings');
    adminSettings.addMethod('GET', adminIntegration, authMethodOptions);
    adminSettings.addMethod('PUT', adminIntegration, authMethodOptions);

    // Super admin only
    adminResource.addResource('invite-admin').addMethod('POST', adminIntegration, authMethodOptions);

    const impersonateResource = adminResource.addResource('impersonate');
    impersonateResource.addResource('{userId}').addMethod('POST', adminIntegration, authMethodOptions);
    impersonateResource.addMethod('DELETE', adminIntegration, authMethodOptions);

    // Admin feedback inbox
    const adminFeedback = adminResource.addResource('feedback');
    const adminFeedbackInbox = adminFeedback.addResource('inbox');
    adminFeedbackInbox.addMethod('GET', feedbackIntegration, authMethodOptions);
    adminFeedbackInbox.addResource('count').addMethod('GET', feedbackIntegration, authMethodOptions);

    // Admin analytics
    const adminAnalytics = adminResource.addResource('analytics');
    const analyticsBySpace = adminAnalytics.addResource('spaces').addResource('{spaceId}');
    analyticsBySpace.addMethod('GET', analyticsIntegration, authMethodOptions);
    const analyticsByUser = adminAnalytics.addResource('users').addResource('{userId}');
    analyticsByUser.addMethod('GET', analyticsIntegration, authMethodOptions);
    adminAnalytics.addResource('export').addMethod('POST', analyticsIntegration, authMethodOptions);

    // Admin audit log
    adminResource.addResource('audit-log').addMethod('GET', auditIntegration, authMethodOptions);

    // ========== Customer Endpoints ==========
    const customerResource = this.api.root.addResource('customer');
    const customerSpaces = customerResource.addResource('spaces');
    customerSpaces.addMethod('GET', customerIntegration, authMethodOptions);

    const customerSpaceById = customerSpaces.addResource('{spaceId}');
    const customerReports = customerSpaceById.addResource('reports');
    customerReports.addMethod('GET', customerIntegration, authMethodOptions);

    const customerReportById = customerReports.addResource('{reportId}');
    customerReportById.addMethod('GET', customerIntegration, authMethodOptions);

    customerResource.addResource('preferences').addMethod('PUT', customerIntegration, authMethodOptions);

    // ========== Feedback Endpoints ==========
    const spacesResource = this.api.root.addResource('spaces');
    const spaceByIdResource = spacesResource.addResource('{spaceId}');
    const reportsResource = spaceByIdResource.addResource('reports');
    const reportByIdResource = reportsResource.addResource('{reportId}');
    const feedbackResource = reportByIdResource.addResource('feedback');
    feedbackResource.addMethod('GET', feedbackIntegration, authMethodOptions);
    feedbackResource.addMethod('POST', feedbackIntegration, authMethodOptions);

    const feedbackRoot = this.api.root.addResource('feedback');
    const threads = feedbackRoot.addResource('threads');
    const threadById = threads.addResource('{threadId}');
    threadById.addMethod('GET', feedbackIntegration, authMethodOptions);
    threadById.addResource('reply').addMethod('POST', feedbackIntegration, authMethodOptions);
    threadById.addResource('status').addMethod('PUT', feedbackIntegration, authMethodOptions);
    threadById.addResource('attachments').addMethod('POST', feedbackIntegration, authMethodOptions);

    // ========== Notification Endpoints ==========
    const notificationsResource = this.api.root.addResource('notifications');
    notificationsResource.addMethod('GET', notificationIntegration, authMethodOptions);
    notificationsResource.addResource('count').addMethod('GET', notificationIntegration, authMethodOptions);
    notificationsResource.addResource('read-all').addMethod('PUT', notificationIntegration, authMethodOptions);

    const notificationById = notificationsResource.addResource('{notificationId}');
    notificationById.addResource('read').addMethod('PUT', notificationIntegration, authMethodOptions);

    // ========== REGIONAL WAF for API Gateway (CloudFront origin verification) ==========

    this.originVerifyHeaderName = 'x-origin-verify';
    this.originVerifyHeaderValue = cdk.Fn.select(2, cdk.Fn.split('/', cdk.Aws.STACK_ID));

    const apiWaf = new WafWebAcl(this, 'ApiWaf', {
      name: `report-portal-api-waf-${environmentName}`,
      description: `WAF WebACL for Report Portal API Gateway - ${environmentName}`,
      scope: 'REGIONAL',
      rateLimit: envConfig.wafRateLimit,
      allowedGeoLocations: envConfig.allowedGeoLocations,
      cloudFrontHeaderName: this.originVerifyHeaderName,
      cloudFrontHeaderValue: this.originVerifyHeaderValue,
    });

    // Associate WAF with API Gateway stage
    new wafv2.CfnWebACLAssociation(this, 'ApiWafAssociation', {
      resourceArn: this.api.deploymentStage.stageArn,
      webAclArn: apiWaf.webAclArn,
    });

    // ========== Outputs ==========
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      exportName: `${id}-ApiUrl`,
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      exportName: `${id}-ApiId`,
    });
  }

  private grantTableReadWrite(fn: JavaLambdaFunction, tables: dynamodb.ITable[]): void {
    for (const table of tables) {
      table.grantReadWriteData(fn.function);
    }
  }

  private grantTableRead(fn: JavaLambdaFunction, tables: dynamodb.ITable[]): void {
    for (const table of tables) {
      table.grantReadData(fn.function);
    }
  }
}
