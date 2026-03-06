import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../bin/app';

export interface StorageStackProps extends cdk.StackProps {
  environmentName: string;
  envConfig: EnvironmentConfig;
}

export class StorageStack extends cdk.Stack {
  public readonly feedbackBucket: s3.Bucket;
  public readonly auditBucket: s3.Bucket;
  public readonly encryptionKey: kms.Key;
  public readonly usersTable: dynamodb.Table;
  public readonly spacesTable: dynamodb.Table;
  public readonly reportsTable: dynamodb.Table;
  public readonly invitationsTable: dynamodb.Table;
  public readonly auditLogTable: dynamodb.Table;
  public readonly analyticsTable: dynamodb.Table;
  public readonly notificationsTable: dynamodb.Table;
  public readonly feedbackThreadsTable: dynamodb.Table;
  public readonly feedbackMessagesTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { environmentName } = props;
    const isProd = environmentName === 'prod';
    const removalPolicy = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // KMS Key for encryption
    this.encryptionKey = new kms.Key(this, 'EncryptionKey', {
      alias: `report-portal-key-${environmentName}`,
      description: 'KMS key for Report Portal data encryption',
      enableKeyRotation: true,
      removalPolicy,
    });

    // Audit Logging Bucket (must be created first as other buckets log to it)
    this.auditBucket = new s3.Bucket(this, 'AuditBucket', {
      bucketName: `report-portal-audit-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}-${environmentName}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      removalPolicy,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      lifecycleRules: [
        {
          id: 'ArchiveOldLogs',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(730), // 2 years
            },
          ],
        },
      ],
    });

    // Feedback Attachments Bucket
    this.feedbackBucket = new s3.Bucket(this, 'FeedbackBucket', {
      bucketName: `report-portal-feedback-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}-${environmentName}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      removalPolicy,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      serverAccessLogsBucket: this.auditBucket,
      serverAccessLogsPrefix: 'feedback-bucket-access-logs/',
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ['*'], // Tightened at CloudFront/API layer
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        {
          id: 'GlacierArchive',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(730), // 2 years
            },
          ],
        },
      ],
    });

    // ========== DynamoDB Tables ==========

    // Users Table — PK: USER#{userId}, SK: PROFILE
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `report-portal-users-${environmentName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionKey,
      pointInTimeRecovery: true,
      removalPolicy,
    });

    // GSI for email lookup
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Spaces Table — PK: SPACE#{spaceId}, SK: META
    this.spacesTable = new dynamodb.Table(this, 'SpacesTable', {
      tableName: `report-portal-spaces-${environmentName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionKey,
      pointInTimeRecovery: true,
      removalPolicy,
    });

    this.spacesTable.addGlobalSecondaryIndex({
      indexName: 'spaceName-index',
      partitionKey: { name: 'spaceName', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Reports Table — PK: SPACE#{spaceId}, SK: REPORT#{reportId}
    this.reportsTable = new dynamodb.Table(this, 'ReportsTable', {
      tableName: `report-portal-reports-${environmentName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionKey,
      pointInTimeRecovery: true,
      removalPolicy,
    });

    // Invitations Table — PK: INVITE#{token}, SK: META
    this.invitationsTable = new dynamodb.Table(this, 'InvitationsTable', {
      tableName: `report-portal-invitations-${environmentName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionKey,
      timeToLiveAttribute: 'expiresAtTtl',
      removalPolicy,
    });

    // GSI for email lookup on invitations
    this.invitationsTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // AuditLog Table — PK: AUDIT#{date}, SK: {timestamp}#{eventId}
    this.auditLogTable = new dynamodb.Table(this, 'AuditLogTable', {
      tableName: `report-portal-audit-log-${environmentName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionKey,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
      removalPolicy,
    });

    // GSI for actor-based queries
    this.auditLogTable.addGlobalSecondaryIndex({
      indexName: 'actor-index',
      partitionKey: { name: 'actor', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for space-based audit queries
    this.auditLogTable.addGlobalSecondaryIndex({
      indexName: 'space-index',
      partitionKey: { name: 'spaceId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Analytics Table — PK: ANALYTICS#{spaceId}#{date}, SK: {timestamp}#{eventId}
    this.analyticsTable = new dynamodb.Table(this, 'AnalyticsTable', {
      tableName: `report-portal-analytics-${environmentName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionKey,
      timeToLiveAttribute: 'ttl',
      removalPolicy,
    });

    // GSI: report-analytics-index for per-report analytics
    this.analyticsTable.addGlobalSecondaryIndex({
      indexName: 'report-analytics-index',
      partitionKey: { name: 'reportKey', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Notifications Table — PK: NOTIFICATION#{userId}, SK: {timestamp}#{notificationId}
    this.notificationsTable = new dynamodb.Table(this, 'NotificationsTable', {
      tableName: `report-portal-notifications-${environmentName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionKey,
      timeToLiveAttribute: 'ttl',
      removalPolicy,
    });

    // GSI: unread-index for fast unread count
    this.notificationsTable.addGlobalSecondaryIndex({
      indexName: 'unread-index',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // FeedbackThreads Table — PK: THREAD#{threadId}, SK: META
    this.feedbackThreadsTable = new dynamodb.Table(this, 'FeedbackThreadsTable', {
      tableName: `report-portal-feedback-threads-${environmentName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionKey,
      pointInTimeRecovery: true,
      removalPolicy,
    });

    // GSI: report-threads-index
    this.feedbackThreadsTable.addGlobalSecondaryIndex({
      indexName: 'report-threads-index',
      partitionKey: { name: 'reportKey', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'lastMessageAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI: space-threads-index
    this.feedbackThreadsTable.addGlobalSecondaryIndex({
      indexName: 'space-threads-index',
      partitionKey: { name: 'spaceKey', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'lastMessageAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI: status-index
    this.feedbackThreadsTable.addGlobalSecondaryIndex({
      indexName: 'status-index',
      partitionKey: { name: 'statusKey', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'lastMessageAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // FeedbackMessages Table — PK: THREAD#{threadId}, SK: MSG#{timestamp}#{messageId}
    this.feedbackMessagesTable = new dynamodb.Table(this, 'FeedbackMessagesTable', {
      tableName: `report-portal-feedback-messages-${environmentName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionKey,
      pointInTimeRecovery: true,
      removalPolicy,
    });

    // ========== Outputs ==========
    new cdk.CfnOutput(this, 'EncryptionKeyArn', {
      value: this.encryptionKey.keyArn,
      exportName: `${id}-EncryptionKeyArn`,
    });

    new cdk.CfnOutput(this, 'FeedbackBucketName', {
      value: this.feedbackBucket.bucketName,
      exportName: `${id}-FeedbackBucketName`,
    });

    new cdk.CfnOutput(this, 'AuditBucketName', {
      value: this.auditBucket.bucketName,
      exportName: `${id}-AuditBucketName`,
    });

    new cdk.CfnOutput(this, 'UsersTableName', {
      value: this.usersTable.tableName,
      exportName: `${id}-UsersTableName`,
    });

    new cdk.CfnOutput(this, 'SpacesTableName', {
      value: this.spacesTable.tableName,
      exportName: `${id}-SpacesTableName`,
    });
  }
}
