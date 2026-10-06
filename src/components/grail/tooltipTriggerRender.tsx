import type { ReactElement } from 'react';

/**
 * Returns the `render` prop for a TooltipTrigger. Focusable triggers keep the default button;
 * non-focusable triggers render a plain span so they stay out of the tab order.
 */
export function getTooltipTriggerRender(focusable: boolean): ReactElement | undefined {
  return focusable ? undefined : <span />;
}
