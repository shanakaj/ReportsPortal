import React, { createContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, AuthTokens, LoginResult, AuthChallengeResult } from '@/types';
import * as authService from '@/services/auth';
import { setTokens, clearTokens, setOnTokenRefreshFailed } from '@/services/api';

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isImpersonating: boolean;
  impersonatorId: string | null;
  isReadOnly: boolean;
  challenge: AuthChallengeResult | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyMfa: (code: string, mfaType: 'SOFTWARE_TOKEN_MFA' | 'SMS_MFA') => Promise<LoginResult>;
  completeNewPassword: (newPassword: string) => Promise<LoginResult>;
  logout: () => void;
  setAuthFromTokens: (tokens: AuthTokens) => void;
  clearChallenge: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [challenge, setChallenge] = useState<AuthChallengeResult | null>(null);
  const [impersonatorId, setImpersonatorId] = useState<string | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const navigate = useNavigate();

  const handleTokens = useCallback((tokens: AuthTokens) => {
    setTokens(tokens.accessToken, tokens.refreshToken);

    const impersonator = authService.getImpersonator(tokens.idToken);
    setImpersonatorId(impersonator);
    setIsReadOnly(authService.isReadOnly(tokens.idToken));

    const payload = JSON.parse(atob(tokens.idToken.split('.')[1]));
    const extractedUser: User = {
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
    setUser(extractedUser);
  }, []);

  const handleLoginResult = useCallback(
    (result: LoginResult): LoginResult => {
      if (result.tokens) {
        handleTokens(result.tokens);
        setChallenge(null);
      } else if (result.challenge) {
        setChallenge(result.challenge);
      }
      return result;
    },
    [handleTokens],
  );

  const loginFn = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      const result = await authService.login(email, password);
      return handleLoginResult(result);
    },
    [handleLoginResult],
  );

  const verifyMfaFn = useCallback(
    async (code: string, mfaType: 'SOFTWARE_TOKEN_MFA' | 'SMS_MFA'): Promise<LoginResult> => {
      const result = await authService.verifyMfa(code, mfaType);
      return handleLoginResult(result);
    },
    [handleLoginResult],
  );

  const completeNewPasswordFn = useCallback(
    async (newPassword: string): Promise<LoginResult> => {
      const result = await authService.completeNewPassword(newPassword);
      return handleLoginResult(result);
    },
    [handleLoginResult],
  );

  const logoutFn = useCallback(() => {
    authService.logout();
    clearTokens();
    setUser(null);
    setChallenge(null);
    setImpersonatorId(null);
    setIsReadOnly(false);
    navigate('/login');
  }, [navigate]);

  const setAuthFromTokens = useCallback(
    (tokens: AuthTokens) => {
      handleTokens(tokens);
    },
    [handleTokens],
  );

  const clearChallenge = useCallback(() => {
    setChallenge(null);
  }, []);

  useEffect(() => {
    setOnTokenRefreshFailed(() => {
      logoutFn();
    });
  }, [logoutFn]);

  useEffect(() => {
    async function initAuth() {
      try {
        const tokens = await authService.refreshSession();
        if (tokens) {
          handleTokens(tokens);
        }
      } catch {
        // No valid session
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, [handleTokens]);

  const value: AuthContextValue = {
    user,
    isLoading,
    isImpersonating: impersonatorId !== null,
    impersonatorId,
    isReadOnly,
    challenge,
    login: loginFn,
    verifyMfa: verifyMfaFn,
    completeNewPassword: completeNewPasswordFn,
    logout: logoutFn,
    setAuthFromTokens,
    clearChallenge,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
