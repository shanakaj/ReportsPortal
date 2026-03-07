import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

let accessToken: string | null = null;
let refreshTokenValue: string | null = null;
let onTokenRefreshFailed: (() => void) | null = null;
let refreshPromise: Promise<string> | null = null;

export function setTokens(idToken: string, refresh: string): void {
  accessToken = idToken;
  refreshTokenValue = refresh;
}

export function clearTokens(): void {
  accessToken = null;
  refreshTokenValue = null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshTokenValue;
}

export function setOnTokenRefreshFailed(callback: () => void): void {
  onTokenRefreshFailed = callback;
}

async function refreshAccessToken(): Promise<string> {
  // Use the Cognito SDK to refresh the session client-side
  // Dynamic import to avoid circular dependency
  const { refreshSession } = await import('@/services/auth');
  const tokens = await refreshSession();
  if (!tokens) {
    throw new Error('Session refresh failed');
  }
  // Store the new ID token for API calls
  accessToken = tokens.idToken;
  refreshTokenValue = tokens.refreshToken;
  return tokens.idToken;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }

        const newToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        clearTokens();
        onTokenRefreshFailed?.();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
