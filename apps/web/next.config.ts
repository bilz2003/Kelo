import type { NextConfig } from "next";
import path from "node:path";

// Kelo's own image host is the only external image source: charger photos
// are presigned S3 URLs (the bucket is private — see INFRASTRUCTURE.md).
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://*.amazonaws.com",
  // Next.js emits inline bootstrap scripts/styles; nonce-based CSP would
  // force every page dynamic, which the marketing pages shouldn't be.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Not applied in dev: HMR needs eval, which this policy (correctly) forbids.
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: CSP }] : []),
];

const config: NextConfig = {
  // The monorepo root, so Next traces @kelo/core from packages/core.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  turbopack: { root: path.join(__dirname, "../..") },
  poweredByHeader: false,
  // /hosts and /metering were folded into the homepage (its #hosts and
  // #how-it-works sections) when the site was restyled from the finished mockups.
  async redirects() {
    return [
      { source: "/hosts", destination: "/#hosts", permanent: true },
      { source: "/metering", destination: "/#how-it-works", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
