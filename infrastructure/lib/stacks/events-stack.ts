import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../bin/app';

export interface EventsStackProps extends cdk.StackProps {
  environmentName: string;
  envConfig: EnvironmentConfig;
}

export class EventsStack extends cdk.Stack {
  public readonly eventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: EventsStackProps) {
    super(scope, id, props);

    const { environmentName } = props;

    // Custom Event Bus
    this.eventBus = new events.EventBus(this, 'EventBus', {
      eventBusName: `report-portal-events-${environmentName}`,
    });

    // Archive for event replay/debugging
    this.eventBus.archive('EventArchive', {
      archiveName: `report-portal-events-archive-${environmentName}`,
      description: 'Archive for Report Portal events',
      eventPattern: {
        source: ['report-portal'],
      },
      retention: cdk.Duration.days(90),
    });

    // EventBridge rules that target Lambda functions are defined in the Api stack
    // where the notification Lambda is created, to avoid circular dependencies.

    // ========== Outputs ==========
    new cdk.CfnOutput(this, 'EventBusName', {
      value: this.eventBus.eventBusName,
      exportName: `${id}-EventBusName`,
    });

    new cdk.CfnOutput(this, 'EventBusArn', {
      value: this.eventBus.eventBusArn,
      exportName: `${id}-EventBusArn`,
    });
  }
}
