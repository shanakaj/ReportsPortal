import * as cdk from 'aws-cdk-lib';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../bin/app';

export interface EmailStackProps extends cdk.StackProps {
  environmentName: string;
  envConfig: EnvironmentConfig;
}

export class EmailStack extends cdk.Stack {
  public readonly sesIdentity: ses.EmailIdentity;
  public readonly bounceComplaintTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: EmailStackProps) {
    super(scope, id, props);

    const { environmentName, envConfig } = props;

    // ========== SES Email Identity (Domain) ==========

    this.sesIdentity = new ses.EmailIdentity(this, 'EmailIdentity', {
      identity: ses.Identity.domain(envConfig.sesDomain),
      feedbackForwarding: true,
    });

    // ========== Bounce/Complaint SNS Topic ==========

    this.bounceComplaintTopic = new sns.Topic(this, 'BounceComplaintTopic', {
      topicName: `report-portal-ses-bounces-${environmentName}`,
      displayName: 'Report Portal SES Bounce/Complaint Notifications',
    });

    // Bounce/Complaint handler Lambda
    const bounceHandler = new lambda.Function(this, 'BounceHandler', {
      functionName: `report-portal-bounce-handler-${environmentName}`,
      description: 'Handles SES bounce and complaint notifications, marks users as email_bounced',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

const ddb = new DynamoDBClient({});
const USERS_TABLE = process.env.USERS_TABLE;

exports.handler = async (event) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message);
    const notificationType = message.notificationType;

    if (notificationType === 'Bounce' || notificationType === 'Complaint') {
      const recipients = notificationType === 'Bounce'
        ? message.bounce.bouncedRecipients
        : message.complaint.complainedRecipients;

      for (const recipient of recipients) {
        const email = recipient.emailAddress;
        console.log(\`Marking user \${email} as email_bounced due to \${notificationType}\`);

        try {
          await ddb.send(new UpdateItemCommand({
            TableName: USERS_TABLE,
            Key: {
              PK: { S: \`USER#\${email}\` },
              SK: { S: 'PROFILE' },
            },
            UpdateExpression: 'SET emailBounced = :bounced, bounceType = :type, bounceTimestamp = :ts',
            ExpressionAttributeValues: {
              ':bounced': { BOOL: true },
              ':type': { S: notificationType.toLowerCase() },
              ':ts': { S: new Date().toISOString() },
            },
          }));
        } catch (err) {
          console.error(\`Failed to update user \${email}:\`, err);
        }
      }
    }
  }
};
      `),
      timeout: cdk.Duration.seconds(30),
      environment: {
        USERS_TABLE: `report-portal-users-${environmentName}`,
      },
    });

    // Grant DynamoDB access to bounce handler
    bounceHandler.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:UpdateItem'],
      resources: [
        `arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/report-portal-users-${environmentName}`,
      ],
    }));

    // Subscribe Lambda to SNS topic
    this.bounceComplaintTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(bounceHandler)
    );

    // ========== SES Email Templates ==========

    new ses.CfnTemplate(this, 'InvitationTemplate', {
      template: {
        templateName: `report-portal-invitation-${environmentName}`,
        subjectPart: 'You have been invited to the Versent Report Portal',
        htmlPart: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
  <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Versent Report Portal</h1>
    </div>
    <p style="color: #333; font-size: 16px; line-height: 1.6;">Hello,</p>
    <p style="color: #333; font-size: 16px; line-height: 1.6;">You have been invited to access reports on <strong>{{spaceName}}</strong>.</p>
    <p style="color: #333; font-size: 16px; line-height: 1.6;">Click the button below to set up your account:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{invitationLink}}" style="background-color: #0066cc; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; display: inline-block;">Accept Invitation</a>
    </div>
    <p style="color: #666; font-size: 14px; line-height: 1.6;">This invitation expires in {{expiryHours}} hours.</p>
    <p style="color: #666; font-size: 14px; line-height: 1.6;">If you did not expect this invitation, please ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">Versent Pty Ltd</p>
  </div>
</div>
</body>
</html>`,
        textPart: 'You have been invited to access reports on {{spaceName}}. Visit {{invitationLink}} to set up your account. This invitation expires in {{expiryHours}} hours.',
      },
    });

    new ses.CfnTemplate(this, 'AdminInvitationTemplate', {
      template: {
        templateName: `report-portal-admin-invitation-${environmentName}`,
        subjectPart: 'You have been invited as an admin to the Versent Report Portal',
        htmlPart: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
  <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Versent Report Portal</h1>
    </div>
    <p style="color: #333; font-size: 16px; line-height: 1.6;">Hello,</p>
    <p style="color: #333; font-size: 16px; line-height: 1.6;">You have been invited as an <strong>Administrator</strong> to the Versent Report Portal.</p>
    <p style="color: #333; font-size: 16px; line-height: 1.6;">Click the button below to set up your account:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{invitationLink}}" style="background-color: #0066cc; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; display: inline-block;">Accept Invitation</a>
    </div>
    <p style="color: #666; font-size: 14px; line-height: 1.6;">This invitation expires in {{expiryHours}} hours.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">Versent Pty Ltd</p>
  </div>
</div>
</body>
</html>`,
        textPart: 'You have been invited as an Administrator to the Versent Report Portal. Visit {{invitationLink}} to set up your account. This invitation expires in {{expiryHours}} hours.',
      },
    });

    new ses.CfnTemplate(this, 'FirstLoginNotificationTemplate', {
      template: {
        templateName: `report-portal-first-login-notification-${environmentName}`,
        subjectPart: '{{customerName}} has logged in for the first time',
        htmlPart: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
  <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Versent Report Portal</h1>
    </div>
    <p style="color: #333; font-size: 16px; line-height: 1.6;"><strong>{{customerName}}</strong> ({{customerEmail}}) has logged in for the first time to <strong>{{spaceName}}</strong>.</p>
    <p style="color: #666; font-size: 14px; line-height: 1.6;">Login time: {{loginTime}}</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">Versent Pty Ltd</p>
  </div>
</div>
</body>
</html>`,
        textPart: '{{customerName}} ({{customerEmail}}) has logged in for the first time to {{spaceName}} at {{loginTime}}.',
      },
    });

    new ses.CfnTemplate(this, 'PasswordResetTemplate', {
      template: {
        templateName: `report-portal-password-reset-${environmentName}`,
        subjectPart: 'Reset your Report Portal password',
        htmlPart: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
  <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Versent Report Portal</h1>
    </div>
    <p style="color: #333; font-size: 16px; line-height: 1.6;">Your password reset code is: <strong>{{code}}</strong></p>
    <p style="color: #666; font-size: 14px; line-height: 1.6;">This code expires in 1 hour. If you did not request this, please ignore this email.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">Versent Pty Ltd</p>
  </div>
</div>
</body>
</html>`,
        textPart: 'Your password reset code is: {{code}}. This code expires in 1 hour.',
      },
    });

    new ses.CfnTemplate(this, 'MfaResetTemplate', {
      template: {
        templateName: `report-portal-mfa-reset-${environmentName}`,
        subjectPart: 'Your MFA has been reset',
        htmlPart: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
  <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Versent Report Portal</h1>
    </div>
    <p style="color: #333; font-size: 16px; line-height: 1.6;">Your multi-factor authentication (MFA) has been reset by an administrator.</p>
    <p style="color: #333; font-size: 16px; line-height: 1.6;">You will be prompted to set up MFA again on your next login.</p>
    <p style="color: #666; font-size: 14px; line-height: 1.6;">Reset by: {{adminName}} ({{adminEmail}})</p>
    <p style="color: #666; font-size: 14px; line-height: 1.6;">If you did not expect this, please contact your administrator immediately.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">Versent Pty Ltd</p>
  </div>
</div>
</body>
</html>`,
        textPart: 'Your MFA has been reset by {{adminName}} ({{adminEmail}}). You will need to set up MFA again on your next login.',
      },
    });

    new ses.CfnTemplate(this, 'FeedbackNewTemplate', {
      template: {
        templateName: `report-portal-feedback-new-${environmentName}`,
        subjectPart: 'New feedback on {{reportName}} in {{spaceName}}',
        htmlPart: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
  <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Versent Report Portal</h1>
    </div>
    <p style="color: #333; font-size: 16px; line-height: 1.6;"><strong>{{customerName}}</strong> left feedback on <strong>{{reportName}}</strong> in <strong>{{spaceName}}</strong>.</p>
    <div style="background: #f8f9fa; border-left: 4px solid #0066cc; padding: 16px; margin: 20px 0; border-radius: 0 4px 4px 0;">
      <p style="color: #333; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">{{feedbackSubject}}</p>
      <div style="color: #555; font-size: 14px; line-height: 1.6;">{{feedbackMessage}}</div>
    </div>
    <p style="color: #666; font-size: 14px; line-height: 1.6;">From: {{customerName}} ({{customerCompany}}) &middot; {{timestamp}}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{threadLink}}" style="background-color: #0066cc; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; display: inline-block;">View Thread</a>
    </div>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">Versent Pty Ltd</p>
  </div>
</div>
</body>
</html>`,
        textPart: '{{customerName}} left feedback on {{reportName}} in {{spaceName}}: {{feedbackSubject}} - {{feedbackMessage}}. View thread: {{threadLink}}',
      },
    });

    new ses.CfnTemplate(this, 'FeedbackReplyTemplate', {
      template: {
        templateName: `report-portal-feedback-reply-${environmentName}`,
        subjectPart: 'Reply on feedback: {{feedbackSubject}} - {{reportName}}',
        htmlPart: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
  <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Versent Report Portal</h1>
    </div>
    <p style="color: #333; font-size: 16px; line-height: 1.6;"><strong>{{replyAuthorName}}</strong> ({{replyAuthorRole}}) replied to feedback on <strong>{{reportName}}</strong>.</p>
    <div style="background: #f8f9fa; border-left: 4px solid #28a745; padding: 16px; margin: 20px 0; border-radius: 0 4px 4px 0;">
      <div style="color: #555; font-size: 14px; line-height: 1.6;">{{replyMessage}}</div>
    </div>
    <p style="color: #666; font-size: 14px; line-height: 1.6;">Thread: {{feedbackSubject}} &middot; {{timestamp}}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{threadLink}}" style="background-color: #0066cc; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; display: inline-block;">View Full Thread</a>
    </div>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">Versent Pty Ltd</p>
  </div>
</div>
</body>
</html>`,
        textPart: '{{replyAuthorName}} ({{replyAuthorRole}}) replied to feedback on {{reportName}}: {{replyMessage}}. View thread: {{threadLink}}',
      },
    });

    new ses.CfnTemplate(this, 'FeedbackResolvedTemplate', {
      template: {
        templateName: `report-portal-feedback-resolved-${environmentName}`,
        subjectPart: 'Feedback resolved: {{feedbackSubject}} - {{reportName}}',
        htmlPart: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
  <div style="background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Versent Report Portal</h1>
    </div>
    <p style="color: #333; font-size: 16px; line-height: 1.6;">Feedback thread <strong>"{{feedbackSubject}}"</strong> on <strong>{{reportName}}</strong> has been marked as resolved by <strong>{{adminName}}</strong>.</p>
    <p style="color: #666; font-size: 14px; line-height: 1.6;">Space: {{spaceName}} &middot; Resolved at: {{timestamp}}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{threadLink}}" style="background-color: #0066cc; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; display: inline-block;">View Thread</a>
    </div>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">Versent Pty Ltd</p>
  </div>
</div>
</body>
</html>`,
        textPart: 'Feedback thread "{{feedbackSubject}}" on {{reportName}} has been resolved by {{adminName}}. View thread: {{threadLink}}',
      },
    });

    // ========== Outputs ==========

    new cdk.CfnOutput(this, 'SesIdentityDomain', {
      value: envConfig.sesDomain,
      exportName: `${id}-SesIdentityDomain`,
    });

    new cdk.CfnOutput(this, 'BounceComplaintTopicArn', {
      value: this.bounceComplaintTopic.topicArn,
      exportName: `${id}-BounceComplaintTopicArn`,
    });
  }
}
