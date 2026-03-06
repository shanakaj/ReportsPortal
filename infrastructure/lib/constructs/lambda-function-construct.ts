import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface JavaLambdaFunctionProps {
  functionName: string;
  description: string;
  handler: string;
  codePath: string;
  memorySize?: number;
  timeout?: cdk.Duration;
  environment?: Record<string, string>;
  environmentName: string;
  enableSnapStart?: boolean;
  enableTracing?: boolean;
  logRetentionDays?: number;
}

export class JavaLambdaFunction extends Construct {
  public readonly function: lambda.Function;
  public readonly alias: lambda.Alias;

  constructor(scope: Construct, id: string, props: JavaLambdaFunctionProps) {
    super(scope, id);

    const {
      functionName,
      description,
      handler,
      codePath,
      memorySize = 1024,
      timeout = cdk.Duration.seconds(30),
      environment = {},
      environmentName,
      enableSnapStart = true,
      enableTracing = true,
      logRetentionDays = 30,
    } = props;

    this.function = new lambda.Function(this, 'Function', {
      functionName: `report-portal-${functionName}-${environmentName}`,
      description,
      runtime: lambda.Runtime.JAVA_21,
      handler,
      code: lambda.Code.fromAsset(codePath),
      memorySize,
      timeout,
      environment: {
        JAVA_TOOL_OPTIONS: '-XX:+TieredCompilation -XX:TieredStopAtLevel=1',
        SPRING_PROFILES_ACTIVE: environmentName,
        ...environment,
      },
      tracing: enableTracing ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
      logRetention: logRetentionDays as logs.RetentionDays,
      architecture: lambda.Architecture.X86_64,
    });

    // Enable SnapStart
    if (enableSnapStart) {
      const cfnFunction = this.function.node.defaultChild as lambda.CfnFunction;
      cfnFunction.addPropertyOverride('SnapStart', {
        ApplyOn: 'PublishedVersions',
      });
    }

    // Create a version and alias for SnapStart
    const version = this.function.currentVersion;
    this.alias = new lambda.Alias(this, 'LiveAlias', {
      aliasName: 'live',
      version,
    });
  }

  public grantInvoke(grantee: iam.IGrantable): iam.Grant {
    return this.alias.grantInvoke(grantee);
  }

  public addToRolePolicy(statement: iam.PolicyStatement): void {
    this.function.addToRolePolicy(statement);
  }
}
