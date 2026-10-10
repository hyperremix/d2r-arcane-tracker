import { describe, expect, it } from 'vitest';
import { getPageList } from './pagination';

describe('When the page list of a paginated list is built', () => {
  it('If there are only a few pages, Then every page is listed without gaps', () => {
    // Arrange
    const totalPages = 7;

    // Act
    const pages = getPageList(3, totalPages);

    // Assert
    expect(pages).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('If the current page is near the start, Then the first pages and the last page are listed', () => {
    // Arrange
    const totalPages = 20;

    // Act
    const pages = getPageList(2, totalPages);

    // Assert
    expect(pages).toEqual([1, 2, 3, 4, 5, 'gap-end', 20]);
  });

  it('If the current page is in the middle, Then a window around it is listed between gaps', () => {
    // Arrange
    const totalPages = 20;

    // Act
    const pages = getPageList(10, totalPages);

    // Assert
    expect(pages).toEqual([1, 'gap-start', 9, 10, 11, 'gap-end', 20]);
  });

  it('If the current page is near the end, Then the first page and the last pages are listed', () => {
    // Arrange
    const totalPages = 20;

    // Act
    const pages = getPageList(19, totalPages);

    // Assert
    expect(pages).toEqual([1, 'gap-start', 16, 17, 18, 19, 20]);
  });

  it.each([1, 4, 5, 8, 16, 17, 20])('If page %i of 20 is current, Then it is listed', (page) => {
    // Arrange
    const totalPages = 20;

    // Act
    const pages = getPageList(page, totalPages);

    // Assert
    expect(pages).toContain(page);
    expect(pages).toHaveLength(7);
  });
});
