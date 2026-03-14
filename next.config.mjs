/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "export", // for static
  reactStrictMode: true,
  // async redirects() {
  //   return [
  //     {
  //       source: "/home",
  //       destination: "/",
  //       permanent: true,
  //     },
  //   ];
  // },
  images: {
    // unoptimized: true, // for static
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;