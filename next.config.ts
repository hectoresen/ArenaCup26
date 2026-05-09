import type { NextConfig } from "next";

const config: NextConfig = {
  // Promovido fuera de `experimental` en Next 15.5+
  typedRoutes: true,
};

export default config;
