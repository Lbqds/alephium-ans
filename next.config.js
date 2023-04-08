/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    styledComponents: true
  },
  async rewrites() {
    return [
      {
        source: '/profile/:name',
        destination: '/profile?name=:name',
      }
    ]
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback.fs = false;
    }
    return config;
  }
}

module.exports = nextConfig
