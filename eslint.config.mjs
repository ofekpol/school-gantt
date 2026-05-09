import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db/client",
              importNames: ["supabaseAdmin"],
              message:
                "supabaseAdmin is restricted to lib/db/. Use db.withSchool() instead (DB-04).",
            },
            {
              name: "@/lib/db/supabase-admin",
              message:
                "Import supabaseAdmin via @/lib/db/client and only inside lib/db/. Outside lib/db/ this is banned (DB-04).",
            },
          ],
        },
      ],
    },
  },
  // OVERRIDE — must come AFTER global rule (Pitfall 4)
  {
    files: ["lib/db/**/*.{ts,tsx}", "db/seed.ts", "db/migrations/**"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];
