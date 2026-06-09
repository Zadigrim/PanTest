/**
 * Ring-with-gap mark. The moichido visual identity — a circle
 * whose perimeter is interrupted by a small gap, evoking the
 * "almost-complete" feeling of a punch card on its penultimate
 * punch. The mark is monochrome and inherits color from the
 * caller via `currentColor` so the same SVG can ink teal on a
 * paper bg or apricot on a teal bg.
 *
 * No animation in M4.1 — the M4.x merchant features may animate
 * the gap closing on a fresh punch, but that's product work, not
 * frame work.
 */
export function RingMark({
  size = 32,
  strokeWidth = 2.5,
  className,
}: {
  size?: number
  strokeWidth?: number
  className?: string
}) {
  // Open-arc path: a circle with a ~30° gap at the top-right
  // (1 o'clock). The gap reads as "one more punch to complete"
  // rather than "broken ring."
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M 28 7.5 A 15 15 0 1 0 33 17" />
    </svg>
  )
}
