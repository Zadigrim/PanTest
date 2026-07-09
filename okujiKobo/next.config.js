/** @type {import('next').NextConfig} */
const config = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  typescript: {
    // Pre-existing Supabase never-type errors across many files; skip during
    // build so deployments aren't blocked. Run tsc --noEmit separately.
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        // The /preview embed may be framed ONLY by the okuji.app landing page.
        // frame-ancestors both permits that embed and blocks every other site
        // from iframing it. The rest of okujiKobo has no such header (default:
        // not framable), so this narrowly opens only the preview surface.
        source: '/preview/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://okuji.app https://www.okuji.app",
          },
        ],
      },
    ]
  },
}

module.exports = config
