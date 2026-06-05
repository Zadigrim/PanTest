export function EmptyDetailPanel() {
  return (
    <div className="grid h-full place-items-center px-6 py-12 text-center">
      <div>
        <p className="text-[14px] font-semibold text-ink">Pick a person or institution</p>
        <p className="mt-1 text-[12px] text-muted">
          Their current subscription, capability flags, pending transfers,
          and grant history will appear here.
        </p>
      </div>
    </div>
  )
}
