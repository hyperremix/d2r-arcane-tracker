import { describe, expect, it } from 'vitest';
import { resolveBaseItemIconFilename } from './baseItemIcons';
import { items } from './index';

/**
 * HD inventory sprites of the Reign of the Warlock items, from `Data/hd/items/uniques.json` and
 * `sets.json` (the asset name without its folder). Items those files don't list, such as the
 * Latent and Renewed sunder charms, use the sprite of their base item in `items.json`.
 */
const rotwSpriteByItemId: Record<string, string> = {
  arsaldiabolos: 'ars_aldiablolos.png',
  arstorbaalos: 'ars_aldiablolos.png',
  arsdulmephistos: 'ars_aldiablolos.png',
  measuredwrath: 'measured_wrath.png',
  dreadfang: 'two_handed_sword.png',
  wraithstep: 'light_plate_boots.png',
  bloodpactshard: 'dirk.png',
  gheedswager: 'heavy_belt.png',
  hellwardenswill: 'unique_warlock_helm.png',
  defendersbile: 'fragment_poison.png',
  guardiansthunder: 'fragment_lightning.png',
  protectorsfrost: 'fragment_cold.png',
  defendersfire: 'fragment_fire.png',
  protectorsstone: 'fragment_physical.png',
  guardianslight: 'fragment_magic.png',
  banesoathmaker: 'banes_spire.png',
  baneswraithskin: 'hard_leather_armor.png',
  banesauthority: 'light_belt.png',
  horazonscountenance: 'horazons_countenance.png',
  horazonsdominion: 'splint_mail.png',
  horazonshold: 'gloves_l.png',
  horazonslegacy: 'light_plate_boots.png',
  horazonssecrets: 'ars_torbaalos.png',
};

/**
 * Items whose sprite is a numbered variant of their base sprite (`ring/ring`, `amulet/amulet`,
 * `charm/charm_large`). The game data names only the base sprite, so only the prefix is checked.
 */
const rotwSpritePrefixByItemId: Record<string, string> = {
  sling: 'ring',
  opalvein: 'ring',
  entropylocket: 'amulet',
  latentbonebreak: 'charm_large',
  latentblackcleft: 'charm_large',
  latentcoldrupture: 'charm_large',
  latentcrackoftheheavens: 'charm_large',
  latentflamerift: 'charm_large',
  latentrottingfissure: 'charm_large',
  renewedbonebreak: 'charm_large',
  renewedblackcleft: 'charm_large',
  renewedcoldrupture: 'charm_large',
  renewedcrackoftheheavens: 'charm_large',
  renewedflamerift: 'charm_large',
  renewedrottingfissure: 'charm_large',
};

describe('When the catalog item icons are checked', () => {
  it('If an item is a unique or set item, Then it has an image filename', () => {
    // Arrange
    const uniquesAndSets = items.filter((item) => item.type === 'unique' || item.type === 'set');

    // Act
    const withoutIcon = uniquesAndSets.filter((item) => !item.imageFilename).map((item) => item.id);

    // Assert
    expect(uniquesAndSets.length).toBeGreaterThan(0);
    expect(withoutIcon).toEqual([]);
  });

  it('If an item is a Reign of the Warlock item, Then its image filename is its HD sprite', () => {
    // Arrange
    const expectedIds = Object.keys(rotwSpriteByItemId);

    // Act
    const actual = Object.fromEntries(
      expectedIds.map((id) => [id, items.find((item) => item.id === id)?.imageFilename]),
    );

    // Assert
    expect(actual).toEqual(rotwSpriteByItemId);
  });

  it('If a Reign of the Warlock item uses a variant of its base sprite, Then its image filename is that variant', () => {
    // Arrange
    const entries = Object.entries(rotwSpritePrefixByItemId);

    // Act
    const mismatches = entries
      .map(([id, prefix]) => ({
        id,
        prefix,
        imageFilename: items.find((item) => item.id === id)?.imageFilename,
      }))
      .filter(
        ({ prefix, imageFilename }) => !imageFilename?.match(new RegExp(`^${prefix}\\d*\\.png$`)),
      )
      .map(({ id, imageFilename }) => `${id}: ${imageFilename}`);

    // Assert
    expect(mismatches).toEqual([]);
  });
});

describe('When base item icons are resolved', () => {
  it('If the code is a grimoire base, Then it resolves to the HD sprite of that base', () => {
    // Arrange
    const codes = ['wa1', 'wa7', 'wab', 'waf'];

    // Act
    const icons = codes.map((code) => resolveBaseItemIconFilename(code));

    // Assert
    expect(icons).toEqual(['oldbook.png', 'tome_book.png', 'oldbook.png', 'grimoire.png']);
  });

  it('If the code has different casing or padding, Then it still resolves', () => {
    // Arrange
    const code = ' CJW ';

    // Act
    const icon = resolveBaseItemIconFilename(code);

    // Assert
    expect(icon).toBe('perfect_diamond.png');
  });

  it('If the code is not in the base item map, Then it resolves to undefined', () => {
    // Arrange
    const codes = ['uap', 'constructor', undefined];

    // Act
    const icons = codes.map((code) => resolveBaseItemIconFilename(code));

    // Assert
    expect(icons).toEqual([undefined, undefined, undefined]);
  });
});
