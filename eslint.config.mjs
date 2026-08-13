import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default tseslint.config(
  {
    ignores: [".next/**", "node_modules/**", "out/**", "next-env.d.ts"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...compat.extends("next/core-web-vitals"),
  {
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        navigator: "readonly",
        AudioContext: "readonly",
        KeyboardEvent: "readonly",
        __dirname: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      /*
       * 本作の表示文には全角スペース（U+3000）を意図的に使う。
       * 日本語の組版として必要なので、JSXの地の文とテンプレートでは許可する。
       */
      "no-irregular-whitespace": [
        "error",
        { skipStrings: true, skipTemplates: true, skipJSXText: true },
      ],
      /*
       * 場面背景と人物シルエットは静的なSVGで、next/image の最適化対象にならない。
       * 意図した素の <img> なので警告を出さない。
       */
      "@next/next/no-img-element": "off",
    },
  },
);
