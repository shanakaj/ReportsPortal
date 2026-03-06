import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import type { AuthTokens, LoginResult, User } from '@/types';

const userPoolConfig = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
};

const userPool = new CognitoUserPool(userPoolConfig);

let currentCognitoUser: CognitoUser | null = null;

function extractUserFromIdToken(idToken: string): User {
  const payload = JSON.parse(atob(idToken.split('.')[1]));
  return {
    userId: payload.sub,
    email: payload.email,
    fullName: payload.name || payload.email,
    phone: payload.phone_number,
    company: payload['custom:company'],
    role: payload['custom:role'],
    customerSpaces: payload['custom:customer_space']
      ? payload['custom:customer_space'].split(',')
      : [],
    status: 'active',
    mfaEnabled: true,
    createdAt: '',
    analyticsConsent: payload['custom:analytics_consent'] === 'true',
    preferredViewMode: payload['custom:view_mode'] || 'full-tab',
  };
}

export function getImpersonator(idToken: string): string | null {
  const payload = JSON.parse(atob(idToken.split('.')[1]));
  return payload.impersonator || null;
}

export function isReadOnly(idToken: string): boolean {
  const payload = JSON.parse(atob(idToken.split('.')[1]));
  return payload.read_only === true || payload.impersonator != null;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    currentCognitoUser = cognitoUser;

    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session: CognitoUserSession) => {
        const tokens: AuthTokens = {
          accessToken: session.getAccessToken().getJwtToken(),
          idToken: session.getIdToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
        };
        const user = extractUserFromIdToken(tokens.idToken);
        resolve({ tokens, user });
      },
      onFailure: (err: Error) => {
        reject(err);
      },
      newPasswordRequired: (userAttributes: Record<string, string>) => {
        resolve({
          challenge: {
            challengeName: 'NEW_PASSWORD_REQUIRED',
            session: '',
            challengeParameters: userAttributes,
          },
        });
      },
      totpRequired: () => {
        resolve({
          challenge: {
            challengeName: 'SOFTWARE_TOKEN_MFA',
            session: '',
          },
        });
      },
      mfaRequired: () => {
        resolve({
          challenge: {
            challengeName: 'SMS_MFA',
            session: '',
          },
        });
      },
    });
  });
}

export async function verifyMfa(code: string, mfaType: 'SOFTWARE_TOKEN_MFA' | 'SMS_MFA'): Promise<LoginResult> {
  return new Promise((resolve, reject) => {
    if (!currentCognitoUser) {
      reject(new Error('No active auth session'));
      return;
    }

    const callback = {
      onSuccess: (session: CognitoUserSession) => {
        const tokens: AuthTokens = {
          accessToken: session.getAccessToken().getJwtToken(),
          idToken: session.getIdToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
        };
        const user = extractUserFromIdToken(tokens.idToken);
        resolve({ tokens, user });
      },
      onFailure: (err: Error) => {
        reject(err);
      },
    };

    if (mfaType === 'SOFTWARE_TOKEN_MFA') {
      currentCognitoUser.sendMFACode(code, callback, 'SOFTWARE_TOKEN_MFA');
    } else {
      currentCognitoUser.sendMFACode(code, callback);
    }
  });
}

export async function completeNewPassword(newPassword: string): Promise<LoginResult> {
  return new Promise((resolve, reject) => {
    if (!currentCognitoUser) {
      reject(new Error('No active auth session'));
      return;
    }

    currentCognitoUser.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess: (session: CognitoUserSession) => {
        const tokens: AuthTokens = {
          accessToken: session.getAccessToken().getJwtToken(),
          idToken: session.getIdToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
        };
        const user = extractUserFromIdToken(tokens.idToken);
        resolve({ tokens, user });
      },
      onFailure: (err: Error) => {
        reject(err);
      },
      totpRequired: () => {
        resolve({
          challenge: {
            challengeName: 'SOFTWARE_TOKEN_MFA',
            session: '',
          },
        });
      },
      mfaRequired: () => {
        resolve({
          challenge: {
            challengeName: 'SMS_MFA',
            session: '',
          },
        });
      },
    });
  });
}

export async function forgotPassword(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err: Error) => reject(err),
    });
  });
}

export async function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err: Error) => reject(err),
    });
  });
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = userPool.getCurrentUser();
    if (!user) {
      reject(new Error('Not authenticated'));
      return;
    }

    user.getSession((err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }
      user.changePassword(oldPassword, newPassword, (changeErr?: Error) => {
        if (changeErr) {
          reject(changeErr);
        } else {
          resolve();
        }
      });
    });
  });
}

export async function refreshSession(): Promise<AuthTokens | null> {
  return new Promise((resolve) => {
    const user = userPool.getCurrentUser();
    if (!user) {
      resolve(null);
      return;
    }

    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) {
        resolve(null);
        return;
      }

      if (session.isValid()) {
        resolve({
          accessToken: session.getAccessToken().getJwtToken(),
          idToken: session.getIdToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
        });
      } else {
        resolve(null);
      }
    });
  });
}

export function logout(): void {
  const user = userPool.getCurrentUser();
  if (user) {
    user.signOut();
  }
  currentCognitoUser = null;
}

export function getCurrentUser(): User | null {
  const user = userPool.getCurrentUser();
  if (!user) return null;

  let result: User | null = null;
  user.getSession((err: Error | null, session: CognitoUserSession | null) => {
    if (!err && session && session.isValid()) {
      result = extractUserFromIdToken(session.getIdToken().getJwtToken());
    }
  });

  return result;
}
