import { AccountMenu } from "@/components/auth/account-menu";
import type { NotificationItem } from "@/server/notifications/types";
import type { ReactNode } from "react";
import { AppAvatar } from "./app-avatar";
import { BottomNav } from "./bottom-nav";
import { ShellIconSprite } from "./icons";
import { NotificationBell } from "./notification-bell";
import { TopNav } from "./top-nav";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  username?: string | null;
};

type Props = {
  user: SessionUser;
  notifications: NotificationItem[];
  unreadCount: number;
  /** Server action que se ejecuta al abrir el dropdown. */
  onMarkAllRead: () => Promise<void>;
  children: ReactNode;
};

/**
 * Envoltura común del área logada. Server component que recibe el
 * snapshot de notificaciones desde el layout `(app)` y se lo pasa al
 * `<NotificationBell>` (client). El dropdown se hidrata con esos
 * datos; no hace fetch desde el cliente.
 */
export function AppShell({ user, notifications, unreadCount, onMarkAllRead, children }: Props) {
  return (
    <>
      <ShellIconSprite />
      <TopNav
        trailing={
          <>
            <NotificationBell
              initialItems={notifications}
              initialUnreadCount={unreadCount}
              onMarkAllRead={onMarkAllRead}
            />
            <AccountMenu user={user} trigger={<AppAvatar user={user} />} />
          </>
        }
      />
      <main
        id="main-content"
        className="relative z-[1] mx-auto max-w-[720px] px-5 pb-10 pt-[88px] max-sm:pb-[92px]"
      >
        {children}
      </main>
      <BottomNav />
    </>
  );
}
