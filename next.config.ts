// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
// };

// export default nextConfig;


import { securityHeadersFor } from "./lib/security-headers";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: false, // false = 307 temporary redirect
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeadersFor(),
      },
      {
        source: "/forgot-password",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        source: "/reset-password",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

module.exports = nextConfig;