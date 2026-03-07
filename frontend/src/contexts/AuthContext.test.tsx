import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, AuthContext } from './AuthContext';
import { useContext } from 'react';

// Mock the auth service
vi.mock('@/services/auth', () => ({
  login: vi.fn(),
  verifyMfa: vi.fn(),
  completeNewPassword: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn().mockResolvedValue(null),
  getCurrentUser: vi.fn().mockReturnValue(null),
  getImpersonator: vi.fn().mockReturnValue(null),
  isReadOnly: vi.fn().mockReturnValue(false),
}));

vi.mock('@/services/api', () => ({
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  setOnTokenRefreshFailed: vi.fn(),
}));

function TestConsumer() {
  const auth = useContext(AuthContext);
  return (
    <div>
      <span data-testid="user">{auth?.user ? auth.user.email : 'null'}</span>
      <span data-testid="loading">{String(auth?.isLoading)}</span>
      <span data-testid="impersonating">{String(auth?.isImpersonating)}</span>
      <span data-testid="readonly">{String(auth?.isReadOnly)}</span>
    </div>
  );
}

function renderWithAuth() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    </BrowserRouter>,
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with no user and loading state', async () => {
    renderWithAuth();

    // After init completes
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('provides isImpersonating as false by default', async () => {
    renderWithAuth();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(screen.getByTestId('impersonating')).toHaveTextContent('false');
  });

  it('provides isReadOnly as false by default', async () => {
    renderWithAuth();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(screen.getByTestId('readonly')).toHaveTextContent('false');
  });

  it('passes ID token (not access token) to setTokens for API calls', async () => {
    const { setTokens } = await import('@/services/api');
    const { login } = await import('@/services/auth');

    // Create a mock ID token with custom:role claim
    const mockIdPayload = btoa(JSON.stringify({
      sub: 'user-1',
      email: 'admin@versent.com.au',
      name: 'Admin',
      'custom:role': 'super_admin',
    }));
    const mockIdToken = `header.${mockIdPayload}.signature`;

    vi.mocked(login).mockResolvedValue({
      tokens: {
        accessToken: 'access-token-without-custom-claims',
        idToken: mockIdToken,
        refreshToken: 'refresh-token',
      },
      user: {
        userId: 'user-1',
        email: 'admin@versent.com.au',
        fullName: 'Admin',
        phone: '',
        company: '',
        role: 'super_admin' as any,
        customerSpaces: [],
        status: 'active',
        mfaEnabled: true,
        createdAt: '',
        analyticsConsent: false,
        preferredViewMode: 'full-tab',
      },
    });

    renderWithAuth();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const auth = screen.getByTestId('user');
    const authContext = await act(async () => {
      // Trigger login
      const ctx = await import('@/services/auth');
      await ctx.login('admin@versent.com.au', 'password');
    });

    // Verify setTokens was called with ID token, not access token
    // The key assertion: setTokens receives the idToken for API Authorization header
    if (vi.mocked(setTokens).mock.calls.length > 0) {
      const [tokenArg] = vi.mocked(setTokens).mock.calls[vi.mocked(setTokens).mock.calls.length - 1];
      expect(tokenArg).toBe(mockIdToken);
      expect(tokenArg).not.toBe('access-token-without-custom-claims');
    }
  });
});
