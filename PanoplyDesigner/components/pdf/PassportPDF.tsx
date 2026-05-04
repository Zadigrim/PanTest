import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Path,
  Ellipse,
  Rect,
  StyleSheet,
} from '@react-pdf/renderer'
import { spendTierLabel } from '@/lib/utils/spend-tiers'
import type { Passport, PassportPage, Stop } from '@/lib/supabase/types'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#F5F2EC',
  },
  header: {
    padding: 24,
    borderBottom: '1pt solid #E0DDD4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  passportTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#0D1B2A',
  },
  passportMeta: {
    fontSize: 9,
    color: '#808080',
    marginTop: 3,
  },
  pageBody: {
    padding: 24,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#0D1B2A',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 10,
    color: '#808080',
    marginBottom: 16,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottom: '0.5pt solid #E0DDD4',
  },
  stopBox: {
    width: 48,
    height: 48,
    borderRadius: 4,
    border: '1pt solid #E0DDD4',
    backgroundColor: '#ffffff',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0D1B2A',
  },
  stopAddress: {
    fontSize: 9,
    color: '#808080',
    marginTop: 2,
  },
  stopMeta: {
    fontSize: 9,
    color: '#1D9E75',
    marginTop: 2,
  },
  tierBadge: {
    fontSize: 8,
    color: '#0D1B2A',
    backgroundColor: '#E1F5EE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 3,
    alignSelf: 'flex-start',
  },
  qrNote: {
    fontSize: 8,
    color: '#C9A84C',
    marginTop: 2,
  },
  footer: {
    padding: '8 24',
    borderTop: '0.5pt solid #E0DDD4',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#808080',
  },
  prizeBox: {
    backgroundColor: '#E1F5EE',
    border: '1pt solid #1D9E75',
    borderRadius: 4,
    padding: 10,
    marginTop: 16,
  },
  prizeTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0F6E56',
    marginBottom: 3,
  },
  prizeText: {
    fontSize: 9,
    color: '#0D1B2A',
  },
})

const TIER_LABELS: Record<number, string> = {
  1: 'Honor',
  2: 'GPS',
  3: 'QR Code',
  4: 'Witnessed',
  5: 'Documented',
}

interface Props {
  passport: Passport
  pages: PassportPage[]
  stops: Stop[]
}

