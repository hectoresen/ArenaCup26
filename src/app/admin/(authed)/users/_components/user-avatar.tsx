import { getAvatar } from "@/server/profile/avatars";

/**
 * Avatar circular tamaño chip. Prioridad: avatar gallery > image de
 * Google > iniciales del nombre. Server Component — no client.
 */
export function UserAvatar({
  name,
  image,
  avatarId,
  size = 40,
}: {
  name: string | null;
  image: string | null;
  avatarId: string | null;
  size?: number;
}) {
  const gallery = avatarId ? getAvatar(avatarId) : null;
  const sizeClass = "h-10 w-10";

  if (gallery) {
    return (
      <div
        className={`${sizeClass} shrink-0 overflow-hidden rounded-full border border-slate-700 bg-slate-800`}
        style={{ width: size, height: size }}
      >
        <img src={gallery.src} alt={gallery.label} className="h-full w-full" />
      </div>
    );
  }

  if (image) {
    return (
      <div
        className={`${sizeClass} shrink-0 overflow-hidden rounded-full border border-slate-700 bg-slate-800`}
        style={{ width: size, height: size }}
      >
        <img src={image} alt={name ?? "avatar"} className="h-full w-full object-cover" />
      </div>
    );
  }

  const initials = (name ?? "?")
    .split(/\s+/)
    .map((s) => s[0]?.toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <div
      className={`${sizeClass} shrink-0 grid place-items-center rounded-full border border-slate-700 bg-slate-800 text-xs font-black text-slate-300`}
      style={{ width: size, height: size }}
    >
      {initials || "?"}
    </div>
  );
}
