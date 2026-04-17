import Head from "next/head";
import { ReactNode } from "react";
import { absoluteUrl, buildTitle, normalizeCanonical, normalizeImage, SeoConfig, SITE_NAME } from "../lib/seo";

type SeoHeadProps = SeoConfig & {
  schema?: Record<string, unknown> | Array<Record<string, unknown>>;
  children?: ReactNode;
};

export function SeoHead({
  title,
  description,
  path,
  image,
  noindex = false,
  type = "website",
  canonicalUrl,
  schema,
  children,
}: SeoHeadProps) {
  const fullTitle = buildTitle(title);
  const canonical = normalizeCanonical(path, canonicalUrl);
  const imageUrl = normalizeImage(image);
  const robots = noindex ? "noindex, nofollow" : "index, follow";
  const schemaPayload = schema
    ? JSON.stringify(Array.isArray(schema) ? schema : [schema])
    : null;

  return (
    <Head>
      <title>{fullTitle}</title>
      {description ? <meta name="description" content={description} /> : null}
      <link rel="canonical" href={canonical} />
      <meta name="robots" content={robots} />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      {description ? <meta property="og:description" content={description} /> : null}
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description ? <meta name="twitter:description" content={description} /> : null}
      <meta name="twitter:image" content={imageUrl} />

      {schemaPayload ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: schemaPayload }}
        />
      ) : null}

      {children}
    </Head>
  );
}

export function buildWebsiteSchema() {
  const siteUrl = absoluteUrl("/");
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: siteUrl,
      logo: absoluteUrl("/HavnAI-logo.png"),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: siteUrl,
    },
  ];
}
