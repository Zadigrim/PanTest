'use client'

import { useEffect } from 'react'

interface Props {
  onClose: () => void
}

/**
 * Designer Help drawer — opens from the Help button in the editor
 * top bar. Surfaces the "Creating Your First Passport" tutorial
 * inline so a new creator can read it without leaving their work.
 *
 * The copy is intentionally verbatim from the docx the user pasted
 * (so they can keep editing it as a single source of truth) — only
 * the JSX wrapping changes. UI vocabulary is rendered in the same
 * bold-green call-out style the source describes.
 *
 * Closes on backdrop click or Esc.
 */
export function HelpDrawer({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <div className="relative z-10 flex h-full w-[560px] flex-col overflow-y-auto border-l border-hairline bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-white px-6 py-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[3px] text-muted">Okuji</p>
            <h2 className="text-base font-semibold text-ink">Creating Your First Passport</h2>
          </div>
          <button
            onClick={onClose}
            className="text-lg text-muted hover:text-ink transition-colors"
            aria-label="Close help"
          >
            ✕
          </button>
        </div>

        <article className="prose-help flex-1 space-y-6 px-6 py-6 text-sm leading-relaxed text-ink">
          <p className="text-muted">
            A step-by-step guide to the OkujiDesigner — from a blank page to a printed, foldable passport booklet.
          </p>

          <p>
            Welcome! This guide walks you through building a complete passport in OkujiDesigner: a small booklet of pages and "stops" that people complete by visiting places, reading books, or finishing activities — collecting a stamp for each one. You don’t need any design experience. By the end, you’ll have a passport you can publish online and print as a real, foldable paper booklet.
          </p>
          <p>
            Buttons and labels you’ll click are shown in <UI>bold green</UI>, exactly as they appear on screen.
          </p>

          <Section title="1. What you’re building">
            <p>A passport has three parts:</p>
            <ul>
              <li>A <strong>cover</strong> — the front and back of the booklet, which you design as one wraparound spread.</li>
              <li><strong>Pages</strong> — the inside of the booklet. Most pages are <em>stamp pages</em> (they hold stops); some can be <em>information pages</em> (text and pictures only — good for an introduction, instructions, or prize details).</li>
              <li><strong>Stops</strong> — the individual things people do: visit a park, read a book, try a café. Each stop gets a stamp box on a page, and collectors stamp it when they complete it.</li>
            </ul>
            <Tip>
              Plan before you build: sketch your pages and stops on paper first. You can add, reorder, and delete pages at any point — but knowing your shape up front saves rework.
            </Tip>
          </Section>

          <Section title="2. Create your passport">
            <p>Open the designer. You’ll land on <UI>My Passports</UI> — your home base. Every passport you make appears here as a card.</p>
            <ol>
              <li>Click <UI>New passport</UI> (top right).</li>
              <li>Choose <UI>Start blank</UI> on the "Start from scratch" card. (The <UI>Use a template</UI> option says "Templates coming soon" — it isn’t available yet.)</li>
            </ol>
            <p>You’re now in the editor — a full-screen workspace with your blank passport.</p>
          </Section>

          <Section title="3. Find your way around">
            <p>The editor has a top bar, a row of tabs, and three columns:</p>
            <ul>
              <li><strong>Top bar</strong> — the <UI>Save</UI> button and save status, <UI>Print</UI>, <UI>Settings</UI> (the gear), and <UI>Publish</UI>. The <UI>← My Passports</UI> link on the left takes you home (it saves your work first).</li>
              <li><strong>Tabs</strong> — <UI>Cover</UI> first, then one tab per page. Click a tab to work on that part.</li>
              <li><strong>Left panel</strong> — your lists: pages, stops (on stamp pages), and "+ Add" buttons for everything.</li>
              <li><strong>Center canvas</strong> — the page itself, live. Click things to select them; drag to move; drag corners to resize. A zoom control floats at bottom right.</li>
              <li><strong>Right panel</strong> — the inspector. It always shows settings for whatever you’ve selected: a stop, an image, a page, or (with nothing selected) the passport itself.</li>
            </ul>
            <Tip>
              If the right panel seems "empty" or generic, it’s because nothing is selected. Click the thing you want to edit first — the panel follows your selection.
            </Tip>
          </Section>

          <Section title="4. Set the basics (Settings)">
            <p>Click the <UI>Settings</UI> gear in the top bar. A drawer slides in from the right.</p>
            <ul>
              <li>Under <UI>Details</UI>, give your passport a real <UI>Title</UI> and a short <UI>Description</UI>. (You can’t publish while the title is still "Untitled Passport.")</li>
              <li>Under <UI>Expected Spend</UI>, pick the tier that honestly describes what completing the passport costs a visitor — from <UI>Free</UI> up through <UI>$500+</UI> — and optionally add a note like "Includes one meal." This is required before publishing.</li>
              <li>Optional: set a cover <UI>Emblem</UI> (an emoji that represents your passport) and the <UI>Accessibility</UI> checkboxes (transit accessible, wheelchair accessible) if they apply.</li>
            </ul>
            <Note>
              One more basic lives outside the drawer: click any empty spot on a page (so nothing is selected) and the right panel shows the <UI>PASSPORT</UI> itself — including its <UI>Type</UI>: <UI>Adventure</UI> (visit physical places), <UI>Challenge</UI> (complete activities), or <UI>Educational</UI> (learn along the way). Pick the one that fits; it shapes how your passport is categorized.
            </Note>
            <Note>
              There’s also a <UI>✨ Verify with AI</UI> button that estimates spend from your stops and suggests a tier — useful as a sanity check once your stops are in.
            </Note>
          </Section>

          <Section title="5. Add, reorder, and delete pages">
            <h4 className="font-semibold text-ink">Add a page</h4>
            <ol>
              <li>In the left panel’s <UI>Pages</UI> section, click <UI>+ Add page</UI>.</li>
              <li>Choose a type: <UI>Stamp page</UI> ("Has location boxes for collecting stamps") for pages with stops, or <UI>Information page</UI> ("Text, images, and decorative elements only") for an intro, instructions, or prize page.</li>
              <li>The new page is added to the end of the list. Use reorder (below) to move it.</li>
            </ol>
            <h4 className="font-semibold text-ink">Reorder pages</h4>
            <p>Drag the <UI>⋮⋮</UI> handle next to a page name up or down. The page list reflows immediately; the new order becomes permanent when you save.</p>
            <h4 className="font-semibold text-ink">Delete a page</h4>
            <p>Click the <UI>×</UI> at the right edge of a page row. What happens next depends on whether the passport has been collected yet:</p>
            <ul>
              <li><strong>Draft / no collectors yet</strong> — the page is removed completely, along with every stop on it and any test stamps you’ve made yourself. You’ll be asked to confirm; if there are test stamps, you’ll need to type the page name to acknowledge that they’ll be lost.</li>
              <li><strong>Published, with collectors</strong> — the page is <em>closed</em>, not erased. The designer hides it (so you can’t keep editing it), but the historical record of who collected what on that page survives. The closure shows up in the republish review as a Page closure, and your collectors’ existing stamps stay on their copies. New copies acquired after the next republish won’t include the closed page.</li>
            </ul>
            <Note>
              Every passport needs at least one page. The <UI>×</UI> is hidden on the last remaining page so you can’t accidentally leave the passport empty.
            </Note>
            <h4 className="font-semibold text-ink">Designing a page’s look</h4>
            <p>Click the page (with no stop or element selected) and the right panel shows <UI>PAGE</UI> settings:</p>
            <ul>
              <li><UI>Section</UI> — a title and optional subtitle that appear on the page (e.g. "Downtown Historic District").</li>
              <li><UI>Background</UI> — choose <UI>Guilloche</UI> (a fine engraved pattern), <UI>Grid</UI>, <UI>None</UI>, or <UI>Custom image</UI>. You can set the paper color, the pattern color, and the pattern’s opacity. Keep pattern opacity low so stamps stay legible — the slider hint says the same.</li>
              <li><UI>Prize</UI> — optionally describe what finishing the page (or passport) earns, and where to redeem it.</li>
            </ul>
          </Section>

          <Section title="6. Add stops — the heart of the passport">
            <ol>
              <li>On a stamp page, click <UI>+ Add stop</UI> in the left panel. A stamp box appears on the page; drag it where you want it.</li>
              <li>With the stop selected, use the right panel to set its <UI>Name</UI> — what the collector sees ("Bloedel Reserve", "Read: Hatchet — Gary Paulsen").</li>
            </ol>

            <h4 className="font-semibold text-ink">Choose the stop type</h4>
            <p>In the <UI>Location & verification</UI> section, the <UI>Stop type</UI> dropdown is the most important choice:</p>
            <ul>
              <li><UI>Location</UI> (a place you go) — a physical place. You’ll then choose how a visit is verified (below).</li>
              <li><UI>Event / Activity</UI> (not physical) — something that isn’t a place at all: reading a book, finishing a craft, attending anything on the honor system. No address or coordinates are needed — the form hides them entirely. This is the right choice for reading programs and activity challenges.</li>
            </ul>

            <h4 className="font-semibold text-ink">If it’s a Location: pick the verification method</h4>
            <div className="overflow-hidden rounded-[6px] border border-hairline">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-surface-workspace">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Method</th>
                    <th className="px-3 py-2 font-semibold">How it verifies</th>
                    <th className="px-3 py-2 font-semibold">What you must provide</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  <tr>
                    <td className="px-3 py-2 align-top"><UI>GPS</UI></td>
                    <td className="px-3 py-2 align-top">The visitor’s phone confirms they’re at the spot, within a radius you set.</td>
                    <td className="px-3 py-2 align-top">Latitude + longitude (required). Address is optional but helps people find it.</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 align-top"><UI>QR code</UI></td>
                    <td className="px-3 py-2 align-top">The visitor scans a printed code on site.</td>
                    <td className="px-3 py-2 align-top">Street + city (required, for wayfinding). Generate the code with the <UI>Generate token</UI> button.</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 align-top"><UI>Staff-witnessed</UI></td>
                    <td className="px-3 py-2 align-top">A staff member or host signs off the visit.</td>
                    <td className="px-3 py-2 align-top">Nothing required; address and coordinates optional.</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 align-top"><UI>Evidence-documented</UI></td>
                    <td className="px-3 py-2 align-top">The visitor submits a photo or receipt as proof.</td>
                    <td className="px-3 py-2 align-top">Nothing required; address and coordinates optional.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="font-semibold text-ink">Filling in the location</h4>
            <ul>
              <li>If available, a place search box sits at the top of the section — start typing a place name ("Bainbridge Island Museum of Art"), pick the match, and the address and coordinates fill in automatically. The fastest way by far.</li>
              <li>For GPS stops, the <UI>Pick on map</UI> button (if available) opens a map — drag the pin to the exact spot and click <UI>Confirm</UI>. Or type latitude/longitude by hand.</li>
              <li>The <UI>GPS radius</UI> (default 150 meters) controls how close a visitor must be. Tighten it for a precise spot; loosen it for a large park.</li>
            </ul>
            <Note>
              The place search and map picker only appear if maps are configured on your installation. If you don’t see them, type the address and coordinates manually — everything still works.
            </Note>

            <h4 className="font-semibold text-ink">The stamp’s look</h4>
            <p>In the <UI>Stamp</UI> section, pick the stamp art (built-in emoji designs, your uploads, or your institution’s stamps), set the <UI>Ink color</UI>, and choose a <UI>Smudge level</UI> (<UI>None</UI> / <UI>Light</UI> / <UI>Medium</UI> / <UI>Heavy</UI>) for a hand-stamped feel.</p>

            <h4 className="font-semibold text-ink">Optional: learning fields</h4>
            <p>Every stop can carry a <UI>Learning objective</UI> and a <UI>Journal prompt</UI> ("What did you observe here? What surprised you?") — these power the educational experience. Classifier chips (<UI>Educational</UI>, <UI>Heritage</UI>, <UI>Nature</UI>, and more) categorize the stop; choosing <UI>Educational</UI> reveals grade-level and subject chips.</p>
          </Section>

          <Section title="7. Add images">
            <p>To put a picture on a page: in the left panel, click <UI>🖼 Add image</UI>. An empty box drops on the canvas; the right panel opens a picker where you choose an existing upload or upload something new. Drag to place, corners to resize.</p>
            <h4 className="font-semibold text-ink">Where your uploads live — read this once, it saves confusion</h4>
            <ul>
              <li>When you upload <strong>inside the designer</strong>, the image belongs to <em>this passport only</em> by default — it won’t clutter your other passports’ pickers. A small checkbox, <UI>Also save to my general library</UI>, makes it available everywhere instead. Use that for logos and anything you’ll reuse.</li>
              <li>When you upload in the <UI>Assets</UI> section (outside the designer), it’s always library-wide — that’s the place for brand images and shared material.</li>
              <li>In the <UI>Assets</UI> section you can click any upload to see exactly which passports use it, change its scope later, or delete it (deleting is blocked while a passport still uses it).</li>
            </ul>
          </Section>

          <Section title="8. Design the cover">
            <p>Click the <UI>Cover</UI> tab. You’ll see one wide spread — the whole wraparound cover laid flat, with a dashed "Spine" line down the middle. The right half is the <strong>Front</strong> of your booklet; the left half is the <strong>Back</strong>. Toggle between the <UI>Outside</UI> and <UI>Inside</UI> faces with the two pill buttons at the top.</p>
            <ul>
              <li>Click a half to select it, then set its background color in the right panel — or click <UI>+ Upload cover image</UI> for a full-bleed image across the whole spread (drag it on the canvas to reposition; fine-tune with the position and scale controls).</li>
              <li>Add a title with <UI>𝐓 Add text block</UI> from the left panel — drag it into place on the front half, and style it (size, weight, font, color) in the right panel.</li>
            </ul>
            <Tip>
              The <strong>FRONT half</strong> of the outside cover is what shows as your passport’s thumbnail everywhere — the card in My Passports and the public listing. Design that right half as the face of your passport; the back and inside only appear in print.
            </Tip>
          </Section>

          <Section title="9. Saving (what to trust)">
            <p>The designer saves continuously: most edits write themselves a moment after you make them, and an autosave sweeps up anything left every 30 seconds. The save indicator in the top bar tells you the truth at any moment:</p>
            <ul>
              <li><UI>Saved 10:42</UI> — everything’s on disk.</li>
              <li><UI>Unsaved changes</UI> (gold) — edits are queued; they’ll write in a second.</li>
              <li><UI>Saving…</UI> — a write is happening right now.</li>
              <li><UI>Save failed</UI> (red) — click <UI>Retry</UI>.</li>
            </ul>
            <p>Before stepping away or closing the tab, glance at the indicator — or just press <UI>Ctrl/⌘-S</UI> (or the <UI>Save</UI> button) for certainty. Leaving via <UI>← My Passports</UI> saves first automatically.</p>
          </Section>

          <Section title="10. Publish it">
            <p>Publishing makes your passport visible on the public <UI>Explore</UI> page, where collectors can find and download it.</p>
            <p>Click <UI>Publish</UI> in the top bar. A four-step checklist opens: <UI>Checklist → Spend → Pricing → Confirm</UI>.</p>
            <ul>
              <li><UI>Checklist</UI> — the designer lists anything that blocks publishing (a missing title, no pages, GPS stops without coordinates, QR stops without addresses, no spend tier). Fix anything flagged and come back. Event/Activity stops never need locations — they won’t be flagged.</li>
              <li><UI>Spend</UI> — confirm the expected-spend tier you set.</li>
              <li><UI>Pricing</UI> — set a price, or <UI>$0</UI> for a free passport. Free passports get a printable-PDF download link on their public page, so anyone (a teacher, a parent) can print them.</li>
              <li><UI>Confirm</UI> — review the summary and click <UI>🚀 Publish</UI>. You’ll see "Published!" and the status pill turns green.</li>
            </ul>
            <Note>
              Publishing a personal passport publicly requires an Okuji Studio subscription (the checklist will say so if you don’t have one). Institutional passports publish under the institution’s own permissions.
            </Note>
            <Warning>
              There’s currently no unpublish button in the designer — treat publishing as a real release, not an experiment.
            </Warning>
          </Section>

          <Section title="11. Print a real booklet">
            <p>Click <UI>Print</UI> (in the top bar, or on the passport’s card in My Passports). One click — no options — downloads a PDF laid out as a foldable booklet. Then, with paper in hand:</p>
            <ol>
              <li>Print the PDF at 100% scale, double-sided (duplex, long-edge / "book"), portrait.</li>
              <li>Cut along the horizontal line on every sheet.</li>
              <li>Stack the strips in numbered order (lowest number on top).</li>
              <li>Fold the stack along the vertical center line.</li>
              <li>Staple three times through the fold.</li>
            </ol>
            <p>That’s it — a real paper passport. The same instructions are printed on the PDF’s first sheet, so anyone you share it with can assemble it too.</p>
          </Section>

          <Section title="Quick reference">
            <h4 className="font-semibold text-ink">Keyboard shortcuts</h4>
            <ul>
              <li><UI>Ctrl/⌘ + S</UI> — save now.</li>
              <li><UI>Ctrl/⌘ + ,</UI> — open <UI>Settings</UI>.</li>
            </ul>
            <h4 className="font-semibold text-ink">Current limitations (good to know up front)</h4>
            <ul>
              <li>New pages add to the end of the list — use the <UI>⋮⋮</UI> handle to drag them into position.</li>
              <li>No unpublish button — publish when you mean it.</li>
              <li>Templates aren’t available yet ("Templates coming soon").</li>
              <li>Expected spend is set for the whole passport (in <UI>Settings</UI>), not per stop.</li>
              <li>Place search and the map picker only appear when maps are configured; manual entry always works.</li>
            </ul>
          </Section>

          <p className="pt-2 text-muted">
            You now know the whole journey: create, design pages and stops, add images, design the cover, publish, and print. The best next step is to make a small practice passport — three or four stops — and walk it through every section above once. After one pass, the designer will feel like home.
          </p>
        </article>
      </div>

      {/* Small CSS for nested list spacing — the help drawer is the only
          place we render long-form prose inside the designer, so we
          keep these rules local instead of polluting global styles. */}
      <style jsx>{`
        .prose-help :global(ul),
        .prose-help :global(ol) {
          padding-left: 1.25rem;
          margin: 0.5rem 0;
        }
        .prose-help :global(ul) { list-style: disc; }
        .prose-help :global(ol) { list-style: decimal; }
        .prose-help :global(li) { margin-top: 0.25rem; }
        .prose-help :global(h4) {
          font-size: 13px;
          margin-top: 0.75rem;
          margin-bottom: 0.25rem;
        }
      `}</style>
    </div>
  )
}

// ── Small typographic helpers ────────────────────────────────────────────────

/** A UI label call-out (button name, field name, menu item). Bold green
 *  matches the convention the source document describes. */
function UI({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-green">{children}</span>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="border-t border-surface-faintdiv pt-5 text-[15px] font-bold text-ink">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[6px] border-l-4 border-green bg-cream px-3 py-2 text-[12.5px] text-ink">
      <strong className="text-green">Tip: </strong>{children}
    </p>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[6px] border-l-4 border-hairline bg-surface-workspace px-3 py-2 text-[12.5px] text-ink">
      <strong>Note: </strong>{children}
    </p>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[6px] border-l-4 border-accent bg-accent/10 px-3 py-2 text-[12.5px] text-ink">
      <strong className="text-accent">Heads up: </strong>{children}
    </p>
  )
}
