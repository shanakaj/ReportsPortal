import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as ce from 'aws-cdk-lib/aws-ce';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../bin/app';

export interface MonitoringStackProps extends cdk.StackProps {
  environmentName: string;
  envConfig: EnvironmentConfig;
  apiGateway: apigateway.RestApi;
  lambdaFunctions: lambda.IFunction[];
  dlqQueues: sqs.IQueue[];
  encryptionKey: kms.IKey;
  tables: dynamodb.ITable[];
}

export class MonitoringStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { environmentName, envConfig, apiGateway, lambdaFunctions, dlqQueues, encryptionKey, tables } = props;

    // SNS Topic for alarms
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `report-portal-alarms-${environmentName}`,
      displayName: `Report Portal Alarms (${environmentName})`,
    });

    // ========== CloudWatch Dashboard ==========

    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `ReportPortal-${environmentName}`,
      defaultInterval: cdk.Duration.hours(3),
    });

    // ---- API Gateway Widgets ----
    const apiGatewayWidgets: cloudwatch.IWidget[] = [
      new cloudwatch.TextWidget({
        markdown: '# API Gateway Metrics',
        width: 24,
        height: 1,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Request Count',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            dimensionsMap: { ApiName: apiGateway.restApiName },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Latency (p50, p95, p99)',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Latency',
            dimensionsMap: { ApiName: apiGateway.restApiName },
            statistic: 'p50',
            period: cdk.Duration.minutes(5),
            label: 'p50',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Latency',
            dimensionsMap: { ApiName: apiGateway.restApiName },
            statistic: 'p95',
            period: cdk.Duration.minutes(5),
            label: 'p95',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Latency',
            dimensionsMap: { ApiName: apiGateway.restApiName },
            statistic: 'p99',
            period: cdk.Duration.minutes(5),
            label: 'p99',
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Errors (4XX & 5XX)',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '4XXError',
            dimensionsMap: { ApiName: apiGateway.restApiName },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: '4XX Errors',
            color: '#ff9900',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '5XXError',
            dimensionsMap: { ApiName: apiGateway.restApiName },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: '5XX Errors',
            color: '#d13212',
          }),
        ],
      }),
    ];

    this.dashboard.addWidgets(...apiGatewayWidgets);

    // ---- Lambda Widgets ----
    const lambdaWidgets: cloudwatch.IWidget[] = [
      new cloudwatch.TextWidget({
        markdown: '# Lambda Function Metrics',
        width: 24,
        height: 1,
      }),
    ];

    // Lambda invocations and errors
    const invocationMetrics: cloudwatch.IMetric[] = [];
    const errorMetrics: cloudwatch.IMetric[] = [];
    const durationMetrics: cloudwatch.IMetric[] = [];
    const throttleMetrics: cloudwatch.IMetric[] = [];

    for (const fn of lambdaFunctions) {
      invocationMetrics.push(
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Invocations',
          dimensionsMap: { FunctionName: fn.functionName },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: fn.functionName,
        })
      );
      errorMetrics.push(
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Errors',
          dimensionsMap: { FunctionName: fn.functionName },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: fn.functionName,
        })
      );
      durationMetrics.push(
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Duration',
          dimensionsMap: { FunctionName: fn.functionName },
          statistic: 'p95',
          period: cdk.Duration.minutes(5),
          label: fn.functionName,
        })
      );
      throttleMetrics.push(
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Throttles',
          dimensionsMap: { FunctionName: fn.functionName },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: fn.functionName,
        })
      );
    }

    lambdaWidgets.push(
      new cloudwatch.GraphWidget({
        title: 'Lambda - Invocations',
        width: 12,
        height: 6,
        left: invocationMetrics,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda - Errors',
        width: 12,
        height: 6,
        left: errorMetrics,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda - Duration (p95)',
        width: 12,
        height: 6,
        left: durationMetrics,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda - Throttles',
        width: 12,
        height: 6,
        left: throttleMetrics,
      })
    );

    this.dashboard.addWidgets(...lambdaWidgets);

    // ---- DynamoDB Widgets ----
    const ddbWidgets: cloudwatch.IWidget[] = [
      new cloudwatch.TextWidget({
        markdown: '# DynamoDB Metrics',
        width: 24,
        height: 1,
      }),
    ];

    const readCapacityMetrics: cloudwatch.IMetric[] = [];
    const writeCapacityMetrics: cloudwatch.IMetric[] = [];
    const throttledMetrics: cloudwatch.IMetric[] = [];

    for (const table of tables) {
      readCapacityMetrics.push(
        new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'ConsumedReadCapacityUnits',
          dimensionsMap: { TableName: table.tableName },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: table.tableName,
        })
      );
      writeCapacityMetrics.push(
        new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'ConsumedWriteCapacityUnits',
          dimensionsMap: { TableName: table.tableName },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: table.tableName,
        })
      );
      throttledMetrics.push(
        new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'ThrottledRequests',
          dimensionsMap: { TableName: table.tableName },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          label: table.tableName,
        })
      );
    }

    ddbWidgets.push(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB - Read Capacity Consumed',
        width: 8,
        height: 6,
        left: readCapacityMetrics,
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB - Write Capacity Consumed',
        width: 8,
        height: 6,
        left: writeCapacityMetrics,
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB - Throttled Requests',
        width: 8,
        height: 6,
        left: throttledMetrics,
      })
    );

    this.dashboard.addWidgets(...ddbWidgets);

    // ========== Alarms ==========

    // API Gateway 5XX Error Rate Alarm
    const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      alarmName: `report-portal-api-5xx-${environmentName}`,
      alarmDescription: 'API Gateway 5XX error rate exceeded threshold',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: { ApiName: apiGateway.restApiName },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    api5xxAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

    // API Gateway p95 Latency Alarm
    const apiLatencyAlarm = new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      alarmName: `report-portal-api-latency-p95-${environmentName}`,
      alarmDescription: 'API Gateway p95 latency exceeded 500ms',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
        dimensionsMap: { ApiName: apiGateway.restApiName },
        statistic: 'p95',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 500,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiLatencyAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

    // Lambda Error Alarms (one per function)
    lambdaFunctions.forEach((fn, idx) => {
      const errorAlarm = new cloudwatch.Alarm(this, `LambdaError${idx}`, {
        alarmName: `report-portal-lambda-error-${idx}-${environmentName}`,
        alarmDescription: `Lambda function error rate exceeded threshold`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Errors',
          dimensionsMap: { FunctionName: fn.functionName },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      errorAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));
    });

    // Lambda Throttle Alarm (aggregate)
    const throttleAlarm = new cloudwatch.Alarm(this, 'LambdaThrottleAlarm', {
      alarmName: `report-portal-lambda-throttle-${environmentName}`,
      alarmDescription: 'Lambda throttling detected across functions',
      metric: new cloudwatch.MathExpression({
        expression: lambdaFunctions.map((_, i) => `m${i}`).join(' + '),
        usingMetrics: Object.fromEntries(
          lambdaFunctions.map((fn, i) => [
            `m${i}`,
            new cloudwatch.Metric({
              namespace: 'AWS/Lambda',
              metricName: 'Throttles',
              dimensionsMap: { FunctionName: fn.functionName },
              statistic: 'Sum',
              period: cdk.Duration.minutes(5),
            }),
          ])
        ),
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    throttleAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

    // DynamoDB Throttle Alarm
    tables.forEach((table, idx) => {
      const ddbThrottleAlarm = new cloudwatch.Alarm(this, `DdbThrottle${idx}`, {
        alarmName: `report-portal-ddb-throttle-${idx}-${environmentName}`,
        alarmDescription: `DynamoDB throttling detected`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'ThrottledRequests',
          dimensionsMap: { TableName: table.tableName },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      ddbThrottleAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));
    });

    // ========== Budget Alerts ==========

    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: `report-portal-monthly-${environmentName}`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: {
          amount: 10,
          unit: 'USD',
        },
        costFilters: {
          Service: [
            'AWS Lambda',
            'Amazon DynamoDB',
            'Amazon Simple Storage Service',
            'Amazon CloudFront',
            'Amazon API Gateway',
            'Amazon Simple Email Service',
            'Amazon EventBridge',
            'Amazon Cognito',
            'AWS WAF',
            'AWS Key Management Service',
          ],
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 50,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [{ subscriptionType: 'EMAIL', address: envConfig.superAdminEmail }],
        },
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 80,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [{ subscriptionType: 'EMAIL', address: envConfig.superAdminEmail }],
        },
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 100,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [
            { subscriptionType: 'EMAIL', address: envConfig.superAdminEmail },
            { subscriptionType: 'SNS', address: this.alarmTopic.topicArn },
          ],
        },
        {
          notification: {
            notificationType: 'FORECASTED',
            comparisonOperator: 'GREATER_THAN',
            threshold: 100,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [{ subscriptionType: 'EMAIL', address: envConfig.superAdminEmail }],
        },
      ],
    });

    // ========== Cost Anomaly Detection ==========

    const anomalyMonitor = new ce.CfnAnomalyMonitor(this, 'CostAnomalyMonitor', {
      monitorName: `report-portal-anomaly-monitor-${environmentName}`,
      monitorType: 'DIMENSIONAL',
      monitorDimension: 'SERVICE',
    });

    // Allow Cost Explorer anomaly alerts to publish to SNS
    this.alarmTopic.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowCostAlertsPublish',
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('costalerts.amazonaws.com')],
      actions: ['SNS:Publish'],
      resources: [this.alarmTopic.topicArn],
    }));

    new ce.CfnAnomalySubscription(this, 'CostAnomalySubscription', {
      subscriptionName: `report-portal-anomaly-sub-${environmentName}`,
      frequency: 'IMMEDIATE',
      monitorArnList: [anomalyMonitor.attrMonitorArn],
      subscribers: [
        {
          type: 'SNS',
          address: this.alarmTopic.topicArn,
        },
      ],
      thresholdExpression: JSON.stringify({
        Dimensions: {
          Key: 'ANOMALY_TOTAL_IMPACT_ABSOLUTE',
          MatchOptions: ['GREATER_THAN_OR_EQUAL'],
          Values: ['5'],
        },
      }),
    });

    // ========== DLQ Depth Alarms ==========

    const dlqNames = ['auth', 'admin', 'customer', 'feedback', 'analytics', 'audit', 'notification'];
    dlqQueues.forEach((dlq, idx) => {
      const dlqAlarm = new cloudwatch.Alarm(this, `DlqDepth${dlqNames[idx]}`, {
        alarmName: `report-portal-dlq-depth-${dlqNames[idx]}-${environmentName}`,
        alarmDescription: `DLQ depth exceeded threshold for ${dlqNames[idx]} function`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/SQS',
          metricName: 'ApproximateNumberOfMessagesVisible',
          dimensionsMap: { QueueName: dlq.queueName },
          statistic: 'Maximum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      dlqAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));
    });

    // ========== Per-function Error & Throttle Alarms (Circuit Breaker) ==========

    lambdaFunctions.forEach((fn, idx) => {
      // Error alarm: Errors > 10 over 5 minutes
      const fnErrorAlarm = new cloudwatch.Alarm(this, `CircuitBreakerError${idx}`, {
        alarmName: `report-portal-cb-error-${idx}-${environmentName}`,
        alarmDescription: `Circuit breaker: Lambda errors exceeded threshold for function ${idx}`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Errors',
          dimensionsMap: { FunctionName: fn.functionName },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 10,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      fnErrorAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

      // Throttle alarm: Throttles > 5 over 5 minutes
      const fnThrottleAlarm = new cloudwatch.Alarm(this, `CircuitBreakerThrottle${idx}`, {
        alarmName: `report-portal-cb-throttle-${idx}-${environmentName}`,
        alarmDescription: `Circuit breaker: Lambda throttles exceeded threshold for function ${idx}`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Throttles',
          dimensionsMap: { FunctionName: fn.functionName },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      fnThrottleAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));
    });

    // ========== Circuit Breaker Lambda ==========

    const circuitBreakerDlq = new sqs.Queue(this, 'CircuitBreakerDlq', {
      queueName: `report-portal-circuit-breaker-dlq-${environmentName}`,
      retentionPeriod: cdk.Duration.days(14),
      encryptionMasterKey: encryptionKey,
    });

    const functionArns = lambdaFunctions.map(fn => fn.functionArn);

    const circuitBreakerFn = new lambda.Function(this, 'CircuitBreakerFunction', {
      functionName: `report-portal-circuit-breaker-${environmentName}`,
      description: 'Disables Lambda functions when budget threshold is breached',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      reservedConcurrentExecutions: 1,
      deadLetterQueue: circuitBreakerDlq,
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        FUNCTION_ARNS: JSON.stringify(functionArns),
        SNS_TOPIC_ARN: this.alarmTopic.topicArn,
      },
      code: lambda.Code.fromInline(`
const { LambdaClient, PutFunctionConcurrencyCommand } = require('@aws-sdk/client-lambda');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

exports.handler = async (event) => {
  const lambdaClient = new LambdaClient();
  const snsClient = new SNSClient();
  const functionArns = JSON.parse(process.env.FUNCTION_ARNS || '[]');
  const topicArn = process.env.SNS_TOPIC_ARN;
  const disabledFunctions = [];

  for (const arn of functionArns) {
    const functionName = arn.split(':function:')[1];
    try {
      await lambdaClient.send(new PutFunctionConcurrencyCommand({
        FunctionName: functionName,
        ReservedConcurrentExecutions: 0,
      }));
      disabledFunctions.push(functionName);
      console.log('Disabled function:', functionName);
    } catch (err) {
      console.error('Failed to disable function:', functionName, err);
    }
  }

  if (disabledFunctions.length > 0 && topicArn) {
    await snsClient.send(new PublishCommand({
      TopicArn: topicArn,
      Subject: 'CIRCUIT BREAKER ACTIVATED - Lambda functions disabled',
      Message: [
        'Budget threshold breached. The following Lambda functions have been disabled (concurrency set to 0):',
        '',
        ...disabledFunctions.map(f => '  - ' + f),
        '',
        'To re-enable, manually set ReservedConcurrentExecutions back to the desired value.',
      ].join('\\n'),
    }));
  }

  return { statusCode: 200, disabled: disabledFunctions };
};
      `),
    });

    // Grant the circuit breaker Lambda permission to disable other functions
    circuitBreakerFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'AllowPutFunctionConcurrency',
      effect: iam.Effect.ALLOW,
      actions: ['lambda:PutFunctionConcurrency'],
      resources: functionArns,
    }));

    // Grant SNS publish permission
    this.alarmTopic.grantPublish(circuitBreakerFn);

    // Subscribe circuit breaker to the alarm topic (triggered by budget alerts)
    this.alarmTopic.addSubscription(
      new sns_subscriptions.LambdaSubscription(circuitBreakerFn)
    );

    // ========== Outputs ==========

    new cdk.CfnOutput(this, 'DashboardName', {
      value: this.dashboard.dashboardName,
      exportName: `${id}-DashboardName`,
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      exportName: `${id}-AlarmTopicArn`,
    });
  }
}
