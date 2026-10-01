import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  trailingSlash: true,
  async redirects() {
    return [
      {
        source: "/index.html",
        destination: "/sccp-principal/",
        permanent: false
      },
      {
        source: "/camadas/:shareId",
        destination: "/?camada=:shareId",
        permanent: false
      },
      {
        source: "/as-brabas",
        destination: "/as-brabas.html",
        permanent: false
      },
      {
        source: "/as-brabas/camadas/:shareId",
        destination: "/as-brabas.html?camada=:shareId",
        permanent: false
      }
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
        ]
      },
      {
        source: "/data/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400"
          }
        ]
      },
      {
        source: "/css/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        source: "/js/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        source: "/previews/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }
        ]
      },
      {
        source: "/assets/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" }
        ]
      }
    ];
  }
};

export default nextConfig;
