"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  createInvitation,
  revokeInvitation,
} from "@/server/invitations/actions";
import type { InvitationListItem } from "@/server/invitations/types";

type Props = {
  invitations: InvitationListItem[];
};

/**
 * Cliente que gestiona el listado de invitaciones. Optimistic UI:
 * al generar un link nuevo lo añade al state local sin esperar al
 * refresh; al rescindir uno, marca la fila como revoked y queda
 * gris hasta que el siguiente refresh confirme.
 *
 * No persiste nada en local — todo el state real vive en BD; este
 * componente solo refleja la última respuesta del server action.
 */
export function InvitationsManager({ invitations: initial }: Props) {
  const t = useTranslations("invite");
  const [items, setItems] = useState<InvitationListItem[]>(initial);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function create() {
    setFeedback(null);
    startTransition(async () => {
      // Por ahora, links de UN USO. Cuando queramos exponer una UX
      // para "ilimitado" o "N usos" en el form, basta cambiar este 1.
      const result = await createInvitation(1);
      if (!result.ok) {
        setFeedback(
          t(`feedback.create.${result.code}` as
            | "feedback.create.unauthorized"
            | "feedback.create.limit_reached"
            | "feedback.create.invalid_input"),
        );
        return;
      }
      const now = new Date();
      setItems((prev) => [
        {
          id: now.getTime().toString(), // placeholder hasta el refresh
          token: result.token,
          url: result.url,
          maxUses: 1,
          uses: 0,
          revokedAt: null,
          createdAt: now,
        },
        ...prev,
      ]);
      setFeedback(t("feedback.create.ok"));
    });
  }

  function revoke(id: string) {
    if (!confirm(t("revokeConfirm"))) return;
    const previous = items;
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, revokedAt: new Date() } : i)),
    );
    startTransition(async () => {
      const result = await revokeInvitation(id);
      if (!result.ok) {
        setItems(previous);
        setFeedback(t(`feedback.revoke.${result.code}` as
          | "feedback.revoke.unauthorized"
          | "feedback.revoke.not_found"));
      }
    });
  }

  return (
    <section>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-[14px] uppercase tracking-[0.12em] text-gold">
          {t("listHeader")}
        </h2>
        <button
          type="button"
          onClick={create}
          disabled={isPending}
          className="cursor-pointer rounded-full border-2 border-gold/40 bg-gradient-to-br from-gold to-gold-deep px-4 py-1.5 font-display text-[12px] uppercase tracking-[0.1em] text-[#1a1000] shadow-[0_0_16px_rgba(245,200,66,0.25)] transition-[transform] hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
        >
          + {t("create")}
        </button>
      </header>

      {feedback && (
        <p className="mb-3 text-[12px] font-bold text-success">{feedback}</p>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 px-4 py-6 text-center text-[12px] font-bold text-muted">
          {t("empty")}
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((item) => (
            <InvitationRow key={item.id} item={item} onRevoke={() => revoke(item.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function InvitationRow({
  item,
  onRevoke,
}: {
  item: InvitationListItem;
  onRevoke: () => void;
}) {
  const t = useTranslations("invite");
  const [copied, setCopied] = useState(false);
  const isRevoked = item.revokedAt !== null;
  const isExhausted = item.maxUses > 0 && item.uses >= item.maxUses;
  const isDead = isRevoked || isExhausted;

  function copy() {
    navigator.clipboard
      .writeText(item.url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // navigator.clipboard puede fallar en contextos no-https o
        // sin permiso; mostramos un fallback prompt para que el user
        // pueda copiarlo a mano.
        // eslint-disable-next-line no-alert
        window.prompt(t("copyFallback"), item.url);
      });
  }

  return (
    <li
      className={`rounded-2xl border-2 px-3 py-2.5 transition-opacity ${
        isDead ? "border-border bg-card/40 opacity-60" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate text-[11px] font-bold text-foreground">
          {item.url}
        </code>
        <button
          type="button"
          onClick={copy}
          disabled={isDead}
          className="flex-shrink-0 cursor-pointer rounded-lg border-2 border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-extrabold text-gold transition-colors hover:bg-gold/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copied ? t("copied") : t("copy")}
        </button>
        {!isDead && (
          <button
            type="button"
            onClick={onRevoke}
            className="flex-shrink-0 cursor-pointer rounded-lg border-2 border-border bg-card-hover px-2.5 py-1 text-[11px] font-extrabold text-muted transition-colors hover:border-danger/40 hover:text-danger"
          >
            {t("revoke")}
          </button>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
        <span>
          {item.maxUses === 0
            ? t("rowUsesUnlimited", { uses: item.uses })
            : t("rowUsesLimited", { uses: item.uses, max: item.maxUses })}
        </span>
        {isRevoked && <span className="text-danger">{t("rowRevoked")}</span>}
        {isExhausted && !isRevoked && <span className="text-warm">{t("rowExhausted")}</span>}
      </div>
    </li>
  );
}
