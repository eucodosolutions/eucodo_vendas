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
    // Edge Functions rodam em Deno, com os tipos e as diretivas do Deno. Este
    // config e o do Next: ele nao entende `// deno-lint-ignore` nem os imports
    // por URL, e so produziria erro em codigo que nao vai para o bundle.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
