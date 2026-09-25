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
        ativa: true,
        opacidade: 0.95
      }
    ]
  },

  /* ========================================================================
     2. HISTÓRIA & MEMÓRIA
     ======================================================================== */
  {
    id: "historia",
    nome: "História & Memória",
    cor: "#d4d4d8", // Platina
    camadas: [
      {
        id: "eventos_historicos",
        nome: "Eventos Históricos & Mobilizações (ex: Invasão de 1976)",
        arquivo: "data/historia/eventos_historicos.geojson",
        tipo: "ponto",
        forma: "diamante",
        icone: "assets/icones/bandeira.svg",
        tamanhoIcone: [24, 24],
        cor: "#c8aa6e",
        ativa: true,
        opacidade: 1.0
      },
      {
        id: "marcos_fundacao",
        nome: "Marcos da Fundação (1910)",
        arquivo: "data/historia/marcos_fundacao.geojson",
        tipo: "ponto",
        forma: "anel",
        icone: "assets/icones/pin_corinthians.svg",
        tamanhoIcone: [24, 24],
        cor: "#d4d4d8",
        ativa: false,
        opacidade: 1.0
      }
    ]
  }
];
