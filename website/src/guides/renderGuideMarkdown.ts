import { Marked } from 'marked';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import { resolveDocLink } from './docLinks';
import { escapeHtml } from './escapeHtml';

function titleAttribute(title: string | null | undefined): string {
  return title ? ` title="${escapeHtml(title)}"` : '';
}

/**
 * GitHub Flavored Markdown with GitHub's heading ids, so links to `GUIDE.md#heading` keep working
 * on the site. Links and images are pointed at the site or GitHub (see resolveDocLink), and raw HTML
 * is shown as text instead of passed through: the guides don't use any.
 */
const marked = new Marked(gfmHeadingId(), {
  gfm: true,
  renderer: {
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const url = resolveDocLink(href, 'link');
      if (url === undefined) return text;
      return `<a href="${escapeHtml(url)}"${titleAttribute(title)}>${text}</a>`;
    },
    image({ href, title, text, tokens }) {
      const alt = tokens ? this.parser.parseInline(tokens, this.parser.textRenderer) : text;
      const url = resolveDocLink(href, 'image');
      if (url === undefined) return escapeHtml(alt);
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${titleAttribute(title)} loading="lazy" decoding="async">`;
    },
    html({ text }) {
      return escapeHtml(text);
    },
  },
});

/** Renders a guide from docs/ to the HTML of its page's article. */
export function renderGuideMarkdown(markdown: string): string {
  return marked.parse(markdown, { async: false });
}
