// Browser-side: take an SVG markup string, rasterize to a PNG Blob.
//
// Pipeline:
//   1. Wrap the SVG in a same-origin object URL so the browser can
//      load it via <img>.
//   2. Wait for the image to load (this also waits for any embedded
//      data: URIs inside the SVG — external URLs would taint the
//      canvas, so callers must inline images as data: BEFORE rendering).
//   3. Draw the image into an offscreen <canvas> at the requested size.
//   4. Export PNG via canvas.toBlob.

const PNG_TYPE = 'image/png'

export async function svgStringToPngBlob(
  svg: string,
  width: number,
  height: number,
): Promise<Blob> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width  = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')
    ctx.drawImage(img, 0, 0, width, height)
    return await canvasToBlob(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b)
      else reject(new Error('canvas.toBlob returned null'))
    }, PNG_TYPE)
  })
}

/** Fetch an external image URL and return it as a data: URI so we can
 *  embed it inline in an SVG without tainting the canvas. Returns the
 *  original URL on failure (the SVG may render it directly; the only
 *  fallout is that toBlob may fail for that page — which the publish
 *  flow surfaces as a per-page error). */
export async function urlToDataUri(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) return url
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror   = () => reject(new Error('FileReader failed'))
      reader.readAsDataURL(blob)
    })
  } catch {
    return url
  }
}
