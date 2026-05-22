"use client";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { createInvitation, revokeInvitation } from "@/server/invitations/actions";
import type { InvitationListItem } from "@/server/invitations/types";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

type Props = {
  invitations: InvitationListItem[];
};

/**
 * Cliente que gestiona el listado de invitaciones. Optimistic UI:
 *  - Al generar un link nuevo lo añade al state local sin esperar
 *    al refresh.
 *  - Al rescindir uno, lo ELIMINA del state local (server action
 *    también lo borra de BD — revoke = delete duro, sin gris).
 *
 * Por defecto los links generados son de USOS ILIMITADOS. El usuario
 * puede marcar el checkbox "un solo uso" antes de generar si quiere
 * un link que se autodestruye tras la primera redención.
 */
export function InvitationsManager({ invitations: initial }: Props) {
  const t = useTranslations("invite");
  const tCommon = useTranslations("common.confirm");
  const [items, setItems] = useState<InvitationListItem[]>(initial);
  const [singleUse, setSingleUse] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function create() {
    setFeedback(null);
    // `0` = ilimitado en la BD (findRedeemableInvitation:
    // `row.maxUses > 0 && row.uses >= row.maxUses` salta el check).
    // `1` = un solo uso.
    const maxUses = singleUse ? 1 : 0;
    startTransition(async () => {
      const result = await createInvitation(maxUses);
      if (!result.ok) {
        setFeedback(
          t(
            `feedback.create.${result.code}` as
              | "feedback.create.unauthorized"
              | "feedback.create.limit_reached"
              | "feedback.create.invalid_input",
          ),
        );
        return;
      }
      const now = new Date();
      setItems((prev) => [
        {
          id: now.getTime().toString(), // placeholder hasta el refresh
          token: result.token,
          url: result.url,
          maxUses,
          uses: 0,
          revokedAt: null,
          createdAt: now,
        },
        ...prev,
      ]);
      setFeedback(t("feedback.create.ok"));
    });
  }

  function confirmRevoke() {
    if (!pendingRevokeId) return;
    const id = pendingRevokeId;
    const previous = items;
    setPendingRevokeId(null);
    // Optimistic: la fila desaparece inmediatamente. Si la action
    // falla, restauramos el listado anterior.
    setItems((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => {
      const result = await revokeInvitation(id);
      if (!result.ok) {
        setItems(previous);
        setFeedback(
          t(
            `feedback.revoke.${result.code}` as
              | "feedback.revoke.unauthorized"
              | "feedback.revoke.not_found",
          ),
        );
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

      <label className="mb-3 flex cursor-pointer items-center gap-2 text-[12px] font-bold text-muted">
        <input
          type="checkbox"
          checked={singleUse}
          onChange={(e) => setSingleUse(e.target.checked)}
          className="cursor-pointer accent-gold"
        />
        <span>{t("singleUseLabel")}</span>
      </label>

      {feedback && <p className="mb-3 text-[12px] font-bold text-success">{feedback}</p>}

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 px-4 py-6 text-center text-[12px] font-bold text-muted">
          {t("empty")}
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((item) => (
            <InvitationRow key={item.id} item={item} onRevoke={() => setPendingRevokeId(item.id)} />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingRevokeId !== null}
        title={t("revokeTitle")}
        body={t("revokeBody")}
        confirmLabel={t("revokeCta")}
        cancelLabel={tCommon("cancel")}
        variant="danger"
        isPending={isPending}
        onConfirm={confirmRevoke}
        onCancel={() => setPendingRevokeId(null)}
      />
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
