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
        icone: "assets/icones/escudo_corinthians.png",
        tamanhoIcone: [24, 24],
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
        icone: "assets/icones/escudo_corinthians.png",
        tamanhoIcone: [20, 20],
        cor: "#ffffff",
        ativa: true,
        opacidade: 0.95
      }
    ]
  },

  /* ========================================================================
     2. HISTÓRIA
     ======================================================================== */
  {
    id: "historia",
    nome: "História",
    cor: "#d4d4d8", // Platina
    camadas: [
      {
        id: "marcos_historicos_1910",
        nome: "Marcos da Fundação & Memória (1910)",
        arquivo: "data/historia/marcos_historicos.geojson",
        tipo: "ponto",
        forma: "anel",
        icone: "assets/icones/escudo_corinthians.png",
        tamanhoIcone: [20, 20],
        cor: "#d4d4d8",
        ativa: true,
        opacidade: 1.0
      }
    ]
  }
];
