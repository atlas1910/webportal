import type { MetadataRoute } from "next";
import { siteUrl } from "./site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      changeFrequency: "monthly",
      priority: 1
    },
    {
      url: new URL("/acervo/", siteUrl).toString(),
      changeFrequency: "monthly",
      priority: 0.8
    },
    {
      url: new URL("/sccp-principal/", siteUrl).toString(),
      changeFrequency: "monthly",
      priority: 0.9
    },
    {
      url: new URL("/as-brabas.html", siteUrl).toString(),
      changeFrequency: "monthly",
      priority: 0.9
    }
  ];
}
