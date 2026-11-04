import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 이 프로젝트의 산출물·생성 파일
    "dist/**",
    "public/map-app/**",
    "app/map/generated/**",
    "worker-configuration.d.ts",
  ]),
]);

export default eslintConfig;
