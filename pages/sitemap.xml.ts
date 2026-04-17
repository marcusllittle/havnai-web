import type { GetServerSideProps } from "next";
import { absoluteUrl } from "../lib/seo";

const routes = [
  "/",
  "/astra",
  "/create",
  "/ai-image-generator",
  "/how-it-works",
  "/ownership",
  "/run-a-node",
  "/marketplace",
  "/pricing",
  "/nodes",
];

function buildSitemapXml() {
  const urls = routes
    .map((route) => {
      const priority =
        route === "/" ? "1.0" :
        ["/astra", "/create", "/ai-image-generator", "/how-it-works", "/run-a-node"].includes(route) ? "0.9" :
        "0.8";
      return `
  <url>
    <loc>${absoluteUrl(route)}</loc>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader("Content-Type", "text/xml");
  res.write(buildSitemapXml());
  res.end();

  return {
    props: {},
  };
};

export default function SitemapXml() {
  return null;
}
