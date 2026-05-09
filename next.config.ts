import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // with reactStrictMode the first entry for the arena fails in blackscreen
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.boozedbunnytown.com",
        port: "",
        pathname: "/media/**",
      },
    ],
  },
};

export default nextConfig;
