/**
 * Program hub shared kit. Every Program tab (Overview / Passports /
 * Employees / Analytics) consumes its surface vocabulary from this
 * one module — no inline hex, no ad-hoc card / pill / table styles.
 *
 * Out of scope for the kit: Prizes + Terminal tabs. Those keep
 * their own surfaces this push.
 */
export { SectionLabel }   from './SectionLabel'
export { Card }           from './Card'
export { Pill, statusToVariant } from './Pill'
export { Note }           from './Note'
export { MicroNote }      from './MicroNote'
export { MetricStrip, InlineMetrics } from './MetricStrip'
export type { Metric }    from './MetricStrip'
export { EmptyState }     from './EmptyState'
export { DataTable }      from './DataTable'
export type { Column }    from './DataTable'
export { Segmented }      from './Segmented'
export type { Segment }   from './Segmented'
