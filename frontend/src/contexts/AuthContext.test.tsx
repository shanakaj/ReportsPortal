import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, AuthContext } from './AuthContext';
import React, { useContext } from 'react';

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
});
