// Web has no native splash screen to cross-fade out of, so the overlay is a no-op
// here -- the native variant (animated-icon.tsx) carries the real animation.
export function AnimatedSplashOverlay() {
  return null;
}
