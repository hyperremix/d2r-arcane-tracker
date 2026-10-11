import type { Item } from 'electron/types/grail';
import { HolyGrailItemBuilder } from '@/fixtures';

/** Builds a rune item with the given rune code. */
export function buildRune(id: string, name: string, code: string): Item {
  return {
    ...HolyGrailItemBuilder.new()
      .withId(id)
      .withName(name)
      .withType('rune')
      .withCategory('runes')
      .withoutSetName()
      .build(),
    code,
  };
}
