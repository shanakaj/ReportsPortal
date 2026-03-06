import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
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

    const { environmentName, envConfig } = props;

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

    // Notification Lambda target (referenced — actual function created in API stack)
    // The notification Lambda is created in the API stack but we define EventBridge
    // rules here that target it. The actual wiring happens after both stacks are deployed.

    // We create a placeholder Lambda ARN reference for the rules.
    // The actual Lambda is defined in the API stack and will be wired up.
    const notificationFunctionArn = `arn:aws:lambda:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:function:report-portal-notification-${environmentName}:live`;
    const notificationFunction = lambda.Function.fromFunctionAttributes(this, 'NotificationFunctionRef', {
      functionArn: notificationFunctionArn,
      sameEnvironment: true,
    });

    // Rule 1: New feedback event
    const feedbackNewRule = new events.Rule(this, 'FeedbackNewRule', {
      ruleName: `report-portal-feedback-new-${environmentName}`,
      description: 'Triggers notification when new feedback is posted',
      eventBus: this.eventBus,
      eventPattern: {
        source: ['report-portal'],
        detailType: ['feedback.new'],
      },
    });
    feedbackNewRule.addTarget(new targets.LambdaFunction(notificationFunction, {
      retryAttempts: 3,
      maxEventAge: cdk.Duration.hours(1),
    }));

    // Rule 2: Feedback reply event
    const feedbackReplyRule = new events.Rule(this, 'FeedbackReplyRule', {
      ruleName: `report-portal-feedback-reply-${environmentName}`,
      description: 'Triggers notification when feedback reply is posted',
      eventBus: this.eventBus,
      eventPattern: {
        source: ['report-portal'],
        detailType: ['feedback.reply'],
      },
    });
    feedbackReplyRule.addTarget(new targets.LambdaFunction(notificationFunction, {
      retryAttempts: 3,
      maxEventAge: cdk.Duration.hours(1),
    }));

    // Rule 3: User first login event
    const userFirstLoginRule = new events.Rule(this, 'UserFirstLoginRule', {
      ruleName: `report-portal-user-first-login-${environmentName}`,
      description: 'Triggers notification when a user logs in for the first time',
      eventBus: this.eventBus,
      eventPattern: {
        source: ['report-portal'],
        detailType: ['user.first_login'],
      },
    });
    userFirstLoginRule.addTarget(new targets.LambdaFunction(notificationFunction, {
      retryAttempts: 3,
      maxEventAge: cdk.Duration.hours(1),
    }));

    // Rule 4: Feedback resolved event
    const feedbackResolvedRule = new events.Rule(this, 'FeedbackResolvedRule', {
      ruleName: `report-portal-feedback-resolved-${environmentName}`,
      description: 'Triggers notification when feedback thread is resolved',
      eventBus: this.eventBus,
      eventPattern: {
        source: ['report-portal'],
        detailType: ['feedback.resolved'],
      },
    });
    feedbackResolvedRule.addTarget(new targets.LambdaFunction(notificationFunction, {
      retryAttempts: 3,
      maxEventAge: cdk.Duration.hours(1),
    }));

    // Rule 5: Invitation accepted event
    const invitationAcceptedRule = new events.Rule(this, 'InvitationAcceptedRule', {
      ruleName: `report-portal-invitation-accepted-${environmentName}`,
      description: 'Triggers notification when an invitation is accepted',
      eventBus: this.eventBus,
      eventPattern: {
        source: ['report-portal'],
        detailType: ['invitation.accepted'],
      },
    });
    invitationAcceptedRule.addTarget(new targets.LambdaFunction(notificationFunction, {
      retryAttempts: 3,
      maxEventAge: cdk.Duration.hours(1),
    }));

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
