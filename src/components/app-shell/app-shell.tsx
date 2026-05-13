import { AccountMenu } from "@/components/auth/account-menu";
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
  unreadCount?: number;
  children: ReactNode;
};

/**
 * Envoltura común del área logada: top-nav fijo + bottom-nav móvil +
 * sprite de iconos compartido. El `<main>` central tiene
 * `max-width: 720px` (mobile-first) y los paddings que compensan los
 * navs fijos.
 *
 * Server component. El estado (notificaciones, sesión) llega por
 * props desde el layout del route group.
 */
export function AppShell({ user, unreadCount = 0, children }: Props) {
  return (
    <>
      <ShellIconSprite />
      <TopNav
        trailing={
          <>
            <NotificationBell unreadCount={unreadCount} />
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
