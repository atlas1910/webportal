/**
 * ==========================================================================
 * ATLAS1910 — CATÁLOGO DE TEMÁTICAS E CAMADAS
 * ==========================================================================
 */

const CATALOGO_TEMAS = [
  /* ========================================================================
     1. ESTÁDIOS
     ======================================================================== */
  {
    id: "estadios",
    nome: "Estádios",
    cor: "#c8aa6e", // Dourado
    camadas: [
      {
        id: "estadios_mandante",
        nome: "Estádios que o Corinthians utilizou como mandante",
        arquivo: "data/estadios/estadios_mandante.geojson",
        tipo: "ponto",
        forma: "circulo",
        iconeDark: "assets/icones/icone_campo_dark.png",
        iconeLight: "assets/icones/icone_campo_light.png",
        icone: "assets/icones/icone_campo_dark.png",
        tamanhoIcone: [26, 26],
        cor: "#c8aa6e",
        ativa: true,
        opacidade: 1.0
      },
      {
        id: "estadios_mundo",
        nome: "Todos os Estádios que o Corinthians já jogou",
        arquivo: "data/estadios/estadios_mundo.geojson",
        tipo: "ponto",
        forma: "circulo",
        icone: "assets/icones/escudo_atual_mundo.png",
        tamanhoIcone: [20, 20],
        cor: "#ffffff",
        ativa: false,
        opacidade: 0.95
      }
    ]
  }
];

/* ==========================================================================
   CATÁLOGO DE TEMÁTICAS E CAMADAS — AS BRABAS
   Mesma lógica e uniformidade de recursos da Homepage
   ========================================================================== */
const CATALOGO_TEMAS_BRABAS = [
  {
    id: "estadios_brabas",
    nome: "Estádios das Brabas",
    cor: "#c084fc", // Roxo Brabas
    camadas: [
      {
        id: "brabas_estadios_mandante",
        nome: "Estádios que as Brabas utilizaram como mandante",
        arquivo: "data/as_brabas/as_brabas_estadios_mandante.geojson",
        tipo: "ponto",
        forma: "circulo",
        cor: "#c084fc",
        ativa: true,
        opacidade: 1.0
      },
      {
        id: "brabas_estadios_todos",
        nome: "Todos os Estádios percorridos pelas Brabas",
        arquivo: "data/as_brabas/as_brabas_estadios.geojson",
        tipo: "ponto",
        forma: "circulo",
        cor: "#d8b4fe",
        ativa: false,
        opacidade: 0.95
      }
    ]
  }
];
