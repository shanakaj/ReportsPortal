import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  MessageSquare,
  BarChart3,
  FileText,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Role } from '@/types';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  end?: boolean;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === Role.SUPER_ADMIN || user?.role === Role.ADMIN;

  const adminNavItems: NavItem[] = [
    { label: 'Dashboard', to: '/admin', icon: <LayoutDashboard className="h-5 w-5" />, end: true },
    { label: 'Spaces', to: '/admin/spaces', icon: <FolderOpen className="h-5 w-5" /> },
    { label: 'Users', to: '/admin/users', icon: <Users className="h-5 w-5" /> },
    { label: 'Feedback Inbox', to: '/admin/feedback', icon: <MessageSquare className="h-5 w-5" /> },
    { label: 'Analytics', to: '/admin/analytics', icon: <BarChart3 className="h-5 w-5" /> },
    { label: 'Audit Log', to: '/admin/audit-log', icon: <FileText className="h-5 w-5" /> },
  ];

  const customerNavItems: NavItem[] = [
    { label: 'My Spaces', to: '/customer', icon: <FolderOpen className="h-5 w-5" />, end: true },
  ];

  const navItems = isAdmin ? adminNavItems : customerNavItems;

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform bg-card border-r transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-6">
          <h1 className="text-lg font-bold text-primary">Report Portal</h1>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden rounded-md p-1 hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
