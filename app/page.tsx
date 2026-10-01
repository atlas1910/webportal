import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { siteUrl } from "./site-config";

export const metadata: Metadata = {
  title: "História do Corinthians em mapas: acervo ATLAS1910",
  description:
    "Explore a história espacial do Corinthians: estádios, estatísticas, deslocamentos, competições e a presença da Fiel pelo mundo.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ATLAS1910",
    title: "ATLAS1910 - História do Corinthians em mapas",
    description:
      "Um acervo cartográfico para explorar estádios, partidas, competições e temáticas corinthianas.",
    url: "/",
    images: [{ url: "/opengraph-image/", alt: "ATLAS1910 - História do Corinthians em mapas" }]
  }
};

const topics = [
  {
    index: "01 / MEMÓRIA E TERRITÓRIO",
    title: "Estádios históricos",
    description: "Explore os locais que fazem parte do acervo histórico do Corinthians.",
    subgroup: "estadios-estadios-do-corinthians",
    preview: "/previews/estadios.svg",
    size: "wide"
  },
  {
    index: "02 / DADOS DO ACERVO",
    title: "Estatísticas por estádio",
    description: "Veja os dados de partidas associados aos estádios mapeados.",
    subgroup: "estadios-estatisticas",
    preview: "/previews/estadios.svg"
  },
  {
    index: "03 / PRESENÇA INTERNACIONAL",
    title: "Países visitados",
    description: "Visualize no mapa os países associados às partidas do Corinthians.",
    subgroup: "estadios-paises-que-o-corinthians-ja-jogou",
    preview: "/previews/torcidas.svg"
  },
  {
    index: "04 / TEMPORADA 2026",
    title: "Deslocamentos",
    description: "Acesse as rotas de deslocamento do subgrupo Campeonato Brasileiro 2026.",
    subgroup: "deslocamentos-campeonato-brasileiro-2026",
    preview: "/previews/deslocamentos.svg"
  },
  {
    index: "05 / A FIEL PELO MUNDO",
    title: "Núcleos no exterior",
    description: "Encontre os pontos da camada Fiel Pelo Mundo no mapa.",
    subgroup: "torcidas-fiel-pelo-mundo",
    preview: "/previews/torcidas.svg"
  }
];

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ATLAS1910",
    url: siteUrl,
    description:
      "Acervo cartográfico para explorar a história espacial do Sport Club Corinthians Paulista.",
    inLanguage: "pt-BR"
  };

  return (
    <div className="site-shell">
      <SiteHeader />
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-art" aria-hidden="true">
            <Image
              src="/previews/world-atlas.svg"
              alt=""
              width={1600}
              height={820}
              sizes="100vw"
              loading="eager"
              unoptimized
            />
          </div>
          <div className="hero-content">
            <span className="eyebrow">Acervo cartográfico · Desde 1910</span>
            <h1 id="hero-title">
              O Corinthians visto em mapa
              <br />
              <span>e sob uma perspectiva espacial.</span>
            </h1>
            <p className="hero-copy">
              O Atlas é um compilado de mapas autorais que espacializam dados e histórias do clube. São materiais que exploram partidas, competições e a presença da Fiel Torcida.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/sccp-principal/" prefetch={false}>
                Explorar o mapa principal <span className="button-arrow" aria-hidden="true">↗</span>
              </Link>
              <a className="button button-brabas" href="/as-brabas/">
                As Brabas
              </a>
            </div>
            <p className="hero-note">
              Selecione uma temática para abrir o mapa diretamente na camada correspondente.
            </p>
          </div>
        </section>

        <section className="content-section" aria-labelledby="themes-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Explore por temática</span>
              <h2 id="themes-title">Escolha por onde começar</h2>
            </div>
            <p>
              Cada atalho abre o WebGIS no tema escolhido, sem carregar os outros
              subgrupos. Você pode ativar mais camadas a qualquer momento.
            </p>
          </div>
          <div className="topic-grid">
            {topics.map((topic) => (
              <Link
                className={`topic-card${topic.size === "wide" ? " topic-card-wide" : ""}`}
                href={`/sccp-principal/?subgrupo=${encodeURIComponent(topic.subgroup)}`}
                prefetch={false}
                key={topic.subgroup}
              >
                <span className="topic-art" aria-hidden="true">
                  <Image
                    src={topic.preview}
                    alt=""
                    loading="lazy"
                    width={800}
                    height={420}
                    unoptimized
                  />
                </span>
                <span className="topic-index">{topic.index}</span>
                <h3>{topic.title}</h3>
                <p>{topic.description}</p>
                <span className="topic-cta">Abrir esta temática <span aria-hidden="true">↗</span></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="content-section" aria-labelledby="brabas-title">
          <div className="brabas-feature">
            <div>
              <span className="eyebrow">Seção em destaque</span>
              <h2 id="brabas-title">As Brabas</h2>
              <p>
                Acesse o acervo cartográfico do futebol feminino do Corinthians,
                com estádios, estatísticas e a temática da Libertadores.
              </p>
              <a className="button button-primary" href="/as-brabas/">
                Explorar As Brabas <span className="button-arrow" aria-hidden="true">↗</span>
              </a>
            </div>
            <div className="brabas-preview" aria-hidden="true">
              <Image
                src="/previews/brabas-libertadores.svg"
                alt=""
                width={800}
                height={420}
                loading="lazy"
                unoptimized
              />
            </div>
          </div>
        </section>

        <section className="about-band" aria-labelledby="about-title">
          <div className="content-section about-inner">
            <div>
              <span className="eyebrow">Sobre o projeto</span>
              <h2 id="about-title">Um acervo para ler a história no espaço.</h2>
            </div>
            <div className="about-copy">
              <p>
                O ATLAS1910 reúne informação histórica e geográfica em uma
                experiência cartográfica dedicada ao Sport Club Corinthians
                Paulista. As camadas do mapa organizam diferentes recortes do
                acervo e podem ser exploradas individualmente.
              </p>
              <p>
                O conteúdo inclui dados de estádios e partidas, mapas temáticos
                e referências associadas às feições. As páginas de cada camada
                indicam seus dados e fontes disponíveis.
              </p>
              <Link className="text-link" href="/acervo/">
                Como navegar pelo acervo <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
