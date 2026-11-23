import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // examples/ is fake application code for the demo estate, not part of this project.
  { ignores: ['dist', 'out', 'out.prev', 'examples', '.sysgraph-cache', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  tseslint.configs.strict,
  reactHooks.configs.flat['recommended-latest'],
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
);
