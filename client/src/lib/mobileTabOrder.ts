/** Hold the tab bar and slide; the page opens only when the finger lifts. */
export const TAB_LONG_PRESS_MS = 180;
export const TAB_SCRUB_PX = 12;

export function tabIndexFromClientX(clientX: number, rect: { left: number; width: number }, count: number): number {
  if (count <= 0 || rect.width <= 0) return 0;
  const x = Math.min(Math.max(clientX - rect.left, 0), rect.width - 0.01);
  return Math.min(count - 1, Math.floor((x / rect.width) * count));
}

/** Fractional slot so the liquid thumb can follow a finger between tabs. */
export function tabProgressFromClientX(clientX: number, rect: { left: number; width: number }, count: number): number {
  if (count <= 1 || rect.width <= 0) return 0;
  const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  return Math.min(count - 1, Math.max(0, ratio * count - 0.5));
}
