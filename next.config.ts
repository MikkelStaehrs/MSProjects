import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Server actions tager imod filuploads. Standardgrænsen er 1 MB.
    serverActions: { bodySizeLimit: '26mb' },
  },
  // typedRoutes er slået fra med vilje: siderne bygger stier dynamisk
  // (/p/<id>?edit=<id>) og server actions redirecter til en streng fra
  // formularen. Med typedRoutes kræver det en cast hvert eneste sted.
}

export default nextConfig
