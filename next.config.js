// API base URL must be set via environment variable.
// No HTTP fallback — misconfigured deploys fail loudly instead of silently
// proxying to the wrong host.
const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_HAVNAI_API_BASE ||
  ""
).replace(/\/$/, "");

if (!API_BASE && process.env.NODE_ENV === "production") {
  // Warn loudly in build logs but don't crash the build so preview deploys work.
  console.warn(
    "[havnai-web] WARNING: NEXT_PUBLIC_HAVNAI_API_BASE is not set. " +
    "API proxying will not function correctly in production."
  );
}

const isDev = process.env.NODE_ENV !== "production";

// connect-src: only allow HTTPS origins in production.
// During local development we also allow the explicit dev API host.
const connectSrcHosts = [
  "'self'",
  "https://api.joinhavn.io",
  "https://metamask-sdk.api.cx.metamask.io",
  "wss://metamask-sdk.api.cx.metamask.io",
  "https://mm-sdk-analytics.api.cx.metamask.io",
  "https://va.vercel-scripts.com",
];

if (isDev && API_BASE && API_BASE.startsWith("http://")) {
  // Allow localhost HTTP during development only
  connectSrcHosts.push(API_BASE);
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
  `connect-src ${connectSrcHosts.join(" ")}`,
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
    if (!API_BASE) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${API_BASE}/:path*`,
      },
    ];
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
