import { describe, expect, it } from 'vitest';
import { guideUrl } from './content';

const base = import.meta.env.BASE_URL;
const repository = 'https://github.com/hyperremix/d2r-arcane-tracker';

describe('When the URL of a guide is built', () => {
  it('If there is no heading, then it is the guide page', () => {
    // Arrange
    const file = 'HOLY_GRAIL_GUIDE.md';

    // Act
    const result = guideUrl(file);

    // Assert
    expect(result).toBe(`${base}guides/holy-grail/`);
  });

  it('If there is a heading id, then it is the guide page with that anchor', () => {
    // Arrange
    const file = 'HOLY_GRAIL_GUIDE.md';

    // Act
    const result = guideUrl(file, 'statistics');

    // Assert
    expect(result).toBe(`${base}guides/holy-grail/#statistics`);
  });

  it('If the heading id is empty, then it is the guide page without an anchor', () => {
    // Arrange
    const file = 'RUN_TRACKER.md';

    // Act
    const result = guideUrl(file, '');

    // Assert
    expect(result).toBe(`${base}guides/run-tracker/`);
  });

  it('If the file is not a guide, then it is the file on GitHub, with the anchor', () => {
    // Arrange
    const file = 'MEMORY_READING.md';

    // Act
    const result = guideUrl(file, 'adding-a-new-d2r-build');

    // Assert
    expect(result).toBe(`${repository}/blob/main/docs/MEMORY_READING.md#adding-a-new-d2r-build`);
  });
});
