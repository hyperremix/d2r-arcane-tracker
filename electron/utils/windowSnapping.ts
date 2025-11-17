import type { Display, Rectangle } from 'electron';

/**
 * Threshold in pixels for snapping to screen edges and corners.
 * Lower values make snapping feel less \"sticky\" while still helping
 * users align the widget to screen edges when desired.
 */
const SNAP_THRESHOLD = 10;

/**
 * Calculates the snapped position for a window based on its current position and screen bounds.
 * Snaps to screen edges and corners when the window is within the threshold distance.
 *
 * @param x - Current x position of the window
 * @param y - Current y position of the window
 * @param windowBounds - The bounds of the window (width and height)
 * @param display - The display the window is currently on
 * @returns The snapped position { x, y } or the original position if no snap is needed
 */
export function calculateSnapPosition(
  x: number,
  y: number,
  windowBounds: Rectangle,
  display: Display,
): { x: number; y: number } {
  const { workArea } = display;
  const { width: windowWidth, height: windowHeight } = windowBounds;

  let snappedX = x;
  let snappedY = y;

  // Calculate distances to edges
  const distanceToLeft = x - workArea.x;
  const distanceToRight = workArea.x + workArea.width - (x + windowWidth);
  const distanceToTop = y - workArea.y;
  const distanceToBottom = workArea.y + workArea.height - (y + windowHeight);

  // Snap to left edge
  if (distanceToLeft >= 0 && distanceToLeft <= SNAP_THRESHOLD) {
    snappedX = workArea.x;
  }

  // Snap to right edge
  if (distanceToRight >= 0 && distanceToRight <= SNAP_THRESHOLD) {
    snappedX = workArea.x + workArea.width - windowWidth;
  }

  // Snap to top edge
  if (distanceToTop >= 0 && distanceToTop <= SNAP_THRESHOLD) {
    snappedY = workArea.y;
  }

  // Snap to bottom edge
  if (distanceToBottom >= 0 && distanceToBottom <= SNAP_THRESHOLD) {
    snappedY = workArea.y + workArea.height - windowHeight;
  }

  return { x: snappedX, y: snappedY };
}

/**
 * Checks if the given position is within the bounds of any display.
 * Useful for validating restored positions from settings.
 *
 * @param x - X position to check
 * @param y - Y position to check
 * @param displays - Array of available displays
 * @returns True if the position is within any display bounds
 */
export function isPositionOnScreen(x: number, y: number, displays: Display[]): boolean {
  return displays.some((display) => {
    const { bounds } = display;
    return (
      x >= bounds.x &&
      x <= bounds.x + bounds.width &&
      y >= bounds.y &&
      y <= bounds.y + bounds.height
    );
  });
}

/**
 * Gets a safe default position for the widget window.
 * Returns center of the primary display.
 *
 * @param windowWidth - Width of the window
 * @param windowHeight - Height of the window
 * @param primaryDisplay - The primary display
 * @returns Safe default position { x, y }
 */
export function getDefaultPosition(
  windowWidth: number,
  windowHeight: number,
  primaryDisplay: Display,
): { x: number; y: number } {
  const { workArea } = primaryDisplay;
  return {
    x: workArea.x + Math.floor((workArea.width - windowWidth) / 2),
    y: workArea.y + Math.floor((workArea.height - windowHeight) / 2),
  };
}
