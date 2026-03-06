import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../bin/app';

export interface FrontendStackProps extends cdk.StackProps {
  environmentName: string;
  envConfig: EnvironmentConfig;
  webAclArn: string;
  api: apigateway.IRestApi;
  apiStageName: string;
  originVerifyHeaderName: string;
  originVerifyHeaderValue: string;
}

export class FrontendStack extends cdk.Stack {
  public readonly portalDistribution: cloudfront.Distribution;
  public readonly reportDistribution: cloudfront.Distribution;
  public readonly portalBucket: s3.Bucket;
  public readonly reportServingBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { environmentName, envConfig, webAclArn, api, apiStageName, originVerifyHeaderName, originVerifyHeaderValue } = props;
    const isProd = environmentName === 'prod';
    const removalPolicy = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // ========== S3 Buckets ==========

    // Portal SPA bucket
    this.portalBucket = new s3.Bucket(this, 'PortalBucket', {
      bucketName: `report-portal-spa-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}-${environmentName}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      removalPolicy,
      autoDeleteObjects: !isProd,
    });

    // Report serving bucket (serves report HTML via CloudFront)
    this.reportServingBucket = new s3.Bucket(this, 'ReportServingBucket', {
      bucketName: `report-portal-reports-serving-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}-${environmentName}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      removalPolicy,
    });

    // ========== CloudFront Signed Cookie Key Group ==========

    // Create a CloudFront public key for signed cookies
    // The actual PEM key must be stored in SSM Parameter Store before deployment
    const publicKey = new cloudfront.PublicKey(this, 'SignedCookiePublicKey', {
      publicKeyName: `report-portal-signed-cookie-key-${environmentName}`,
      encodedKey: cdk.Fn.sub(
        '{{resolve:ssm:/report-portal/${env}/cloudfront/public-key-pem}}',
        { env: environmentName }
      ),
      comment: 'Public key for CloudFront signed cookies for report access',
    });

    const keyGroup = new cloudfront.KeyGroup(this, 'SignedCookieKeyGroup', {
      keyGroupName: `report-portal-signed-cookie-group-${environmentName}`,
      items: [publicKey],
      comment: 'Key group for Report Portal signed cookies',
    });

    // ========== Security Headers Response Policy ==========

    // Portal security headers
    const portalSecurityHeaders = new cloudfront.ResponseHeadersPolicy(this, 'PortalSecurityHeaders', {
      responseHeadersPolicyName: `report-portal-headers-${environmentName}`,
      comment: 'Security headers for Report Portal SPA',
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.days(365),
          includeSubdomains: true,
          preload: true,
          override: true,
        },
        contentTypeOptions: {
          override: true,
        },
        frameOptions: {
          frameOption: cloudfront.HeadersFrameOption.SAMEORIGIN,
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        xssProtection: {
          protection: true,
          modeBlock: true,
          override: true,
        },
        contentSecurityPolicy: {
          contentSecurityPolicy: [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
            `frame-src 'self' https://${envConfig.domainName}`,
            "connect-src 'self' https://*.amazonaws.com https://*.amazoncognito.com",
            "object-src 'none'",
            "base-uri 'self'",
          ].join('; '),
          override: true,
        },
      },
      customHeadersBehavior: {
        customHeaders: [
          {
            header: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
            override: true,
          },
        ],
      },
    });

    // Report-serving security headers (allows Mermaid CDN)
    const reportSecurityHeaders = new cloudfront.ResponseHeadersPolicy(this, 'ReportSecurityHeaders', {
      responseHeadersPolicyName: `report-portal-report-headers-${environmentName}`,
      comment: 'Security headers for report-serving CloudFront distribution',
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.days(365),
          includeSubdomains: true,
          preload: true,
          override: true,
        },
        contentTypeOptions: {
          override: true,
        },
        frameOptions: {
          frameOption: cloudfront.HeadersFrameOption.SAMEORIGIN,
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        xssProtection: {
          protection: true,
          modeBlock: true,
          override: true,
        },
        contentSecurityPolicy: {
          contentSecurityPolicy: [
            "default-src 'self'",
            "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
            `frame-ancestors 'self' https://${envConfig.domainName} https://${envConfig.adminDomainName}`,
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
          ].join('; '),
          override: true,
        },
      },
    });

    // ========== Origin Access Control ==========

    const portalOac = new cloudfront.S3OriginAccessControl(this, 'PortalOAC', {
      originAccessControlName: `report-portal-spa-oac-${environmentName}`,
      description: 'OAC for Portal SPA bucket',
    });

    const reportOac = new cloudfront.S3OriginAccessControl(this, 'ReportOAC', {
      originAccessControlName: `report-portal-reports-oac-${environmentName}`,
      description: 'OAC for Report Serving bucket',
    });

    // ========== API Gateway Origin (CloudFront → API Gateway) ==========

    // Extract API Gateway domain from the REST API URL
    // API GW URL format: https://{restApiId}.execute-api.{region}.amazonaws.com/{stage}
    const apiDomainName = `${api.restApiId}.execute-api.${cdk.Aws.REGION}.amazonaws.com`;

    const apiOrigin = new origins.HttpOrigin(apiDomainName, {
      originPath: `/${apiStageName}`,
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      customHeaders: {
        [originVerifyHeaderName]: originVerifyHeaderValue,
      },
    });

    // CloudFront Function to strip /api prefix before forwarding to API Gateway
    // Request: /api/auth/login → origin receives /auth/login (with originPath prepending /{stage})
    const apiPathRewrite = new cloudfront.Function(this, 'ApiPathRewrite', {
      functionName: `report-portal-api-rewrite-${environmentName}`,
      comment: 'Strip /api prefix from requests before forwarding to API Gateway',
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  request.uri = request.uri.replace(/^\\/api/, '');
  if (request.uri === '') request.uri = '/';
  return request;
}
      `.trim()),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    // Use built-in no-cache policy for API requests
    const apiCachePolicy = cloudfront.CachePolicy.CACHING_DISABLED;

    // ========== Portal CloudFront Distribution ==========

    this.portalDistribution = new cloudfront.Distribution(this, 'PortalDistribution', {
      comment: `Report Portal SPA (${environmentName})`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.portalBucket, {
          originAccessControl: portalOac,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: portalSecurityHeaders,
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: apiCachePolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          compress: true,
          functionAssociations: [
            {
              function: apiPathRewrite,
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            },
          ],
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      webAclId: webAclArn,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enabled: true,
    });

    // ========== Report-Serving CloudFront Distribution ==========

    this.reportDistribution = new cloudfront.Distribution(this, 'ReportDistribution', {
      comment: `Report Portal - Report Serving (${environmentName})`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.reportServingBucket, {
          originAccessControl: reportOac,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: reportSecurityHeaders,
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        trustedKeyGroups: [keyGroup],
      },
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      webAclId: webAclArn,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enabled: true,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 403,
          responsePagePath: '/error/403.html',
          ttl: cdk.Duration.seconds(10),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: '/error/404.html',
          ttl: cdk.Duration.seconds(10),
        },
      ],
    });

    // ========== S3 Bucket Policies for OAC ==========

    this.portalBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudFrontOACReadOnly',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        actions: ['s3:GetObject'],
        resources: [this.portalBucket.arnForObjects('*')],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${cdk.Aws.ACCOUNT_ID}:distribution/${this.portalDistribution.distributionId}`,
          },
        },
      })
    );

    this.reportServingBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudFrontOACReadOnly',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        actions: ['s3:GetObject'],
        resources: [this.reportServingBucket.arnForObjects('*')],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${cdk.Aws.ACCOUNT_ID}:distribution/${this.reportDistribution.distributionId}`,
          },
        },
      })
    );

    // ========== Outputs ==========

    new cdk.CfnOutput(this, 'PortalDistributionId', {
      value: this.portalDistribution.distributionId,
      exportName: `${id}-PortalDistributionId`,
    });

    new cdk.CfnOutput(this, 'PortalDistributionDomain', {
      value: this.portalDistribution.distributionDomainName,
      exportName: `${id}-PortalDistributionDomain`,
    });

    new cdk.CfnOutput(this, 'ReportDistributionId', {
      value: this.reportDistribution.distributionId,
      exportName: `${id}-ReportDistributionId`,
    });

    new cdk.CfnOutput(this, 'ReportDistributionDomain', {
      value: this.reportDistribution.distributionDomainName,
      exportName: `${id}-ReportDistributionDomain`,
    });

    new cdk.CfnOutput(this, 'PortalBucketName', {
      value: this.portalBucket.bucketName,
      exportName: `${id}-PortalBucketName`,
    });

    new cdk.CfnOutput(this, 'ReportServingBucketName', {
      value: this.reportServingBucket.bucketName,
      exportName: `${id}-ReportServingBucketName`,
    });
  }
}
