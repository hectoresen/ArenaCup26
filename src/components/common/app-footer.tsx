import { useTranslations } from "next-intl";

/**
 * Footer global de la web. Una sola línea centrada con copyright,
 * sin protagonismo: muted, peso normal, font pequeña. Pretende ser
 * un cierre visual del documento sin competir con el contenido.
 *
 * `pb-20 sm:pb-4` deja espacio en móvil para que no quede tapado
 * por la `<BottomNav>` (h-16 + safe-area). En desktop el padding
 * se reduce — no hay nav inferior.
 */
export function AppFooter() {
  const t = useTranslations("footer");
  const year = new Date().getUTCFullYear();
  return (
    <footer className="relative z-[1] mx-auto mt-10 max-w-[720px] px-5 pb-20 pt-4 text-center sm:pb-4">
      <p className="text-[11px] font-bold leading-tight text-muted/70">
        © {year} ArenaCup26 · {t("tagline")}
      </p>
    </footer>
  );
}
