// `biome check --write` formats, applies safe lint fixes and organizes imports in one pass.
// `--no-errors-on-unmatched` skips staged files that biome.json ignores (e.g. `*.d.ts`).
const biomeCheck = 'biome check --write --no-errors-on-unmatched';

export default {
  'src/**/*.{ts,tsx}': biomeCheck,
  'electron/**/*.ts': biomeCheck,
  '*.{css,json,js,jsx}': biomeCheck,
};
