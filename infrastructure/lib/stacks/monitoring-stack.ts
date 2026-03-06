import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../bin/app';

export interface MonitoringStackProps extends cdk.StackProps {
  environmentName: string;
  envConfig: EnvironmentConfig;
  apiGateway: apigateway.RestApi;
  lambdaFunctions: lambda.IFunction[];
  tables: dynamodb.ITable[];
}

export class MonitoringStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { environmentName, apiGateway, lambdaFunctions, tables } = props;

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
    for (const fn of lambdaFunctions) {
      const errorAlarm = new cloudwatch.Alarm(this, `LambdaError-${fn.functionName}`, {
        alarmName: `report-portal-lambda-error-${fn.functionName}`,
        alarmDescription: `Lambda function ${fn.functionName} error rate exceeded threshold`,
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
    }

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
    for (const table of tables) {
      const ddbThrottleAlarm = new cloudwatch.Alarm(this, `DdbThrottle-${table.tableName}`, {
        alarmName: `report-portal-ddb-throttle-${table.tableName}`,
        alarmDescription: `DynamoDB throttling on table ${table.tableName}`,
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
    }

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
