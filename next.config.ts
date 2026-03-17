import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  basePath: '/hycert-ui',
  transpilePackages: ['@hysp/ui-kit'],
}

export default nextConfig
