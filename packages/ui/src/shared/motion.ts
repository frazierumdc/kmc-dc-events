/** Reduce Motion is on, or the browser can't say (then nothing moves). */
export function reducedMotion(): boolean {
  return (
    typeof window.matchMedia !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
