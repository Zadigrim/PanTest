/**
 * moichido wordmark — Space Grotesk with the "ichi" letters
 * highlighted in apricot (the 一 — "one" — at the heart of もう一度
 * "mō ichido / once more"). The wordmark and the Ring-with-gap
 * mark are the two visual anchors of the brand.
 *
 * Color comes from currentColor for the base letters; the highlight
 * is hard-set to moichido-apricot via the Tailwind class so the
 * tokens.ts source-of-truth governs both surfaces consistently.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`font-moichido font-bold tracking-tight lowercase ${className ?? ''}`}>
      mo<span className="text-moichido-apricot">ichi</span>do
    </span>
  )
}
