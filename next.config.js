const isDev = process.env.NODE_ENV !== "production";
const developmentApiBase = isDev
  ? process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_HAVNAI_API_BASE
  : undefined;
const API_BASE = (
  process.env.HAVNAI_API_BASE_URL ||
  developmentApiBase ||
  "https://api.joinhavn.io"
).replace(/\/$/, "");

if (!/^https?:\/\//i.test(API_BASE)) {
  throw new Error("HAVNAI_API_BASE_URL must be an absolute HTTP(S) coordinator origin");
}

const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https://api.joinhavn.io https://astra.joinhavn.io https://metamask-sdk.api.cx.metamask.io wss://metamask-sdk.api.cx.metamask.io https://mm-sdk-analytics.api.cx.metamask.io https://va.vercel-scripts.com",
  "worker-src 'self' blob:",
].join("; ");

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), xr-spatial-tracking=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: cspReportOnly,
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      {
        source: "/generator",
        destination: "/create",
        permanent: true,
      },
      {
        source: "/join",
        destination: "/run-a-node",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: "/api/:path*",
          destination: `${API_BASE}/:path*`,
        },
      ],
    };
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
