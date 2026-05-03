'use client'

import { usePassportStore, selectActivePage, selectSelectedStop } from '@/lib/stores/passport-store'

export function RightInspector() {
  const activePage = usePassportStore(selectActivePage)
  const selectedStop = usePassportStore(selectSelectedStop)

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-l border-panoply-gray-2 bg-white">
      {/* Inspector header */}
      <div className="border-b border-panoply-gray-2 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-panoply-gray-3">
          {selectedStop ? 'Stop' : activePage ? 'Page' : 'Passport'}
        </p>
        <p className="truncate text-sm font-medium text-panoply-navy">
          {selectedStop
            ? selectedStop.name
            : activePage
            ? (activePage.section_title ?? activePage.section_name)
            : 'No selection'}
        </p>
      </div>

      {/* Inspector panels — Phase 3 will populate these */}
      <div className="flex-1 overflow-y-auto">
        {selectedStop ? (
          <StopInspectorPlaceholder />
        ) : activePage ? (
          <PageInspectorPlaceholder />
        ) : (
          <PassportInspectorPlaceholder />
        )}
      </div>
    </aside>
  )
}

function StopInspectorPlaceholder() {
  return (
    <div className="space-y-4 p-4">
      <InspectorSection title="Location">
        <PlaceholderField label="Address" />
        <PlaceholderField label="Coordinates" />
      </InspectorSection>
      <InspectorSection title="Stamp">
        <PlaceholderField label="Icon" />
        <PlaceholderField label="Color" />
        <PlaceholderField label="Rotation" />
      </InspectorSection>
      <InspectorSection title="Verification">
        <PlaceholderField label="Evidence tier (1–5)" />
        <PlaceholderField label="Method" />
        <PlaceholderField label="Radius (meters)" />
      </InspectorSection>
      <InspectorSection title="QR Code">
        <PlaceholderField label="Token" />
      </InspectorSection>
    </div>
  )
}

function PageInspectorPlaceholder() {
  return (
    <div className="space-y-4 p-4">
      <InspectorSection title="Section">
        <PlaceholderField label="Title" />
        <PlaceholderField label="Subtitle" />
      </InspectorSection>
      <InspectorSection title="Background">
        <PlaceholderField label="Type" />
        <PlaceholderField label="Paper color" />
        <PlaceholderField label="Opacity" />
      </InspectorSection>
      <InspectorSection title="Prize">
        <PlaceholderField label="Prize description" />
        <PlaceholderField label="Location constraint" />
      </InspectorSection>
    </div>
  )
}

function PassportInspectorPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <span className="text-3xl">👈</span>
      <p className="mt-3 text-sm text-panoply-gray-3">
        Select a stop or click on the canvas to see its properties here.
      </p>
    </div>
  )
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-panoply-gray-3">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function PlaceholderField({ label }: { label: string }) {
  return (
    <div className="rounded-card border border-panoply-gray-2 px-3 py-2">
      <p className="text-xs text-panoply-gray-3">{label}</p>
      <div className="mt-1 h-3 w-3/4 rounded bg-panoply-gray-1" />
    </div>
  )
}
