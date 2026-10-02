/**
 * Haptic feedback on tap. Works on Android (Vibration API).
 * iOS Safari does NOT support navigator.vibrate — Apple blocks it,
 * so this is a no-op on iPhones. Safe to call everywhere.
 */
export function triggerHaptic(pattern: number | number[] = 12): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Silently ignore — haptics are best-effort.
  }
}

/** Light tap — buttons, tabs, cards. */
export function hapticTap(): void {
  triggerHaptic(10);
}

/** Selection confirmed — package picked, sort changed. */
export function hapticSelect(): void {
  triggerHaptic([12, 40, 12]);
}
