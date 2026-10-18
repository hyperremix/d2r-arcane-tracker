import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { guideUrl } from '../content';
import { FAQ, faqs } from './FAQ';

interface FaqPageData {
  '@context': string;
  '@type': string;
  mainEntity: {
    '@type': string;
    name: string;
    acceptedAnswer: { '@type': string; text: string };
  }[];
}

/** Reads the FAQPage JSON-LD the component rendered into the page. */
function readStructuredData(container: HTMLElement): FaqPageData {
  const script = container.querySelector('script[type="application/ld+json"]');
  if (!script?.textContent) throw new Error('FAQPage structured data not found');
  return JSON.parse(script.textContent) as FaqPageData;
}

/** The question and answer text of each FAQ row, as shown on the page. */
function readVisibleEntries(container: HTMLElement) {
  return Array.from(container.querySelectorAll('details')).map((details) => ({
    question: details.querySelector('summary')?.textContent ?? '',
    answer: details.querySelector('p')?.textContent ?? '',
  }));
}

/** The FAQ row whose question contains the given text. */
function findDetails(container: HTMLElement, questionText: string): HTMLElement {
  const details = Array.from(container.querySelectorAll('details')).find((element) =>
    element.querySelector('summary')?.textContent?.includes(questionText),
  );
  if (!details) throw new Error(`FAQ question not found: ${questionText}`);
  return details;
}

describe('When the FAQ is rendered', () => {
  it('Then every question is a heading inside a disclosure and its answer is in the page', () => {
    // Arrange / Act
    const { container } = render(<FAQ />);

    // Assert
    const section = container.querySelector('section#faq');
    expect(section).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'FAQ', level: 2 })).toBeInTheDocument();
    const visible = readVisibleEntries(container);
    expect(visible).toHaveLength(faqs.length);
    for (const entry of faqs) {
      expect(screen.getByRole('heading', { name: entry.question, level: 3 })).toBeInTheDocument();
    }
    for (const { answer } of visible) {
      expect(answer.length).toBeGreaterThan(0);
    }
  });

  it('Then the FAQPage structured data parses and matches the visible questions and answers', () => {
    // Arrange / Act
    const { container } = render(<FAQ />);

    // Assert
    const data = readStructuredData(container);
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('FAQPage');
    expect(
      data.mainEntity.map((entry) => ({
        question: entry.name,
        answer: entry.acceptedAnswer.text,
      })),
    ).toEqual(readVisibleEntries(container));
    for (const entry of data.mainEntity) {
      expect(entry['@type']).toBe('Question');
      expect(entry.acceptedAnswer['@type']).toBe('Answer');
    }
  });

  it('Then the comparison question links to the tracker comparison guide', () => {
    // Arrange
    const { container } = render(<FAQ />);
    const details = Array.from(container.querySelectorAll('details')).find((element) =>
      element.querySelector('summary')?.textContent?.includes('compare to other grail trackers'),
    );
    if (!details) throw new Error('Comparison question not found');

    // Act
    const link = within(details).getByRole('link', { name: 'tracker comparison' });

    // Assert
    expect(link).toHaveAttribute('href', guideUrl('COMPARISON.md'));
  });

  it('Then the macOS and Linux question names the Linux version and links to the tracker comparison guide', () => {
    // Arrange
    const { container } = render(<FAQ />);
    const details = findDetails(container, 'macOS or Linux');

    // Act
    const link = within(details).getByRole('link', { name: 'tracker comparison' });

    // Assert
    expect(details.querySelector('p')?.textContent).toContain("There's a Linux version");
    expect(details.querySelector('p')?.textContent).toContain("There's no macOS version.");
    expect(link).toHaveAttribute('href', guideUrl('COMPARISON.md'));
  });

  it('Then the safety and memory answers say the app never writes to the game process', () => {
    // Arrange
    const { container } = render(<FAQ />);

    // Act
    const safety = findDetails(container, 'Can I get banned');
    const memory = findDetails(container, 'game memory');

    // Assert
    expect(safety.querySelector('p')?.textContent).toContain('never writes to the game process');
    expect(memory.querySelector('p')?.textContent).toContain('(Windows only)');
    expect(memory.querySelector('p')?.textContent).toContain('It never writes to the game.');
  });

  it('If it is prerendered to HTML, then the answers and the structured data are in the markup', () => {
    // Arrange
    const template = document.createElement('template');

    // Act
    template.innerHTML = renderToString(<FAQ />);

    // Assert
    const container = template.content.firstElementChild as HTMLElement;
    expect(readVisibleEntries(container).map((entry) => entry.answer)).toEqual(
      readStructuredData(container).mainEntity.map((entry) => entry.acceptedAnswer.text),
    );
  });
});
