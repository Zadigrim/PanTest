/**
 * Stamp Composer — lucide icon seed.
 *
 * Forward-looking convention: the production icon set will be a
 * folder of custom-drawn monochrome SVGs at
 * `public/stamp-icons/<category>/<key>.svg`. Until those ship,
 * we seed the picker with a curated ~50-icon subset of the
 * already-bundled lucide-react set spanning the six spec
 * categories. Swapping is a folder drop-in — the picker is
 * built to prefer fetched files first (see icons/render.ts);
 * the lucide entries are the fallback.
 *
 * Why these specific icons: they're the ones most likely to
 * appear on civic stamps, library seals, and parks markers —
 * the use cases the composer's first audience needs.
 */

import type { LucideIcon } from 'lucide-react'
import {
  // Nature
  TreePine, Leaf, Flower, Mountain, Sun, Moon, Cloud, Waves, Feather, Snowflake,
  // Creatures
  Bird, Fish, PawPrint, Bug, Dog, Cat, Rabbit, Turtle,
  // Places & travel
  MapPin, Compass, Ship, Train, Plane, Anchor, Tent, Flag, Route, House,
  // Learning & culture
  Book, BookOpen, GraduationCap, Lightbulb, Paintbrush, Palette, Music, Drama, Microscope, Telescope,
  // Food & drink
  Coffee, Utensils, Wine, Beer, Apple, IceCream, Soup, Pizza,
  // Symbols
  Star, Heart, Sparkles, Crown, Gem, Key, Lock, Scroll, Award, BadgeCheck,
} from 'lucide-react'

export type IconCategory =
  | 'nature' | 'creatures' | 'places' | 'culture' | 'food' | 'symbols'

export const ICON_CATEGORIES: { key: IconCategory; label: string }[] = [
  { key: 'nature',    label: 'Nature' },
  { key: 'creatures', label: 'Creatures' },
  { key: 'places',    label: 'Places & travel' },
  { key: 'culture',   label: 'Learning & culture' },
  { key: 'food',      label: 'Food & drink' },
  { key: 'symbols',   label: 'Symbols' },
]

export interface SeedEntry {
  category: IconCategory
  /** Stable identifier; stored in element metadata so reopen can
   *  re-find the icon even if the seed list reorders. */
  iconKey: string
  label: string
  /** Search keywords beyond the label — terms a non-designer
   *  might type ("dog" → also matches "paw" via this list). */
  keywords?: string[]
  Component: LucideIcon
}

