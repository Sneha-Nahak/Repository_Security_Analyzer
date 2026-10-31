/**
 * Set NEXT_PUBLIC_SITE_URL to the public production origin, for example
 * https://example.com. On Vercel, use its production project URL as a fallback.
 */
const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

export const siteUrl = (
  configuredSiteUrl ?? (vercelProductionHost ? `https://${vercelProductionHost}` : undefined)
)?.replace(/\/+$/, "");
