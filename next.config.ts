import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // with reactStrictMode the first entry for the arena fails in blackscreen
  reactStrictMode: false,
  // Falls du später Bilder von externen Domains (wie Strapi) lädst,
  // kannst du hier auch direkt die remotePatterns vorbereiten:
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '1337',
        pathname: '/uploads/**',
      },
    ],
  },
};

export default nextConfig;