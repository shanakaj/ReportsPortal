import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface CustomerBucketProps {
  customerSpaceId: string;
  encryptionKey: kms.IKey;
  auditBucket: s3.IBucket;
  cloudFrontOacId?: string;
  cloudFrontDistributionId?: string;
}

export class CustomerBucket extends Construct {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: CustomerBucketProps) {
    super(scope, id);

    const {
      customerSpaceId,
      encryptionKey,
      auditBucket,
    } = props;

    const bucketName = `report-portal-${customerSpaceId}-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`;

    this.bucket = new s3.Bucket(this, 'Bucket', {
      bucketName,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      serverAccessLogsBucket: auditBucket,
      serverAccessLogsPrefix: `s3-access-logs/${bucketName}/`,
      lifecycleRules: [
        {
          id: 'IntelligentTiering',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
        {
          id: 'NonCurrentVersionExpiry',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(365),
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
    });
  }

  public grantCloudFrontRead(distributionArn: string): void {
    this.bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudFrontServicePrincipalReadOnly',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        actions: ['s3:GetObject'],
        resources: [this.bucket.arnForObjects('*')],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': distributionArn,
          },
        },
      })
    );
  }
}
