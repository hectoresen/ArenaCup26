import { GROUP_COLOR_STYLES } from "@/lib/group-colors";
import type { GroupColor } from "@/server/db/schema";

type Props = {
  color: GroupColor;
  name: string;
  size?: "sm" | "md" | "lg";
};

/**
 * Avatar visual del grupo: círculo con color + inicial. Sin imagen
 * configurable (decisión de diseño — color paleta de 8 ya es
 * suficiente diferenciación visual para grupos pequeños).
 *
 * Inicial: primera letra del nombre, mayúscula. Si el nombre empieza
 * por emoji o símbolo lo extraemos como `Array.from` para no romper
 * caracteres unicode.
 */
export function GroupAvatar({ color, name, size = "md" }: Props) {
  const styles = GROUP_COLOR_STYLES[color];
  const initial = (Array.from(name.trim())[0] ?? "?").toUpperCase();
  const sizeClasses =
    size === "sm"
      ? "h-9 w-9 text-[14px]"
      : size === "lg"
        ? "h-14 w-14 text-[22px]"
        : "h-11 w-11 text-[17px]";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-black ${styles.bg} ${styles.text} ${sizeClasses}`}
    >
      {initial}
    </span>
  );
}
