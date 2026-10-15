import { describe, expect, it } from 'vitest';
import { simplifyItemName } from '../utils/objects';
import { itemsByNameSimple } from './indexes';
import { parserNameAliases } from './parserNameAliases';

describe('When the parser name aliases are added to the item name index', () => {
  it('If an alias names a catalog item, Then the parser name finds that item', () => {
    // Arrange
    const aliases = Object.entries(parserNameAliases);

    // Act
    const unresolved = aliases.filter(([parserName, catalogName]) => {
      const found = itemsByNameSimple[simplifyItemName(parserName)];
      return found !== itemsByNameSimple[simplifyItemName(catalogName)];
    });

    // Assert
    expect(aliases.length).toBeGreaterThan(0);
    expect(unresolved).toEqual([]);
  });

  it('If a name is no catalog item and no alias, Then the index does not have it', () => {
    // Arrange
    const unknownName = 'Not A Real Parser Name';

    // Act
    const found = itemsByNameSimple[simplifyItemName(unknownName)];

    // Assert
    expect(found).toBeUndefined();
  });
});
