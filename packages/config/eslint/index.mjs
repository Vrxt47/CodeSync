/** @type {import('eslint').Linter.Config[]} */
export const baseEslintConfig = [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/prisma/generated/**",
    ],
  },
  {
    rules: {
      "no-console": "off",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "prefer-const": "error",
      "no-var": "error",
    },
  },
];

export default baseEslintConfig;
