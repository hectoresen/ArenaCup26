import type { GroupColor } from "@/server/db/schema";

/**
 * Tailwind classes para cada color de grupo. Centralizado aquí para
 * que swatches, headers de grupo y bordes usen exactamente los
 * mismos tonos. Usamos colores HEX inline en Tailwind 4 porque la
 * paleta `gold` ya existe pero `blue/purple/etc` no tienen tokens.
 *
 * Pares: `bg` (fondo intenso de swatch), `bgSoft` (fondo suave del
 * header del grupo), `text` (texto del swatch), `ring` (borde).
 */
export const GROUP_COLOR_STYLES: Record<
  GroupColor,
  { bg: string; bgSoft: string; text: string; ring: string; hex: string; label: string }
> = {
  gold: {
    bg: "bg-gold",
    bgSoft: "bg-gold/10",
    text: "text-background",
    ring: "ring-gold/40",
    hex: "#F2C94C",
    label: "Oro",
  },
  blue: {
    bg: "bg-[#3F8AE0]",
    bgSoft: "bg-[#3F8AE0]/10",
    text: "text-white",
    ring: "ring-[#3F8AE0]/40",
    hex: "#3F8AE0",
    label: "Azul",
  },
  purple: {
    bg: "bg-[#9B6BF2]",
    bgSoft: "bg-[#9B6BF2]/10",
    text: "text-white",
    ring: "ring-[#9B6BF2]/40",
    hex: "#9B6BF2",
    label: "Morado",
  },
  green: {
    bg: "bg-[#3FB371]",
    bgSoft: "bg-[#3FB371]/10",
    text: "text-white",
    ring: "ring-[#3FB371]/40",
    hex: "#3FB371",
    label: "Verde",
  },
  orange: {
    bg: "bg-[#F08D3F]",
    bgSoft: "bg-[#F08D3F]/10",
    text: "text-white",
    ring: "ring-[#F08D3F]/40",
    hex: "#F08D3F",
    label: "Naranja",
  },
  red: {
    bg: "bg-[#E04B4B]",
    bgSoft: "bg-[#E04B4B]/10",
    text: "text-white",
    ring: "ring-[#E04B4B]/40",
    hex: "#E04B4B",
    label: "Rojo",
  },
  teal: {
    bg: "bg-[#3FBFB8]",
    bgSoft: "bg-[#3FBFB8]/10",
    text: "text-white",
    ring: "ring-[#3FBFB8]/40",
    hex: "#3FBFB8",
    label: "Turquesa",
  },
  pink: {
    bg: "bg-[#E06FA1]",
    bgSoft: "bg-[#E06FA1]/10",
    text: "text-white",
    ring: "ring-[#E06FA1]/40",
    hex: "#E06FA1",
    label: "Rosa",
  },
};
