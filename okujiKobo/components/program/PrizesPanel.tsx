'use client'

import { useEffect, useState, useTransition, useId } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PassportPage, Stop, PrizeConfiguration } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageWithStops {
  id: string
  passport_id: string
  page_order: number
  section_name: string | null
  section_title: string | null
  passport_title: string
  stops: Pick<Stop, 'id' | 'name'>[]
}

interface PrizeFormState {
  prize_description: string
  prize_value_cents: string  // string for controlled input; parsed on save
  location_mode: 'all' | 'specific'
  selected_stop_ids: string[]
}

// ---------------------------------------------------------------------------
// Per-page prize form
// ---------------------------------------------------------------------------

function PagePrizeForm({
  page,
  initialConfig,
  institutionId,
}: {
  page: PageWithStops
  initialConfig: PrizeConfiguration | null
  institutionId: string
}) {
  const formId = useId()
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState<PrizeFormState>(() => ({
    prize_description: initialConfig?.prize_description ?? '',
    prize_value_cents:
      initialConfig?.prize_value_cents != null
        ? String(initialConfig.prize_value_cents / 100)
        : '',
    location_mode:
      initialConfig?.location_whitelist && initialConfig.location_whitelist.length > 0
        ? 'specific'
        : 'all',
    selected_stop_ids: initialConfig?.location_whitelist ?? [],
  }))

  function toggleStop(stopId: string) {
    setForm((prev) => ({
      ...prev,
      selected_stop_ids: prev.selected_stop_ids.includes(stopId)
        ? prev.selected_stop_ids.filter((id) => id !== stopId)
        : [...prev.selected_stop_ids, stopId],
    }))
    setSaved(false)
  }

  function handleSave() {
    setSaveError(null)
    setSaved(false)

    startTransition(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setSaveError('Not authenticated')
        return
      }

      const prizeValueCents =
        form.prize_value_cents.trim() !== ''
          ? Math.round(parseFloat(form.prize_value_cents) * 100)
          : null

      if (
        form.prize_value_cents.trim() !== '' &&
        (isNaN(prizeValueCents!) || prizeValueCents! < 0)
      ) {
        setSaveError('Prize value must be a valid positive number.')
        return
      }

      const locationWhitelist =
        form.location_mode === 'specific' && form.selected_stop_ids.length > 0
          ? form.selected_stop_ids
          : null

      const { error } = await supabase
        .from('prize_configurations')
        .upsert(
          {
            page_id: page.id,
            institution_id: institutionId,
            prize_description: form.prize_description.trim(),
            prize_value_cents: prizeValueCents,
            location_whitelist: locationWhitelist,
            configured_by: user.id,
          },
          { onConflict: 'page_id,institution_id' },
        )

      if (error) {
        setSaveError(error.message)
      } else {
        setSaved(true)
      }
    })
  }

  const pageLabel =
    page.section_title ?? page.section_name ?? `Page ${page.page_order + 1}`

  return (
    <div className="bg-white rounded-panel border border-hairline p-5">
      {/* Page header */}
      <div className="mb-4">
        <p className="text-xs text-muted font-medium uppercase tracking-wide">
          {page.passport_title}
        </p>
        <h3 className="text-sm font-semibold text-navy mt-0.5">{pageLabel}</h3>
      </div>

      <div className="space-y-4">
        {/* Prize description */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${formId}-desc`}
            className="text-sm font-medium text-navy"
          >
            Prize description
          </label>
          <input
            id={`${formId}-desc`}
            type="text"
            value={form.prize_description}
            onChange={(e) => {
              setForm((p) => ({ ...p, prize_description: e.target.value }))
              setSaved(false)
            }}
            placeholder="e.g. Free coffee coupon, 10% off voucher"
            className="h-11 rounded-panel border border-hairline bg-paper px-3 text-sm text-navy placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-green focus:border-green transition-colors"
          />
        </div>

        {/* Prize value */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${formId}-value`}
            className="text-sm font-medium text-navy"
          >
            Prize value{' '}
            <span className="font-normal text-muted">(optional, USD)</span>
          </label>
          <div className="relative w-44">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm select-none pointer-events-none">
              $
            </span>
            <input
              id={`${formId}-value`}
              type="number"
              min="0"
              step="0.01"
              value={form.prize_value_cents}
              onChange={(e) => {
                setForm((p) => ({ ...p, prize_value_cents: e.target.value }))
                setSaved(false)
              }}
              placeholder="0.00"
              className="h-11 w-full rounded-panel border border-hairline bg-paper pl-7 pr-3 text-sm text-navy placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-green focus:border-green transition-colors"
            />
          </div>
        </div>

        {/* Redeemable at */}
        <fieldset>
          <legend className="text-sm font-medium text-navy mb-2">
            Redeemable at
          </legend>
          <div className="space-y-2">
            {/* All locations */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`${formId}-location`}
                value="all"
                checked={form.location_mode === 'all'}
                onChange={() => {
                  setForm((p) => ({ ...p, location_mode: 'all', selected_stop_ids: [] }))
                  setSaved(false)
                }}
                className="accent-green"
              />
              <span className="text-sm text-navy">All locations</span>
            </label>

            {/* Specific stops */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`${formId}-location`}
                value="specific"
                checked={form.location_mode === 'specific'}
                onChange={() => {
                  setForm((p) => ({ ...p, location_mode: 'specific' }))
                  setSaved(false)
                }}
                className="accent-green"
              />
              <span className="text-sm text-navy">Specific stops</span>
            </label>

            {/* Stop checkboxes (only shown in specific mode) */}
            {form.location_mode === 'specific' && page.stops.length > 0 && (
              <div className="ml-6 mt-2 space-y-2 border-l-2 border-hairline pl-4">
                {page.stops.map((stop) => (
                  <label
                    key={stop.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.selected_stop_ids.includes(stop.id)}
                      onChange={() => toggleStop(stop.id)}
                      className="accent-green"
                    />
                    <span className="text-sm text-navy">{stop.name}</span>
                  </label>
                ))}
              </div>
            )}

            {form.location_mode === 'specific' && page.stops.length === 0 && (
              <p className="ml-6 text-xs text-muted">
                No stops found on this page.
              </p>
            )}
          </div>
        </fieldset>

        {/* Save row */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-panel text-sm font-medium bg-green text-white hover:bg-[#0F6E56] disabled:opacity-50 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
          >
            {isPending ? 'Saving…' : 'Save prize config'}
          </button>
          {saved && (
            <span className="text-sm text-green font-medium">Saved ✓</span>
          )}
          {saveError && (
            <span role="alert" className="text-sm text-accent">
              {saveError}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function PrizesPanel() {
  const [pages, setPages] = useState<PageWithStops[]>([])
  const [configs, setConfigs] = useState<Map<string, PrizeConfiguration>>(new Map())
  const [institutionId, setInstitutionId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError(null)

      try {
        const supabase = createClient()

        // Current user
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser()
        if (authErr || !user) throw new Error('Not authenticated')

        // Institution via employee authorization
        const { data: authz, error: authzErr } = await supabase
          .from('employee_authorizations')
          .select('institution_id')
          .eq('user_id', user.id)
          .limit(1)
          .single()
        if (authzErr || !authz) throw new Error('No institutional authorization found')

        setInstitutionId(authz.institution_id)

        // Passports for this institution
        const { data: passports, error: passportErr } = await supabase
          .from('passports')
          .select('id, title')
          .eq('proprietor_id', authz.institution_id)
        if (passportErr) throw new Error(passportErr.message)

        const passportMap = new Map<string, string>()
        for (const p of passports ?? []) passportMap.set(p.id, p.title)

        const passportIds = [...passportMap.keys()]
        if (passportIds.length === 0) {
          setPages([])
          setLoading(false)
          return
        }

        // Passport pages
        const { data: rawPages, error: pagesErr } = await supabase
          .from('passport_pages')
          .select('id, passport_id, page_order, section_name, section_title')
          .in('passport_id', passportIds)
          .order('page_order', { ascending: true })
        if (pagesErr) throw new Error(pagesErr.message)

        const pageIds = (rawPages ?? []).map(
          (p: Pick<PassportPage, 'id'>) => p.id,
        )

        // Stops for all pages
        const { data: rawStops, error: stopsErr } = await supabase
          .from('stops')
          .select('id, name, page_id')
          .in('page_id', pageIds.length > 0 ? pageIds : ['__none__'])
          .order('stop_order', { ascending: true })
        if (stopsErr) throw new Error(stopsErr.message)

        // Existing prize configs
        const { data: rawConfigs, error: configErr } = await supabase
          .from('prize_configurations')
          .select('*')
          .eq('institution_id', authz.institution_id)
          .in('page_id', pageIds.length > 0 ? pageIds : ['__none__'])
        if (configErr) throw new Error(configErr.message)

        const configMap = new Map<string, PrizeConfiguration>()
        for (const cfg of rawConfigs ?? []) {
          configMap.set(cfg.page_id, cfg as PrizeConfiguration)
        }
        setConfigs(configMap)

        // Build stops-per-page map
        const stopsByPage = new Map<string, Pick<Stop, 'id' | 'name'>[]>()
        for (const stop of rawStops ?? []) {
          if (!stopsByPage.has(stop.page_id)) stopsByPage.set(stop.page_id, [])
          stopsByPage.get(stop.page_id)!.push({ id: stop.id, name: stop.name })
        }

        // Assemble pages with stops
        const assembled: PageWithStops[] = (rawPages ?? []).map(
          (
            p: Pick<
              PassportPage,
              'id' | 'passport_id' | 'page_order' | 'section_name' | 'section_title'
            >,
          ) => ({
            id: p.id,
            passport_id: p.passport_id,
            page_order: p.page_order,
            section_name: p.section_name,
            section_title: p.section_title,
            passport_title: passportMap.get(p.passport_id) ?? 'Unknown passport',
            stops: stopsByPage.get(p.id) ?? [],
          }),
        )
        setPages(assembled)
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy">Prize configuration</h1>
        <p className="text-sm text-muted mt-1">
          Set prizes for each passport page. Changes take effect immediately.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-muted animate-pulse">Loading…</p>
      )}

      {loadError && (
        <div
          role="alert"
          className="bg-accent/10 border border-accent rounded-panel p-4 text-accent text-sm"
        >
          {loadError}
        </div>
      )}

      {!loading && !loadError && pages.length === 0 && (
        <p className="text-sm text-muted">
          No passport pages found for your institution.
        </p>
      )}

      {!loading && !loadError && institutionId && pages.length > 0 && (
        <div className="space-y-5">
          {pages.map((page) => (
            <PagePrizeForm
              key={page.id}
              page={page}
              initialConfig={configs.get(page.id) ?? null}
              institutionId={institutionId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
