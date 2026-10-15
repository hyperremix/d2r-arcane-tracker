/**
 * Unique and set names the d2s parser reports for v105+ (Reign of the Warlock) saves that are
 * spelled differently from the in-game name the catalog uses. The v105 parser data holds the
 * internal names of the game data (e.g. "Iros Torch" for Torch of Iro) instead of the display names
 * the older parser data had, so these items are looked up through this table.
 */
const renamedItems: ReadonlyArray<readonly [parserName: string, catalogName: string]> = [
  ['Mindrend', 'Skull Splitter'],
  ['Fechmars Axe', 'Axe of Fechmar'],
  ['The Chieftan', 'The Chieftain'],
  ['The Humongous', 'Humongous'],
  ['Iros Torch', 'Torch of Iro'],
  ['Maelstromwrath', 'Maelstrom'],
  ['Bonesob', 'Bonesnap'],
  ['Krintizs Skewer', 'Skewer of Krintiz'],
  ['Irices Shard', 'Spectral Shard'],
  ['Lazarus Spire', 'Spire of Lazarus'],
  ['Rimeraven', 'Raven Claw'],
  ['Piercerib', "Rogue's Bow"],
  ['Pullspite', 'Stormstrike'],
  ['Doomspittle', 'Doomslinger'],
  ['War Bonnet', "Biggin's Bonnet"],
  ['Venomsward', 'Venom Ward'],
  ['Victors Silk', 'Silks of the Victor'],
  ['Lenyms Cord', 'Lenymo'],
  ["Pompe's Wrath", "Pompeii's Wrath"],
  ['The Minataur', 'The Minotaur'],
  ['The Atlantian', 'The Atlantean'],
  ['Whichwild String', 'Witchwild String'],
  ['Godstrike Arch', 'Goldstrike Arch'],
  ['Pus Spiter', 'Pus Spitter'],
  ['Valkiry Wing', 'Valkyrie Wing'],
  ['Skin of the Flayerd One', 'Skin of the Flayed One'],
  ["Kerke's Sanctuary", "Gerke's Sanctuary"],
  ["Radimant's Sphere", "Radament's Sphere"],
  ['Cutthroat1', "Bartuc's Cut-Throat"],
  ['Razoredge', "Razor's Edge"],
  ["Deaths's Web", "Death's Web"],
  ['Cerebus', "Cerebus' Bite"],
  ['Souldrain', 'Soul Drainer'],
  ['Wisp', 'Wisp Projector'],
  ['Darkforge Spawn', 'Darkforce Spawn'],
  ['Steel Carapice', 'Steel Carapace'],
  ['Ironward', "Astreon's Iron Ward"],
  ['The Reedeemer', 'The Redeemer'],
  ["Ars Al'Diablolos", "Ars Al'Diabolos"],
];

const sunderCharmNames = [
  'Black Cleft',
  'Bone Break',
  'Cold Rupture',
  'Crack of the Heavens',
  'Flame Rift',
  'Rotting Fissure',
];

/** Catalog names keyed by the parser name; the parser knows Latent and Renewed sunder charms as PreCrafted and Crafted. */
export const parserNameAliases: Readonly<Record<string, string>> = Object.fromEntries([
  ...renamedItems,
  ...sunderCharmNames.flatMap((name) => [
    [`PreCrafted ${name}`, `Latent ${name}`],
    [`Crafted ${name}`, `Renewed ${name}`],
  ]),
]);
