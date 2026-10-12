import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CharacterBuilder, GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import { CharacterProgressTable } from './CharacterProgressTable';

const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();

const findBy = (id: string, characterId: string, foundDate: string) =>
  GrailProgressBuilder.new()
    .withId(id)
    .withCharacterId(characterId)
    .withItemId('item-1')
    .withFoundDate(new Date(foundDate))
    .asNormal()
    .build();

const listedCharacterNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

describe('When CharacterProgressTable is rendered', () => {
  describe('If a find belongs to a character that is not in the character list', () => {
    it('Then that find is not listed', () => {
      // Arrange
      const characters = [CharacterBuilder.new().withId('char-1').withName('Amazon').build()];
      const itemProgress = [
        findBy('p-known', 'char-1', '2024-01-01'),
        findBy('p-unknown', 'deleted-char', '2024-02-01'),
      ];

      // Act
      render(
        <CharacterProgressTable
          characters={characters}
          itemProgress={itemProgress}
          item={item}
          onRemoveProgress={vi.fn()}
        />,
      );

      // Assert
      expect(listedCharacterNames()).toEqual(['Amazon']);
    });
  });

  describe('If the only find belongs to a character that is not in the character list', () => {
    it('Then the no finds line is shown instead of a table', () => {
      // Arrange
      const characters = [CharacterBuilder.new().withId('char-1').withName('Amazon').build()];
      const itemProgress = [findBy('p-unknown', 'deleted-char', '2024-02-01')];

      // Act
      render(
        <CharacterProgressTable
          characters={characters}
          itemProgress={itemProgress}
          item={item}
          onRemoveProgress={vi.fn()}
        />,
      );

      // Assert
      expect(screen.getByText('No character has found this item yet.')).toBeVisible();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('If several characters found the item on the same date', () => {
    it('Then they are ordered by character name', () => {
      // Arrange
      const characters = [
        CharacterBuilder.new().withId('char-z').withName('Zealot').build(),
        CharacterBuilder.new().withId('char-a').withName('Amazon').build(),
        CharacterBuilder.new().withId('char-m').withName('Monk').build(),
      ];
      const itemProgress = [
        findBy('p-z', 'char-z', '2024-03-01'),
        findBy('p-m', 'char-m', '2024-03-01'),
        findBy('p-a', 'char-a', '2024-03-01'),
      ];

      // Act
      render(
        <CharacterProgressTable
          characters={characters}
          itemProgress={itemProgress}
          item={item}
          onRemoveProgress={vi.fn()}
        />,
      );

      // Assert
      expect(listedCharacterNames()).toEqual(['Amazon', 'Monk', 'Zealot']);
    });
  });
});
