export interface GemItem {
  id: string;
  code: string;
  name: string;
  imageFilename: string;
}

export const gems: GemItem[] = [
  // Chipped
  { id: 'gcr', code: 'gcr', name: 'Chipped Ruby', imageFilename: 'chipped_ruby.png' },
  { id: 'gcb', code: 'gcb', name: 'Chipped Sapphire', imageFilename: 'chipped_sapphire.png' },
  { id: 'gcy', code: 'gcy', name: 'Chipped Topaz', imageFilename: 'chipped_topaz.png' },
  { id: 'gcg', code: 'gcg', name: 'Chipped Emerald', imageFilename: 'chipped_emerald.png' },
  { id: 'gcw', code: 'gcw', name: 'Chipped Diamond', imageFilename: 'chipped_diamond.png' },
  { id: 'gcv', code: 'gcv', name: 'Chipped Amethyst', imageFilename: 'chipped_amethyst.png' },
  { id: 'skc', code: 'skc', name: 'Chipped Skull', imageFilename: 'chipped_skull.png' },
  // Flawed
  { id: 'gfr', code: 'gfr', name: 'Flawed Ruby', imageFilename: 'flawed_ruby.png' },
  { id: 'gfb', code: 'gfb', name: 'Flawed Sapphire', imageFilename: 'flawed_sapphire.png' },
  { id: 'gfy', code: 'gfy', name: 'Flawed Topaz', imageFilename: 'flawed_topaz.png' },
  { id: 'gfg', code: 'gfg', name: 'Flawed Emerald', imageFilename: 'flawed_emerald.png' },
  { id: 'gfw', code: 'gfw', name: 'Flawed Diamond', imageFilename: 'flawed_diamond.png' },
  { id: 'gfv', code: 'gfv', name: 'Flawed Amethyst', imageFilename: 'flawed_amethyst.png' },
  { id: 'skf', code: 'skf', name: 'Flawed Skull', imageFilename: 'flawed_skull.png' },
  // Regular
  { id: 'gsr', code: 'gsr', name: 'Ruby', imageFilename: 'ruby.png' },
  { id: 'gsb', code: 'gsb', name: 'Sapphire', imageFilename: 'sapphire.png' },
  { id: 'gsy', code: 'gsy', name: 'Topaz', imageFilename: 'topaz.png' },
  { id: 'gsg', code: 'gsg', name: 'Emerald', imageFilename: 'emerald.png' },
  { id: 'gsw', code: 'gsw', name: 'Diamond', imageFilename: 'diamond.png' },
  { id: 'gsv', code: 'gsv', name: 'Amethyst', imageFilename: 'amethyst.png' },
  { id: 'sku', code: 'sku', name: 'Skull', imageFilename: 'skull.png' },
  // Flawless
  { id: 'glr', code: 'glr', name: 'Flawless Ruby', imageFilename: 'flawless_ruby.png' },
  { id: 'glb', code: 'glb', name: 'Flawless Sapphire', imageFilename: 'flawless_sapphire.png' },
  { id: 'gly', code: 'gly', name: 'Flawless Topaz', imageFilename: 'flawless_topaz.png' },
  { id: 'glg', code: 'glg', name: 'Flawless Emerald', imageFilename: 'flawless_emerald.png' },
  { id: 'glw', code: 'glw', name: 'Flawless Diamond', imageFilename: 'flawless_diamond.png' },
  { id: 'gzv', code: 'gzv', name: 'Flawless Amethyst', imageFilename: 'flawless_amethyst.png' },
  { id: 'skl', code: 'skl', name: 'Flawless Skull', imageFilename: 'flawless_skull.png' },
  // Perfect
  { id: 'gpr', code: 'gpr', name: 'Perfect Ruby', imageFilename: 'perfect_ruby.png' },
  { id: 'gpb', code: 'gpb', name: 'Perfect Sapphire', imageFilename: 'perfect_sapphire.png' },
  { id: 'gpy', code: 'gpy', name: 'Perfect Topaz', imageFilename: 'perfect_topaz.png' },
  { id: 'gpg', code: 'gpg', name: 'Perfect Emerald', imageFilename: 'perfect_emerald.png' },
  { id: 'gpw', code: 'gpw', name: 'Perfect Diamond', imageFilename: 'perfect_diamond.png' },
  { id: 'gpv', code: 'gpv', name: 'Perfect Amethyst', imageFilename: 'perfect_amethyst.png' },
  { id: 'skz', code: 'skz', name: 'Perfect Skull', imageFilename: 'perfect_skull.png' },
];
