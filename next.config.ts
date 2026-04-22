import type { NextConfig } from "next";

const convexHttpUrl = (process.env.NEXT_PUBLIC_CONVEX_URL || "http://127.0.0.1:3210").replace(/:\d+$/, ":3211");

const nextConfig: NextConfig = {
  cacheComponents: true,
  reactCompiler: true,
  poweredByHeader: false,
  compress: true,
  async rewrites() {
    return [
      {
        source: "/api/stripe/:path*",
        destination: `${convexHttpUrl}/api/stripe/:path*`,
      },
      {
        source: "/api/webhooks/:path*",
        destination: `${convexHttpUrl}/api/webhooks/:path*`,
      },
      {
        source: "/api/mock/:path*",
        destination: `${convexHttpUrl}/api/mock/:path*`,
      },
      {
        source: "/api/client-error",
        destination: `${convexHttpUrl}/api/client-error`,
      },
      // Proxy tracking endpoints to Convex (needed for localhost snippet testing)
      {
        source: "/api/tracking/:path*",
        destination: `${convexHttpUrl}/api/tracking/:path*`,
      },
      {
        source: "/track/:path*",
        destination: `${convexHttpUrl}/track/:path*`,
      },
    ];
  },
  images: {
    dangerouslyAllowSVG: true, // This allows SVG usage
    remotePatterns: [
      {
        protocol: "https", // Or 'http' if that's what your URLs use
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**", // Allows any path under this hostname
      },
      {
        protocol: "https", // Or 'http' if that's what your URLs use
        hostname: "utfs.io",
        port: "",
        pathname: "/a/uy24lm300a/**", // Allows any path under this hostname
      },
      {
        protocol: "https", // Or 'http' if that's what your URLs use
        hostname: "avatars.githubusercontent.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: "/(.*)\\.(ico|png|jpg|jpeg|gif|svg|webp|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache static JS/CSS bundles
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;