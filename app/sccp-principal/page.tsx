import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { siteUrl } from "../site-config";

const brabasLayerIds = new Set([
  "df67ecab0618",
  "36d4c656fee1",
  "4d1882104353",
  "4ff7aa65d52a",
  "a71c5be830df",
  "libertadores-2026"
]);

export const metadata: Metadata = {
  title: "Mapa principal do Corinthians",
  description:
    "Explore o WebGIS do ATLAS1910: estádios, estatísticas, deslocamentos e temáticas da história espacial do Corinthians.",
  alternates: { canonical: "/sccp-principal/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ATLAS1910",
    title: "Mapa principal do Corinthians | ATLAS1910",
    description:
      "Abra o mapa interativo do acervo cartográfico do Corinthians.",
    url: "/sccp-principal/",
    images: [{ url: "/opengraph-image/", alt: "ATLAS1910 - História do Corinthians em mapas" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Mapa principal do Corinthians | ATLAS1910",
    description:
      "Explore no WebGIS estádios, estatísticas, deslocamentos e temas da história espacial do Corinthians.",
    images: ["/opengraph-image/"]
  }
};

export default async function MainMap({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  }
  const query = params.toString();
  const subgroup = params.get("subgrupo") ?? "";
  const layer = params.get("camada") ?? "";
  if (
    subgroup.startsWith("estadios_brabas-")
    || subgroup.startsWith("competicoes_brabas-")
    || brabasLayerIds.has(layer)
  ) {
    redirect(`/as-brabas/${query ? `?${query}` : ""}`);
  }
  const source = `/mapa/sccp-principal.html${query ? `?${query}` : ""}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Mapa principal do Corinthians | ATLAS1910",
    url: new URL("/sccp-principal/", siteUrl).toString(),
    description:
      "Mapa interativo do acervo cartográfico do Corinthians, com camadas históricas de estádios, partidas e torcidas.",
    isPartOf: {
      "@type": "WebSite",
      name: "ATLAS1910",
      url: siteUrl
    },
    inLanguage: "pt-BR"
  };

  return (
    <main className="map-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <h1 className="map-page-label">Mapa principal do acervo cartográfico do Corinthians</h1>
      <iframe
        title="WebGIS ATLAS1910 - acervo cartográfico do Corinthians"
        src={source}
        allow="geolocation"
      />
    </main>
  );
}
