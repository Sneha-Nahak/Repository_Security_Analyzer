import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteUrl) return [];

  return [
    {
      url: `${siteUrl}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/overview`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/scanner`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
