export type InvitationListItem = {
  id: string;
  token: string;
  /** URL completa para copiar (NEXT_PUBLIC_APP_URL + `/?invite=token`). */
  url: string;
  maxUses: number;
  uses: number;
  revokedAt: Date | null;
  createdAt: Date;
};
