import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { siteUrl } from "../site-config";

export const metadata: Metadata = {
  title: "Sobre o acervo cartográfico",
  description:
    "Conheça o ATLAS1910, um acervo cartográfico para explorar estádios, partidas, competições e torcidas ligadas à história do Corinthians.",
  alternates: { canonical: "/acervo/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ATLAS1910",
    title: "Sobre o acervo cartográfico | ATLAS1910",
    description:
      "Entenda a organização do ATLAS1910 e explore suas temáticas históricas e cartográficas.",
    url: "/acervo/",
    images: [{ url: "/opengraph-image/", alt: "ATLAS1910 - História do Corinthians em mapas" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Sobre o acervo cartográfico | ATLAS1910",
    description:
      "Conheça as coleções de estádios, partidas, competições e torcidas do acervo cartográfico do Corinthians.",
    images: ["/opengraph-image/"]
  }
};

const collections = [
  {
    title: "Estádios e estatísticas",
    text: "O mapa reúne camadas de estádios e informações estatísticas associadas às partidas, para consulta por localização."
  },
  {
    title: "Deslocamentos",
    text: "O subgrupo Campeonato Brasileiro 2026 organiza as rotas disponíveis em camadas que podem ser ativadas separadamente."
  },
  {
    title: "Torcidas",
    text: "A camada Fiel Pelo Mundo localiza os núcleos representados no conjunto de dados do projeto."
  },
  {
    title: "As Brabas",
    text: "A seção dedicada ao futebol feminino apresenta o mapa de estádios, estatísticas e a camada da Libertadores 2026."
  }
];

export default function AcervoPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "Sobre o acervo cartográfico ATLAS1910",
    url: new URL("/acervo/", siteUrl).toString(),
    description: "Apresentação das coleções e temáticas do acervo cartográfico ATLAS1910.",
    isPartOf: {
      "@type": "WebSite",
      name: "ATLAS1910",
      url: siteUrl
    },
    inLanguage: "pt-BR"
  };

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="archive-main">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <span className="eyebrow">ATLAS1910 · Sobre o projeto</span>
        <h1>Um acervo cartográfico da história corinthiana</h1>
        <p className="archive-lead">
          O ATLAS1910 organiza informação histórica e geográfica relacionada ao
          Sport Club Corinthians Paulista em mapas interativos e coleções
          temáticas. A proposta é permitir que a pessoa visitante explore os
          dados por lugar, período e assunto, com acesso às camadas e referências
          disponíveis no acervo.
        </p>

        <h2>O que você encontra no mapa</h2>
        <div className="archive-cards">
          {collections.map((collection) => (
            <article className="archive-card" key={collection.title}>
              <h3>{collection.title}</h3>
              <p>{collection.text}</p>
            </article>
          ))}
        </div>

        <h2>Como explorar</h2>
        <p>
          Escolha uma temática na página inicial para abrir o WebGIS diretamente
          no subgrupo correspondente. Esse acesso carrega a seleção solicitada,
          mantendo as demais camadas desativadas; a partir do mapa, você pode
          ativar outras camadas, consultar feições e usar os filtros disponíveis.
        </p>
        <p>
          Os mapas são ferramentas de exploração do acervo. Datas, recortes,
          estimativas e informações de cada camada devem ser lidos junto às
          referências e notas fornecidas no próprio projeto.
        </p>
        <Link className="button button-primary" href="/">
          Ver temáticas do ATLAS1910 <span className="button-arrow" aria-hidden="true">↗</span>
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
