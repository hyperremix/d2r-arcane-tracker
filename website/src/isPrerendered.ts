/**
 * Whether the root element already holds the prerendered page (website/build.ts), which the client
 * hydrates. The dev server serves the root with only the `<!--app-html-->` placeholder comment, so
 * check for elements rather than any child node: hydrating a comment fails.
 */
export function isPrerendered(rootElement: Element): boolean {
  return rootElement.childElementCount > 0;
}
