import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const config: NextConfig = {
  // Promovido fuera de `experimental` en Next 15.5+
  typedRoutes: true,
};

export default withNextIntl(config);
