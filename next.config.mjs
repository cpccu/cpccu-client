/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "export", // for static
  reactStrictMode: true,
  experimental: {
    agentUpgrade: "security",
  },
  images: {
    // unoptimized: true, // for static
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
