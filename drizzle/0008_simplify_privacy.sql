-- Simplifica `users.privacy` al subconjunto `{ visibility }`. Los
-- antiguos toggles (`showName`, `showCountry`, `showImage`,
-- `showPoints`, `showAchievements`) se eliminan: el ranking es
-- inamovible, así que los toggles solo añadían fricción a una
-- decisión que se reduce a "perfil visitable o no". Tipado nuevo en
-- `src/server/db/schema.ts::UserPrivacy`.

ALTER TABLE "users" ALTER COLUMN "privacy" SET DEFAULT '{"visibility":"public"}'::jsonb;

-- Compactamos cada fila al nuevo shape conservando el `visibility`
-- existente (defaulteando a `'public'` si está ausente).
UPDATE "users"
SET "privacy" = jsonb_build_object(
  'visibility',
  COALESCE("privacy"->>'visibility', 'public')
);