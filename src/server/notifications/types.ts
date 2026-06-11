export type NotificationKind =
  | "prediction_sent"
  | "prediction_locked"
  | "match_finished"
  | "achievement_unlocked"
  | "system"
  | "admin_broadcast"
  | "friend_request"
  | "friend_accepted"
  | "group_invited"
  | "group_joined"
  | "group_left"
  | "group_expelled"
  | "group_admin_transferred"
  | "group_deleted";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  matchId: string | null;
  achievementId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export type NotificationsView = {
  items: NotificationItem[];
  unreadCount: number;
};
