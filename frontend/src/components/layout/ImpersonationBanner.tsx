import { useAuth } from '@/hooks/useAuth';
import { exitImpersonation } from '@/services/users';
import { clearTokens } from '@/services/api';

export function ImpersonationBanner() {
  const { user, isImpersonating, logout } = useAuth();

  if (!isImpersonating || !user) return null;

  const handleExit = async () => {
    try {
      await exitImpersonation();
    } catch {
      // Best effort
    }
    clearTokens();
    logout();
  };

  return (
    <div className="bg-yellow-400 text-yellow-900 px-4 py-2 text-center text-sm font-medium">
      You are viewing as: {user.fullName} ({user.email}) &mdash;{' '}
      <button
        type="button"
        onClick={handleExit}
        className="underline font-bold hover:text-yellow-800"
      >
        Exit impersonation
      </button>
    </div>
  );
}
