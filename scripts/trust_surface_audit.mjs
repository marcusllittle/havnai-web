#!/usr/bin/env node

const baseUrl = (process.env.HAVNAI_WEB_BASE_URL || process.argv[2] || "https://joinhavn.io").replace(/\/$/, "");
const vercelShareToken = process.env.HAVNAI_VERCEL_SHARE_TOKEN || "";

const checks = [
  { path: "/terms", mustContain: ["HavnAI terms", "Public content", "Accounts and wallets"] },
  { path: "/privacy", mustContain: ["HavnAI privacy notice", "Private by default", "Payments, wallets, and nodes"] },
  { path: "/terms/credits-v1", mustContain: ["Credit purchase terms", "One-time packs", "No wallet required"] },
  { path: "/refunds/credits-v1", mustContain: ["Refund policy", "Refund requests"] },
  { path: "/ownership", mustContain: ["Collections &amp; ownership", "What your account owns"] },
  { path: "/support", mustContain: ["HavnAI support", "Keep secrets out of your message"] },
  { path: "/sitemap.xml", mustContain: ["/terms", "/privacy", "/ownership", "/support"] },
];

const failures = [];

function checkUrl(path) {
  const url = new URL(path, `${baseUrl}/`);
  if (vercelShareToken) url.searchParams.set("_vercel_share", vercelShareToken);
  return url;
}

function isVercelProtection(response, body) {
  const location = response.headers.get("location") || "";
  return location.includes("vercel.com/sso-api")
    || location.startsWith("/login")
    || body.includes("<title>Login – Vercel")
    || body.includes("<title>Login - Vercel")
    || body.includes("Vercel Authentication");
}

for (const check of checks) {
  const url = checkUrl(check.path);
  try {
    const response = await fetch(url, { redirect: "manual" });
    const body = await response.text();
    const protectedPreview = isVercelProtection(response, body);
    const missing = check.mustContain.filter((text) => !body.includes(text));
    if (response.status < 200 || response.status >= 300 || protectedPreview || missing.length) {
      failures.push({ path: check.path, status: response.status, protectedPreview, missing });
    }
    console.log(JSON.stringify({ path: check.path, status: response.status, ok: response.status >= 200 && response.status < 300 && !protectedPreview && missing.length === 0, protectedPreview, missing }));
  } catch (error) {
    failures.push({ path: check.path, error: error instanceof Error ? error.message : String(error) });
    console.log(JSON.stringify({ path: check.path, ok: false, error: error instanceof Error ? error.message : String(error) }));
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, baseUrl, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, baseUrl, checked: checks.length }));
