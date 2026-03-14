/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "export", // for static export - comment out for Node.js server
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
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;