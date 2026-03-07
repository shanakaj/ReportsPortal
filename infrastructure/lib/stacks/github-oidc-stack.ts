import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface GitHubOidcStackProps extends cdk.StackProps {
  /** GitHub org/user name (e.g., 'shanaka-versent') */
  githubOrg: string;
  /** GitHub repo name (e.g., 'ReportsPortal') */
  githubRepo: string;
  /** Branches allowed to assume the deploy role (default: all) */
  allowedBranches?: string[];
}

/**
 * Bootstrap stack: creates GitHub Actions OIDC provider + deploy role.
 *
 * Deploy once per AWS account:
 *   npx cdk deploy ReportPortal-GitHubOIDC --context environment=dev
 *
 * Then set the role ARN as a GitHub repo variable:
 *   AWS_DEPLOY_ROLE_ARN = (see stack output)
 */
export class GitHubOidcStack extends cdk.Stack {
  public readonly deployRole: iam.IRole;

  constructor(scope: Construct, id: string, props: GitHubOidcStackProps) {
    super(scope, id, props);

    // OIDC Identity Provider — trusts GitHub's token issuer
    // Uses fromOpenIdConnectProviderArn if it already exists, otherwise creates it
    const providerArn = `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`;

    let provider: iam.IOpenIdConnectProvider;
    try {
      provider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
        this, 'GitHubOidcProvider', providerArn,
      );
    } catch {
      provider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
        url: 'https://token.actions.githubusercontent.com',
        clientIds: ['sts.amazonaws.com'],
        thumbprints: ['6938fd4d98bab03faadb97b34396831e3780aea1'],
      });
    }

    // Build the subject claim filter
    const repoFilter = `repo:${props.githubOrg}/${props.githubRepo}`;
    const subjectClaims = props.allowedBranches?.length
      ? props.allowedBranches.map(b => `${repoFilter}:ref:refs/heads/${b}`)
      : [`${repoFilter}:*`];

    // IAM Role — GitHub Actions assumes this via OIDC
    const role = new iam.Role(this, 'GitHubActionsDeployRole', {
      roleName: `GitHubActions-ReportPortal-Deploy`,
      assumedBy: new iam.WebIdentityPrincipal(
        provider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': subjectClaims,
          },
        },
      ),
      maxSessionDuration: cdk.Duration.hours(1),
      description: `Deploy role for GitHub Actions - ${props.githubOrg}/${props.githubRepo}`,
    });

    // Permissions needed for CDK deploy + frontend deploy
    // CDK needs broad permissions to manage CloudFormation stacks
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'),
    );
    // NOTE: For production, replace AdministratorAccess with a scoped policy.
    // The minimum permissions needed are:
    //   - cloudformation:* (CDK stack operations)
    //   - s3:* (CDK assets + frontend deploy)
    //   - lambda:*, apigateway:*, cognito-idp:*, dynamodb:*
    //   - iam:PassRole, iam:CreateRole (CDK-managed roles)
    //   - cloudfront:*, wafv2:*, ses:*, events:*
    //   - ssm:GetParameter (CDK context lookups)
    //   - sts:AssumeRole (CDK bootstrap roles)

    this.deployRole = role;

    // ─── Outputs ───────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: role.roleArn,
      description: 'Set this as AWS_DEPLOY_ROLE_ARN in GitHub repo settings → Environments',
    });

    new cdk.CfnOutput(this, 'OidcProviderArn', {
      value: provider.openIdConnectProviderArn,
      description: 'GitHub OIDC Identity Provider ARN',
    });

    new cdk.CfnOutput(this, 'SetupInstructions', {
      value: `Go to https://github.com/${props.githubOrg}/${props.githubRepo}/settings/variables/actions and create variable AWS_DEPLOY_ROLE_ARN = ${role.roleArn}`,
    });
  }
}
