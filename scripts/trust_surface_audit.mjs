#!/usr/bin/env node

const baseUrl = (process.env.HAVNAI_WEB_BASE_URL || process.argv[2] || "https://joinhavn.io").replace(/\/$/, "");

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

for (const check of checks) {
  const url = `${baseUrl}${check.path}`;
  try {
    const response = await fetch(url, { redirect: "manual" });
    const body = await response.text();
    const missing = check.mustContain.filter((text) => !body.includes(text));
    if (response.status < 200 || response.status >= 300 || missing.length) {
      failures.push({ path: check.path, status: response.status, missing });
    }
    console.log(JSON.stringify({ path: check.path, status: response.status, ok: response.status >= 200 && response.status < 300 && missing.length === 0, missing }));
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
