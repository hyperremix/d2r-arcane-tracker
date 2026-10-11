import { guides, guideUrl, repositoryFileUrl, repositoryRawUrl } from '../content';

/** Stands in for the repository root, to resolve relative links the way GitHub does */
const REPOSITORY_ROOT = 'https://repository.invalid/';
const DOCS_FOLDER = new URL('docs/', REPOSITORY_ROOT);
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export type DocLinkKind = 'link' | 'image';

/**
 * Resolves a link or image `href` of a guide in docs/ to where it should point on the site:
 *
 * - Anchors on the same page stay as they are.
 * - Links to another guide go to that guide's page, keeping the anchor.
 * - Other repository files (other docs, source files, LICENSE) go to GitHub.
 * - Images in the repository load from GitHub's raw file host.
 * - http(s) and mailto URLs stay as they are; other schemes (e.g. `javascript:`) return
 *   `undefined`, so the link is rendered as plain text.
 */
export function resolveDocLink(href: string, kind: DocLinkKind): string | undefined {
  const trimmed = href.trim();
  if (trimmed === '') return undefined;
  if (trimmed.startsWith('#')) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed, DOCS_FOLDER);
  } catch {
    return undefined;
  }

  if (url.origin !== DOCS_FOLDER.origin) {
    return SAFE_PROTOCOLS.has(url.protocol) ? trimmed : undefined;
  }

  const repoPath = url.pathname.slice(1);
  if (kind === 'image') return repositoryRawUrl(repoPath);

  const docsFile = url.pathname.startsWith(DOCS_FOLDER.pathname)
    ? url.pathname.slice(DOCS_FOLDER.pathname.length)
    : undefined;
  const guide = guides.find((candidate) => candidate.file === docsFile);
  if (url.search === '' && guide) return guideUrl(guide.file, url.hash.slice(1));
  return `${repositoryFileUrl(repoPath)}${url.search}${url.hash}`;
}
