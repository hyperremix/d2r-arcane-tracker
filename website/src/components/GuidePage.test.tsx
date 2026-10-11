import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { guides, requireGuide } from '../content';
import { GuidePage } from './GuidePage';

const base = import.meta.env.BASE_URL;

const guide = requireGuide('run-tracker');
const html = '<h1 id="run-tracker-guide">Run Tracker Guide</h1><p>Records farming sessions.</p>';

describe('When a guide page is rendered', () => {
  it('Then it shows the guide prerendered from docs/', () => {
    // Arrange / Act
    render(<GuidePage guide={guide} html={html} />);

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Run Tracker Guide' })).toBeVisible();
    expect(screen.getByText('Records farming sessions.')).toBeVisible();
  });

  it('Then the breadcrumb links back to the home page', () => {
    // Arrange / Act
    render(<GuidePage guide={guide} html={html} />);
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });

    // Assert
    expect(within(breadcrumb).getByRole('link', { name: 'Home' })).toHaveAttribute('href', base);
    const current = within(breadcrumb).getByText(guide.title);
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.closest('li')).not.toHaveAttribute('aria-current');
  });

  it('Then the title bar section links go to the sections of the home page', () => {
    // Arrange / Act
    render(<GuidePage guide={guide} html={html} />);
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });

    // Assert
    for (const [name, id] of [
      ['Features', 'features'],
      ['Install', 'install'],
      ['Guides', 'guides'],
    ]) {
      expect(within(nav).getByRole('link', { name })).toHaveAttribute('href', `${base}#${id}`);
    }
  });

  it('Then it links to every other guide page', () => {
    // Arrange / Act
    render(<GuidePage guide={guide} html={html} />);
    const moreGuides = screen.getByRole('navigation', { name: 'More guides' });

    // Assert
    const hrefs = within(moreGuides)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(
      guides.filter((other) => other !== guide).map((other) => `${base}guides/${other.slug}/`),
    );
  });

  it('Then the breadcrumb ends with the heading of the guide', () => {
    // Arrange / Act
    render(<GuidePage guide={guide} html={html} />);
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });

    // Assert
    const heading = screen.getByRole('heading', { level: 1 });
    expect(within(breadcrumb).getByText(heading.textContent ?? '')).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('Then it has a skip link to the main content', () => {
    // Arrange / Act
    render(<GuidePage guide={guide} html={html} />);

    // Assert
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('Then it contains breadcrumb structured data', () => {
    // Arrange / Act
    const { container } = render(<GuidePage guide={guide} html={html} />);

    // Assert
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(script?.textContent ?? '{}')).toMatchObject({ '@type': 'BreadcrumbList' });
  });
});