export const LUCIDE_SEED: SeedEntry[] = [
  // ── Nature ─────────────────────────────────────────────────
  { category: 'nature', iconKey: 'tree-pine',  label: 'Pine tree',  Component: TreePine, keywords: ['forest', 'evergreen'] },
  { category: 'nature', iconKey: 'leaf',       label: 'Leaf',       Component: Leaf },
  { category: 'nature', iconKey: 'flower',     label: 'Flower',     Component: Flower, keywords: ['bloom'] },
  { category: 'nature', iconKey: 'mountain',   label: 'Mountain',   Component: Mountain, keywords: ['peak'] },
  { category: 'nature', iconKey: 'sun',        label: 'Sun',        Component: Sun },
  { category: 'nature', iconKey: 'moon',       label: 'Moon',       Component: Moon, keywords: ['night'] },
  { category: 'nature', iconKey: 'cloud',      label: 'Cloud',      Component: Cloud, keywords: ['weather'] },
  { category: 'nature', iconKey: 'waves',      label: 'Waves',      Component: Waves, keywords: ['water', 'ocean', 'sea'] },
  { category: 'nature', iconKey: 'feather',    label: 'Feather',    Component: Feather },
  { category: 'nature', iconKey: 'snowflake',  label: 'Snowflake',  Component: Snowflake, keywords: ['winter', 'snow'] },

  // ── Creatures ──────────────────────────────────────────────
  { category: 'creatures', iconKey: 'bird',     label: 'Bird',      Component: Bird },
  { category: 'creatures', iconKey: 'fish',     label: 'Fish',      Component: Fish, keywords: ['salmon'] },
  { category: 'creatures', iconKey: 'paw',      label: 'Paw print', Component: PawPrint, keywords: ['animal', 'trail'] },
  { category: 'creatures', iconKey: 'bug',      label: 'Insect',    Component: Bug, keywords: ['beetle'] },
  { category: 'creatures', iconKey: 'dog',      label: 'Dog',       Component: Dog },
  { category: 'creatures', iconKey: 'cat',      label: 'Cat',       Component: Cat },
  { category: 'creatures', iconKey: 'rabbit',   label: 'Rabbit',    Component: Rabbit, keywords: ['hare', 'bunny'] },
  { category: 'creatures', iconKey: 'turtle',   label: 'Turtle',    Component: Turtle, keywords: ['tortoise'] },

  // ── Places & travel ───────────────────────────────────────
  { category: 'places', iconKey: 'pin',        label: 'Map pin',    Component: MapPin, keywords: ['location'] },
  { category: 'places', iconKey: 'compass',    label: 'Compass',    Component: Compass, keywords: ['navigate'] },
  { category: 'places', iconKey: 'ship',       label: 'Ship',       Component: Ship, keywords: ['ferry', 'boat'] },
  { category: 'places', iconKey: 'train',      label: 'Train',      Component: Train, keywords: ['rail'] },
  { category: 'places', iconKey: 'plane',      label: 'Plane',      Component: Plane, keywords: ['flight', 'airport'] },
  { category: 'places', iconKey: 'anchor',     label: 'Anchor',     Component: Anchor, keywords: ['harbor', 'port'] },
  { category: 'places', iconKey: 'tent',       label: 'Tent',       Component: Tent, keywords: ['camp', 'campground'] },
  { category: 'places', iconKey: 'flag',       label: 'Flag',       Component: Flag, keywords: ['banner'] },
  { category: 'places', iconKey: 'route',      label: 'Route',      Component: Route, keywords: ['trail', 'path'] },
  { category: 'places', iconKey: 'house',      label: 'House',      Component: House, keywords: ['home', 'building'] },

  // ── Learning & culture ────────────────────────────────────
  { category: 'culture', iconKey: 'book',          label: 'Book',         Component: Book },
  { category: 'culture', iconKey: 'book-open',     label: 'Open book',    Component: BookOpen, keywords: ['read', 'library'] },
  { category: 'culture', iconKey: 'graduation',    label: 'Graduate cap', Component: GraduationCap, keywords: ['school', 'education'] },
  { category: 'culture', iconKey: 'lightbulb',     label: 'Lightbulb',    Component: Lightbulb, keywords: ['idea'] },
  { category: 'culture', iconKey: 'paintbrush',    label: 'Paintbrush',   Component: Paintbrush, keywords: ['art'] },
  { category: 'culture', iconKey: 'palette',       label: 'Palette',      Component: Palette, keywords: ['art', 'paint'] },
  { category: 'culture', iconKey: 'music',         label: 'Music',        Component: Music, keywords: ['note', 'song'] },
  { category: 'culture', iconKey: 'drama',         label: 'Theater',      Component: Drama, keywords: ['play', 'stage'] },
  { category: 'culture', iconKey: 'microscope',    label: 'Microscope',   Component: Microscope, keywords: ['science', 'lab'] },
  { category: 'culture', iconKey: 'telescope',     label: 'Telescope',    Component: Telescope, keywords: ['astronomy'] },

  // ── Food & drink ──────────────────────────────────────────
  { category: 'food', iconKey: 'coffee',     label: 'Coffee',    Component: Coffee, keywords: ['cafe'] },
  { category: 'food', iconKey: 'utensils',   label: 'Utensils',  Component: Utensils, keywords: ['food', 'restaurant'] },
  { category: 'food', iconKey: 'wine',       label: 'Wine',      Component: Wine, keywords: ['drink'] },
  { category: 'food', iconKey: 'beer',       label: 'Beer',      Component: Beer, keywords: ['pub'] },
  { category: 'food', iconKey: 'apple',      label: 'Apple',     Component: Apple, keywords: ['fruit'] },
  { category: 'food', iconKey: 'ice-cream',  label: 'Ice cream', Component: IceCream, keywords: ['dessert'] },
  { category: 'food', iconKey: 'soup',       label: 'Soup',      Component: Soup, keywords: ['bowl'] },
  { category: 'food', iconKey: 'pizza',      label: 'Pizza',     Component: Pizza },

  // ── Symbols ───────────────────────────────────────────────
  { category: 'symbols', iconKey: 'star',         label: 'Star',         Component: Star },
  { category: 'symbols', iconKey: 'heart',        label: 'Heart',        Component: Heart },
  { category: 'symbols', iconKey: 'sparkles',     label: 'Sparkles',     Component: Sparkles },
  { category: 'symbols', iconKey: 'crown',        label: 'Crown',        Component: Crown },
  { category: 'symbols', iconKey: 'gem',          label: 'Gem',          Component: Gem, keywords: ['diamond'] },
  { category: 'symbols', iconKey: 'key',          label: 'Key',          Component: Key },
  { category: 'symbols', iconKey: 'lock',         label: 'Lock',         Component: Lock },
  { category: 'symbols', iconKey: 'scroll',       label: 'Scroll',       Component: Scroll, keywords: ['document'] },
  { category: 'symbols', iconKey: 'award',        label: 'Award',        Component: Award, keywords: ['ribbon', 'medal'] },
  { category: 'symbols', iconKey: 'badge-check',  label: 'Verified',     Component: BadgeCheck, keywords: ['seal'] },
]
