import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Recommended rules for all files
    extends: [
      tseslint.configs.recommended,
    ],
    // Apply TypeScript rules only to .ts/.tsx files
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true, // Assumes tsconfig.json is at the root or discoverable
      },
      globals: {
        ...globals.node, // Use Node.js globals
        ...globals.jest, // Use Jest globals
      },
    },
    rules: {
      // Add any project-specific rules here
      // e.g., '@typescript-eslint/no-unused-vars': 'warn'
    },
  },
  {
    // Ignore common build/dist directories and node_modules
    ignores: ["**/dist/", "**/build/", "**/node_modules/", "eslint.config.js"],
  }
); 