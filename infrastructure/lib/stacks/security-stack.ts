import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../bin/app';
import { WafWebAcl } from '../constructs/waf-construct';

export interface SecurityStackProps extends cdk.StackProps {
  environmentName: string;
  envConfig: EnvironmentConfig;
}

export class SecurityStack extends cdk.Stack {
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);

    const { environmentName, envConfig } = props;

    // WAF WebACL (must be in us-east-1 for CloudFront)
    const waf = new WafWebAcl(this, 'WebAcl', {
      name: `report-portal-waf-${environmentName}`,
      description: `WAF WebACL for Report Portal - ${environmentName}`,
      rateLimit: envConfig.wafRateLimit,
      allowedGeoLocations: envConfig.allowedGeoLocations,
    });

    this.webAclArn = waf.webAclArn;

    // ========== Outputs ==========

    new cdk.CfnOutput(this, 'WebAclArn', {
      value: this.webAclArn,
      exportName: `${id}-WebAclArn`,
    });

    new cdk.CfnOutput(this, 'WebAclId', {
      value: waf.webAcl.attrId,
      exportName: `${id}-WebAclId`,
    });
  }
}
