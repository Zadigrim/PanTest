'use client'

export function MobileGuard() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-panoply-navy p-8 lg:hidden">
      <div className="max-w-sm text-center">
        <div className="mb-6 text-6xl">🧭</div>
        <h1 className="mb-3 font-serif text-2xl font-bold text-white">
          PanoplyDesigner
        </h1>
        <p className="text-panoply-gray-2 leading-relaxed">
          PanoplyDesigner requires a desktop browser. Please open this page on a
          screen wider than 1024px.
        </p>
        <p className="mt-4 text-sm text-panoply-gray-3">
          To collect and stamp passports, use the{' '}
          <span className="text-panoply-teal">Panoply</span> mobile app.
        </p>
      </div>
    </div>
  )
}
