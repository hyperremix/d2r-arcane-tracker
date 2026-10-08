import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ItemCategoryLabel } from './ItemCategoryLabel';

describe('When ItemCategoryLabel is rendered', () => {
  it.each([
    { category: 'weapons', subCategory: '2h_swords', expected: 'Weapons • Two-Handed Swords' },
    { category: 'armor', subCategory: 'body_armor', expected: 'Armor • Body Armor' },
    { category: 'charms', subCategory: 'small_charms', expected: 'Charms • Small Charms' },
    { category: 'armor', subCategory: 'necromancer', expected: 'Armor • Necromancer' },
  ] as const)('If the item is $category / $subCategory, then it shows $expected', ({
    category,
    subCategory,
    expected,
  }) => {
    // Arrange
    const item = { category, subCategory };

    // Act
    const { container } = render(<ItemCategoryLabel item={item} />);

    // Assert
    expect(container.textContent).toBe(expected);
  });
});
