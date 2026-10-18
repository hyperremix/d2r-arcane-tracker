import { describe, expect, it } from 'vitest';
import { planRuneUpgrades } from './runeword-upgrades';

describe('planRuneUpgrades', () => {
  it('When every required rune is owned, then the plan has no steps', () => {
    // Arrange
    const availableRunes = { tir: 1, el: 1 };

    // Act
    const plan = planRuneUpgrades(['tir', 'el'], availableRunes, {});

    // Assert
    expect(plan).toEqual([]);
  });

  it('When a low rune is missing, then three runes below it are cubed without a gem', () => {
    // Arrange
    const availableRunes = { el: 1, eld: 3 };

    // Act
    const plan = planRuneUpgrades(['tir', 'el'], availableRunes, {});

    // Assert
    expect(plan).toEqual([{ runeId: 'eld', runeCount: 3, resultRuneId: 'tir', times: 1 }]);
  });

  it('When Pul is missing, then three Lem and a flawed emerald are cubed', () => {
    // Arrange
    const availableRunes = { lem: 3 };
    const availableGems = { gfg: 1 };

    // Act
    const plan = planRuneUpgrades(['pul'], availableRunes, availableGems);

    // Assert
    expect(plan).toEqual([
      { runeId: 'lem', runeCount: 3, gemCode: 'gfg', resultRuneId: 'pul', times: 1 },
    ]);
  });

  it('When a high rune is missing, then only two runes below it and the gem are cubed', () => {
    // Arrange
    const availableRunes = { sur: 2 };
    const availableGems = { gzv: 1 };

    // Act
    const plan = planRuneUpgrades(['ber'], availableRunes, availableGems);

    // Assert
    expect(plan).toEqual([
      { runeId: 'sur', runeCount: 2, gemCode: 'gzv', resultRuneId: 'ber', times: 1 },
    ]);
  });

  it('If the recipe gem is missing, then there is no plan', () => {
    // Arrange
    const availableRunes = { lem: 3 };
    const availableGems = { gfr: 5, gsg: 5 };

    // Act
    const plan = planRuneUpgrades(['pul'], availableRunes, availableGems);

    // Assert
    expect(plan).toBeUndefined();
  });

  it('If two upgrades need the same gem but only one is owned, then there is no plan', () => {
    // Arrange
    const availableRunes = { lem: 6 };
    const availableGems = { gfg: 1 };

    // Act
    const plan = planRuneUpgrades(['pul', 'pul'], availableRunes, availableGems);

    // Assert
    expect(plan).toBeUndefined();
  });

  it('When the same upgrade is needed twice, then one step repeats it twice', () => {
    // Arrange
    const availableRunes = { lem: 6 };
    const availableGems = { gfg: 2 };

    // Act
    const plan = planRuneUpgrades(['pul', 'pul'], availableRunes, availableGems);

    // Assert
    expect(plan).toEqual([
      { runeId: 'lem', runeCount: 3, gemCode: 'gfg', resultRuneId: 'pul', times: 2 },
    ]);
  });

  it('When a missing rune needs several upgrades in a row, then the steps go from the lowest rune up', () => {
    // Arrange
    const availableRunes = { hel: 9 };
    const availableGems = { gcw: 3, gfy: 1 };

    // Act
    const plan = planRuneUpgrades(['lum'], availableRunes, availableGems);

    // Assert
    expect(plan).toEqual([
      { runeId: 'hel', runeCount: 3, gemCode: 'gcw', resultRuneId: 'io', times: 3 },
      { runeId: 'io', runeCount: 3, gemCode: 'gfy', resultRuneId: 'lum', times: 1 },
    ]);
  });

  it('When owned runes cover part of an upgrade chain, then only the rest is cubed', () => {
    // Arrange
    const availableRunes = { io: 1, hel: 6 };
    const availableGems = { gcw: 2, gfy: 1 };

    // Act
    const plan = planRuneUpgrades(['lum'], availableRunes, availableGems);

    // Assert
    expect(plan).toEqual([
      { runeId: 'hel', runeCount: 3, gemCode: 'gcw', resultRuneId: 'io', times: 2 },
      { runeId: 'io', runeCount: 3, gemCode: 'gfy', resultRuneId: 'lum', times: 1 },
    ]);
  });

  it('When a runeword needs Ber twice and one is owned, then only the second Ber is cubed', () => {
    // Arrange
    const availableRunes = { ber: 1, mal: 1, ist: 1, sur: 2 };
    const availableGems = { gzv: 1 };

    // Act
    const plan = planRuneUpgrades(['ber', 'mal', 'ber', 'ist'], availableRunes, availableGems);

    // Assert
    expect(plan).toEqual([
      { runeId: 'sur', runeCount: 2, gemCode: 'gzv', resultRuneId: 'ber', times: 1 },
    ]);
  });

  it('When Enigma lacks Jah and three Ber are owned, then two Ber become the Jah and one stays', () => {
    // Arrange
    const availableRunes = { ber: 3, ith: 1 };
    const availableGems = { glb: 1 };

    // Act
    const plan = planRuneUpgrades(['jah', 'ith', 'ber'], availableRunes, availableGems);

    // Assert
    expect(plan).toEqual([
      { runeId: 'ber', runeCount: 2, gemCode: 'glb', resultRuneId: 'jah', times: 1 },
    ]);
  });

  it('If an upgrade would use up a rune the runeword itself needs, then there is no plan', () => {
    // Arrange
    const availableRunes = { lem: 3 };
    const availableGems = { gfg: 1 };

    // Act
    const plan = planRuneUpgrades(['lem', 'pul'], availableRunes, availableGems);

    // Assert
    expect(plan).toBeUndefined();
  });

  it('When there are enough runes for the runeword and the upgrade, then both are kept apart', () => {
    // Arrange
    const availableRunes = { lem: 4 };
    const availableGems = { gfg: 1 };

    // Act
    const plan = planRuneUpgrades(['lem', 'pul'], availableRunes, availableGems);

    // Assert
    expect(plan).toEqual([
      { runeId: 'lem', runeCount: 3, gemCode: 'gfg', resultRuneId: 'pul', times: 1 },
    ]);
  });

  it('When a needed rune is short because a higher upgrade uses it, then it is cubed too', () => {
    // Arrange: Lem is needed by the runeword and three more go into the Pul, so one Lem is made
    // from three Fal
    const availableRunes = { lem: 3, fal: 3 };
    const availableGems = { gfg: 1, gfr: 1 };

    // Act
    const plan = planRuneUpgrades(['lem', 'pul'], availableRunes, availableGems);

    // Assert
    expect(plan).toEqual([
      { runeId: 'fal', runeCount: 3, gemCode: 'gfr', resultRuneId: 'lem', times: 1 },
      { runeId: 'lem', runeCount: 3, gemCode: 'gfg', resultRuneId: 'pul', times: 1 },
    ]);
  });

  it('If an El rune is missing, then there is no plan because nothing upgrades into El', () => {
    // Arrange
    const availableRunes = { tir: 1 };

    // Act
    const plan = planRuneUpgrades(['tir', 'el'], availableRunes, {});

    // Assert
    expect(plan).toBeUndefined();
  });

  it('If the runes run out further down the chain, then there is no plan', () => {
    // Arrange
    const availableRunes = { hel: 8 };
    const availableGems = { gcw: 3, gfy: 1 };

    // Act
    const plan = planRuneUpgrades(['lum'], availableRunes, availableGems);

    // Assert
    expect(plan).toBeUndefined();
  });

  it('If a required rune is unknown and not owned, then there is no plan', () => {
    // Arrange
    const availableRunes = { el: 3 };

    // Act
    const plan = planRuneUpgrades(['unknown'], availableRunes, {});

    // Assert
    expect(plan).toBeUndefined();
  });

  it('When a plan is made, then the owned rune and gem counts are left untouched', () => {
    // Arrange
    const availableRunes = { lem: 3 };
    const availableGems = { gfg: 1 };

    // Act
    planRuneUpgrades(['pul'], availableRunes, availableGems);

    // Assert
    expect(availableRunes).toEqual({ lem: 3 });
    expect(availableGems).toEqual({ gfg: 1 });
  });
});
