#!/usr/bin/env node

const baseUrl = (process.env.HAVNAI_WEB_BASE_URL || process.argv[2] || "https://joinhavn.io").replace(/\/$/, "");
const vercelShareToken = process.env.HAVNAI_VERCEL_SHARE_TOKEN || "";

const devices = [
  {
    name: "desktop-chrome",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  },
  {
    name: "iphone-safari",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  },
  {
    name: "android-chrome",
    userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  },
];

const checks = [
  {
    path: "/",
    mustContain: ["Create", "Music Studio", "Astra"],
    mustNotContain: ["currently requires a Public Alpha access code"],
  },
  {
    path: "/discover",
    mustContain: ["Discover", "music"],
    mustNotContain: ["MetaMask required", "Connect MetaMask to listen"],
  },
  {
    path: "/create",
    mustContain: ["No access code", "Account &amp; credits", "credits"],
    mustNotContain: ["currently requires a Public Alpha access code"],
  },
  {
    path: "/music",
    mustContain: ["No invite code or operator key is needed", "Music"],
    mustNotContain: ["currently requires a Public Alpha access code"],
  },
  {
    path: "/video-studio",
    mustContain: ["No invite code or operator key is needed", "Video"],
    mustNotContain: ["currently requires a Public Alpha access code"],
  },
  {
    path: "/pricing",
    mustContain: ["Credits", "Credit packages"],
    mustNotContain: ["MetaMask is required to buy credits"],
  },
  {
    path: "/library",
    mustContain: ["Collection", "New creation"],
    mustNotContain: ["Connect MetaMask to continue"],
  },
  {
    path: "/music/library",
    mustContain: ["playlists", "Browsing your library is free"],
    mustNotContain: ["Connect MetaMask to continue"],
  },
  {
    path: "/support",
    mustContain: ["HavnAI support", "Never send"],
    mustNotContain: [],
  },
];

const failures = [];

function checkUrl(path) {
  const url = new URL(path, `${baseUrl}/`);
  if (vercelShareToken) url.searchParams.set("_vercel_share", vercelShareToken);
  return url;
}

function hasAccessibleName(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*(aria-label=|>\\s*[^<\\s])`, "i");
  return re.test(html);
}

function isVercelProtection(response, body) {
  const location = response.headers.get("location") || "";
  return location.includes("vercel.com/sso-api")
    || body.includes("<title>Login – Vercel")
    || body.includes("<title>Login - Vercel")
    || body.includes("Vercel Authentication");
}

for (const device of devices) {
  for (const check of checks) {
    const url = checkUrl(check.path);
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": device.userAgent,
          "accept": "text/html,application/xhtml+xml",
        },
      });
      const body = await response.text();
      const protectedPreview = isVercelProtection(response, body);
      const missing = check.mustContain.filter((text) => !body.includes(text));
      const forbidden = check.mustNotContain.filter((text) => body.includes(text));
      const accessibleControls = hasAccessibleName(body, "button") || hasAccessibleName(body, "a") || !/(<button\b|<a\b)/i.test(body);
      const ok = response.status >= 200 && response.status < 300 && !protectedPreview && missing.length === 0 && forbidden.length === 0 && accessibleControls;
      const result = { device: device.name, path: check.path, status: response.status, ok, protectedPreview, missing, forbidden, accessibleControls };
      console.log(JSON.stringify(result));
      if (!ok) failures.push(result);
    } catch (error) {
      const result = { device: device.name, path: check.path, ok: false, error: error instanceof Error ? error.message : String(error) };
      console.log(JSON.stringify(result));
      failures.push(result);
    }
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, baseUrl, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, baseUrl, devices: devices.length, routes: checks.length }));
