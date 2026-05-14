export type NotificationKind =
  | "prediction_sent"
  | "prediction_locked"
  | "match_finished"
  | "achievement_unlocked"
  | "system";

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
