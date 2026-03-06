import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

export interface WafWebAclProps {
  name: string;
  description: string;
  rateLimit: number;
  allowedGeoLocations: string[];
  cloudFrontHeaderName?: string;
  cloudFrontHeaderValue?: string;
}

export class WafWebAcl extends Construct {
  public readonly webAcl: wafv2.CfnWebACL;
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: WafWebAclProps) {
    super(scope, id);

    const {
      name,
      description,
      rateLimit,
      allowedGeoLocations,
      cloudFrontHeaderName = 'x-origin-verify',
      cloudFrontHeaderValue = cdk.Fn.select(2, cdk.Fn.split('/', cdk.Aws.STACK_ID)),
    } = props;

    const rules: wafv2.CfnWebACL.RuleProperty[] = [
      // Rule 1: AWS Managed Rules - Core Rule Set (CRS)
      {
        name: 'AWS-AWSManagedRulesCoreRuleSet',
        priority: 1,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesCommonRuleSet',
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `${name}-CRS`,
        },
      },
      // Rule 2: AWS Managed Rules - Known Bad Inputs
      {
        name: 'AWS-AWSManagedRulesKnownBadInputsRuleSet',
        priority: 2,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesKnownBadInputsRuleSet',
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `${name}-KnownBadInputs`,
        },
      },
      // Rule 3: AWS Managed Rules - Bot Control
      {
        name: 'AWS-AWSManagedRulesBotControlRuleSet',
        priority: 3,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesBotControlRuleSet',
            managedRuleGroupConfigs: [
              {
                awsManagedRulesBotControlRuleSet: {
                  inspectionLevel: 'COMMON',
                },
              },
            ],
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `${name}-BotControl`,
        },
      },
      // Rule 4: Rate limiting
      {
        name: 'RateLimitPerIP',
        priority: 4,
        action: { block: {} },
        statement: {
          rateBasedStatement: {
            limit: rateLimit,
            aggregateKeyType: 'IP',
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `${name}-RateLimit`,
        },
      },
      // Rule 5: Geo-restriction
      {
        name: 'GeoRestriction',
        priority: 5,
        action: { block: {} },
        statement: {
          notStatement: {
            statement: {
              geoMatchStatement: {
                countryCodes: allowedGeoLocations,
              },
            },
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `${name}-GeoRestriction`,
        },
      },
      // Rule 6: IP Reputation List
      {
        name: 'AWS-AWSManagedRulesIPReputationList',
        priority: 6,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesAmazonIpReputationList',
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `${name}-IPReputation`,
        },
      },
      // Rule 7: CloudFront header validation (prevent origin bypass)
      {
        name: 'CloudFrontHeaderValidation',
        priority: 7,
        action: { block: {} },
        statement: {
          notStatement: {
            statement: {
              byteMatchStatement: {
                fieldToMatch: {
                  singleHeader: {
                    Name: cloudFrontHeaderName,
                  },
                },
                positionalConstraint: 'EXACTLY',
                searchString: cloudFrontHeaderValue,
                textTransformations: [
                  {
                    priority: 0,
                    type: 'NONE',
                  },
                ],
              },
            },
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `${name}-CloudFrontHeader`,
        },
      },
    ];

    this.webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
      name,
      description,
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      rules,
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: `${name}-WebACL`,
      },
    });

    this.webAclArn = this.webAcl.attrArn;
  }
}
