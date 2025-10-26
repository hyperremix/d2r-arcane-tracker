export default {
  'src/**/*.{ts,tsx}': [
    'biome check --write --files-ignore-unknown=false',
    'biome lint --write --files-ignore-unknown=false',
    'biome format --write --files-ignore-unknown=false',
  ],
  'electron/**/*.ts': (filenames) => {
    // Filter out .d.ts files since Biome ignores them
    const filteredFiles = filenames.filter((file) => !file.endsWith('.d.ts'));
    if (filteredFiles.length === 0) {
      return 'echo "No files to process"';
    }
    return [
      `biome check --write --files-ignore-unknown=false ${filteredFiles.join(' ')}`,
      `biome lint --write --files-ignore-unknown=false ${filteredFiles.join(' ')}`,
      `biome format --write --files-ignore-unknown=false ${filteredFiles.join(' ')}`,
    ];
  },
  '*.{css,json,js,jsx}': [
    'biome check --write --files-ignore-unknown=false',
    'biome lint --write --files-ignore-unknown=false',
    'biome format --write --files-ignore-unknown=false',
  ],
};
