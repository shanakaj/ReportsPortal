import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../bin/app';

export interface AuthStackProps extends cdk.StackProps {
  environmentName: string;
  envConfig: EnvironmentConfig;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly portalAppClient: cognito.UserPoolClient;
  public readonly adminAppClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { environmentName, envConfig } = props;

    // Pre-signup Lambda trigger for email domain validation
    const preSignupFunction = new lambda.Function(this, 'PreSignupTrigger', {
      functionName: `report-portal-pre-signup-${environmentName}`,
      description: 'Validates email domains and invitation tokens during Cognito sign-up',
      runtime: lambda.Runtime.JAVA_21,
      handler: 'com.versent.reportportal.triggers.PreSignupHandler::handleRequest',
      code: lambda.Code.fromAsset('../backend/cognito-triggers/target/cognito-triggers.jar'),
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      environment: {
        ALLOWED_ADMIN_DOMAIN: 'versent.com.au',
        ENVIRONMENT: environmentName,
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    // Enable SnapStart on pre-signup trigger
    const cfnPreSignup = preSignupFunction.node.defaultChild as lambda.CfnFunction;
    cfnPreSignup.addPropertyOverride('SnapStart', {
      ApplyOn: 'PublishedVersions',
    });

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `report-portal-users-${environmentName}`,
      selfSignUpEnabled: false, // Invitation-only
      signInAliases: {
        email: true,
      },
      signInCaseSensitive: false,
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
        fullname: {
          required: true,
          mutable: true,
        },
        phoneNumber: {
          required: false,
          mutable: true,
        },
      },
      customAttributes: {
        role: new cognito.StringAttribute({
          mutable: true,
          minLen: 1,
          maxLen: 20,
        }),
        customer_space: new cognito.StringAttribute({
          mutable: true,
          minLen: 0,
          maxLen: 2048,
        }),
        invited_by: new cognito.StringAttribute({
          mutable: false,
          minLen: 1,
          maxLen: 255,
        }),
      },
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(1),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      deviceTracking: {
        challengeRequiredOnNewDevice: true,
        deviceOnlyRememberedOnUserPrompt: true,
      },
      userInvitation: {
        emailSubject: 'Welcome to Versent Report Portal',
        emailBody:
          'Hello {username}, you have been invited to the Versent Report Portal. ' +
          'Your temporary password is {####}. Please log in and set up your account.',
      },
      userVerification: {
        emailSubject: 'Verify your Report Portal email',
        emailBody: 'Your verification code is {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
      removalPolicy: environmentName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      lambdaTriggers: {
        preSignUp: preSignupFunction,
      },
    });

    // Configure account lockout via advanced security (risk-based adaptive auth)
    const cfnUserPool = this.userPool.node.defaultChild as cognito.CfnUserPool;
    cfnUserPool.addPropertyOverride('UserPoolAddOns', {
      AdvancedSecurityMode: 'ENFORCED',
    });

    // Portal App Client (customer-facing)
    this.portalAppClient = this.userPool.addClient('PortalAppClient', {
      userPoolClientName: `report-portal-customer-client-${environmentName}`,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          `https://${envConfig.domainName}/callback`,
          `https://${envConfig.adminDomainName}/callback`,
        ],
        logoutUrls: [
          `https://${envConfig.domainName}/logout`,
          `https://${envConfig.adminDomainName}/logout`,
        ],
      },
      accessTokenValidity: cdk.Duration.minutes(15),
      idTokenValidity: cdk.Duration.minutes(15),
      refreshTokenValidity: cdk.Duration.hours(1),
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          fullname: true,
          phoneNumber: true,
        })
        .withCustomAttributes('role', 'customer_space', 'invited_by'),
    });

    // Admin App Client
    this.adminAppClient = this.userPool.addClient('AdminAppClient', {
      userPoolClientName: `report-portal-admin-client-${environmentName}`,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: true,
        adminUserPassword: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          `https://${envConfig.adminDomainName}/callback`,
        ],
        logoutUrls: [
          `https://${envConfig.adminDomainName}/logout`,
        ],
      },
      accessTokenValidity: cdk.Duration.minutes(15),
      idTokenValidity: cdk.Duration.minutes(15),
      refreshTokenValidity: cdk.Duration.hours(1),
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          fullname: true,
          phoneNumber: true,
        })
        .withCustomAttributes('role', 'customer_space', 'invited_by'),
    });

    // Super Admin seeding via Custom Resource
    const seedAdminRole = new iam.Role(this, 'SeedAdminRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    seedAdminRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminUpdateUserAttributes',
          'cognito-idp:ListUsers',
        ],
        resources: [this.userPool.userPoolArn],
      })
    );

    const seedAdminFunction = new lambda.Function(this, 'SeedAdminFunction', {
      functionName: `report-portal-seed-admin-${environmentName}`,
      description: 'Seeds the initial super admin user in Cognito',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminUpdateUserAttributesCommand, ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider');

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));

  if (event.RequestType === 'Delete') {
    return { PhysicalResourceId: event.PhysicalResourceId || 'seed-admin' };
  }

  const client = new CognitoIdentityProviderClient({});
  const userPoolId = event.ResourceProperties.UserPoolId;
  const email = event.ResourceProperties.SuperAdminEmail;

  try {
    // Check if user already exists
    const listResult = await client.send(new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: \`email = "\${email}"\`,
      Limit: 1,
    }));

    if (listResult.Users && listResult.Users.length > 0) {
      console.log('Super admin user already exists, skipping creation');
      return { PhysicalResourceId: 'seed-admin' };
    }

    // Create super admin user
    await client.send(new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      TemporaryPassword: 'Admin@12345!',
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: 'Super Admin' },
        { Name: 'custom:role', Value: 'super_admin' },
        { Name: 'custom:invited_by', Value: 'system' },
      ],
      MessageAction: 'SUPPRESS',
    }));

    console.log('Super admin user created successfully');
    return { PhysicalResourceId: 'seed-admin' };
  } catch (error) {
    console.error('Error seeding admin:', error);
    throw error;
  }
};
      `),
      timeout: cdk.Duration.seconds(30),
      role: seedAdminRole,
    });

    const seedAdminProvider = new cr.Provider(this, 'SeedAdminProvider', {
      onEventHandler: seedAdminFunction,
    });

    new cdk.CustomResource(this, 'SeedAdminResource', {
      serviceToken: seedAdminProvider.serviceToken,
      properties: {
        UserPoolId: this.userPool.userPoolId,
        SuperAdminEmail: envConfig.superAdminEmail,
        // Force update when email changes
        Trigger: envConfig.superAdminEmail,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: `${id}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      exportName: `${id}-UserPoolArn`,
    });

    new cdk.CfnOutput(this, 'PortalClientId', {
      value: this.portalAppClient.userPoolClientId,
      exportName: `${id}-PortalClientId`,
    });

    new cdk.CfnOutput(this, 'AdminClientId', {
      value: this.adminAppClient.userPoolClientId,
      exportName: `${id}-AdminClientId`,
    });
  }
}
