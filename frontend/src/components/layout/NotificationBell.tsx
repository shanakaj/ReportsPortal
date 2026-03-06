import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/contexts/NotificationContext';
import { listNotifications, markAsRead, markAllAsRead } from '@/services/notifications';
import { formatDistanceToNow } from 'date-fns';
import type { Notification } from '@/types';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { unreadCount, refetch: refetchCount } = useNotifications();

  const { data, refetch } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => listNotifications({ limit: 10 }),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleMarkRead = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.notificationId);
      refetch();
      refetchCount();
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    refetch();
    refetchCount();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-md p-2 hover:bg-accent"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-md border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {data?.items && data.items.length > 0 ? (
              data.items.map((notification) => (
                <div
                  key={notification.notificationId}
                  className={cn(
                    'border-b px-4 py-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors',
                    !notification.read && 'bg-primary/5',
                  )}
                  onClick={() => handleMarkRead(notification)}
                >
                  <p className={cn('text-sm', !notification.read && 'font-medium')}>
                    {notification.message}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
