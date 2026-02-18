const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_HAVNAI_API_BASE || "http://api.joinhavn.io:5001")
    .replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_BASE}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