export function PassportPDF({ passport, pages, stops }: Props) {
  const stopsByPage = (pageId: string) => stops.filter((s) => s.page_id === pageId)

  const metaParts = [
    spendTierLabel(passport.expected_spend_tier),
    passport.transit_accessible ? 'Transit-accessible' : null,
    passport.wheelchair_accessible ? 'Wheelchair-accessible' : null,
  ].filter(Boolean)

  return (
    <Document title={passport.title} author="PanoplyDesigner">
      {/* Cover page */}
      <Page size="LETTER" style={[styles.page, { backgroundColor: `#${passport.cover_paper_color ?? 'F5F2EC'}` }]}>
        {/* Guilloche background */}
        <GuillocheBackground color={`#${passport.cover_bg_color ?? '0D1B2A'}`} opacity={0.1} />

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48 }}>
          <Text style={{ fontSize: 48, marginBottom: 24 }}>{passport.cover_emblem ?? '🧭'}</Text>
          <Text style={{ fontSize: 28, fontFamily: 'Helvetica-Bold', color: '#0D1B2A', textAlign: 'center' }}>
            {passport.title}
          </Text>
          {passport.description && (
            <Text style={{ fontSize: 12, color: '#808080', marginTop: 12, textAlign: 'center', maxWidth: 360 }}>
              {passport.description}
            </Text>
          )}
          {metaParts.length > 0 && (
            <Text style={{ fontSize: 10, color: '#1D9E75', marginTop: 24 }}>
              {metaParts.join('  ·  ')}
            </Text>
          )}
          {passport.expected_spend_note && (
            <Text style={{ fontSize: 9, color: '#808080', marginTop: 6 }}>
              {passport.expected_spend_note}
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>PanoplyDesigner</Text>
          <Text style={styles.footerText}>{new Date().toLocaleDateString()}</Text>
        </View>
      </Page>

      {/* One page per passport page */}
      {pages.map((page, pageIdx) => {
        const pageStops = stopsByPage(page.id)
        return (
          <Page key={page.id} size="LETTER" style={[styles.page, { backgroundColor: `#${page.paper_color ?? 'F5F2EC'}` }]}>
            {page.background_type === 'guilloche' && (
              <GuillocheBackground
                color={`#${page.background_color ?? '0D1B2A'}`}
                opacity={(page.background_opacity ?? 12) / 100}
              />
            )}

            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.passportTitle}>
                  {page.section_title ?? page.section_name ?? `Page ${pageIdx + 1}`}
                </Text>
                {page.section_subtitle && (
                  <Text style={styles.passportMeta}>{page.section_subtitle}</Text>
                )}
              </View>
              <Text style={{ fontSize: 9, color: '#808080' }}>
                {pageIdx + 1} / {pages.length}
              </Text>
            </View>

            <View style={styles.pageBody}>
              {pageStops.map((stop) => (
                <View key={stop.id} style={styles.stopRow}>
                  {/* Stamp box */}
                  <View style={[styles.stopBox, { borderColor: `#${stop.stamp_color ?? '1D9E75'}` }]}>
                    <Text style={{ fontSize: 20 }}>{stop.stamp_icon ?? '📍'}</Text>
                  </View>

                  {/* Stop details */}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stopName}>{stop.name}</Text>
                    {(stop.address_street || stop.address_city) && (
                      <Text style={styles.stopAddress}>
                        {[
                          stop.address_street,
                          [stop.address_city, stop.address_state].filter(Boolean).join(', '),
                          stop.address_zip,
                        ].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                    <Text style={styles.stopMeta}>
                      Tier {stop.verification_tier}: {TIER_LABELS[stop.verification_tier] ?? 'Honor'}
                      {stop.verification_tier >= 2 && stop.verification_radius_meters
                        ? ` · ${stop.verification_radius_meters}m radius`
                        : ''}
                    </Text>
                    {stop.qr_code_token && (
                      <Text style={styles.qrNote}>QR: {stop.qr_code_token}</Text>
                    )}
                    {stop.learning_objective && (
                      <Text style={{ fontSize: 9, color: '#808080', marginTop: 2 }}>
                        {stop.learning_objective}
                      </Text>
                    )}
                  </View>
                </View>
              ))}

              {pageStops.length === 0 && (
                <Text style={{ fontSize: 10, color: '#808080', fontStyle: 'italic' }}>
                  No stops on this page yet.
                </Text>
              )}

              {page.prize_description && (
                <View style={styles.prizeBox}>
                  <Text style={styles.prizeTitle}>🏆 Prize</Text>
                  <Text style={styles.prizeText}>{page.prize_description}</Text>
                  {page.prize_location_constraint && (
                    <Text style={[styles.prizeText, { marginTop: 4, color: '#808080' }]}>
                      {page.prize_location_constraint}
                    </Text>
                  )}
                </View>
              )}
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{passport.title}</Text>
              <Text style={styles.footerText}>
                {pageStops.length} stop{pageStops.length === 1 ? '' : 's'}
              </Text>
            </View>
          </Page>
        )
      })}
    </Document>
  )
}

/** Tiled guilloche SVG background for PDF pages. */
function GuillocheBackground({ color, opacity }: { color: string; opacity: number }) {
  const tiles: React.ReactNode[] = []
  const tileSize = 32
  const cols = Math.ceil(612 / tileSize) + 1
  const rows = Math.ceil(792 / tileSize) + 1

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * tileSize
      const y = r * tileSize
      const cx = x + 16
      const cy = y + 16
      tiles.push(
        <React.Fragment key={`${r}-${c}`}>
          <Ellipse cx={cx} cy={cy} rx={14} ry={7} strokeWidth={0.6} stroke={color} fill="none" />
          {/* Rotated ellipse approximated as another ellipse (PDF SVG has no transform) */}
          <Ellipse cx={cx} cy={cy} rx={7} ry={14} strokeWidth={0.6} stroke={color} fill="none" />
          <Path
            d={`M${cx},${y + 2} L${x + tileSize - 2},${cy} L${cx},${y + tileSize - 2} L${x + 2},${cy} Z`}
            strokeWidth={0.4}
            stroke={color}
            fill="none"
          />
        </React.Fragment>,
      )
    }
  }

  return (
    <Svg
      viewBox={`0 0 612 792`}
      style={{ position: 'absolute', top: 0, left: 0, width: 612, height: 792, opacity }}
    >
      {tiles}
    </Svg>
  )
}
