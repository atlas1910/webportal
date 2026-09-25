/**
 * ==========================================================================
 * ATLAS1910 — CATÁLOGO DE TEMÁTICAS E CAMADAS
 * ==========================================================================
 * 
 * CATEGORIAS OFICIAIS:
 * 1. Torcida
 * 2. Estádios
 * 3. História
 * 
 * COMO USAR IMAGENS / ÍCONES PERSONALIZADOS (PNG, SVG, WebP):
 * - Opção 1 (Na camada toda): Adicione a propriedade:
 *     icone: "assets/icones/meu_icone.png",
 *     tamanhoIcone: [30, 30] // largura e altura em pixels
 * 
 * - Opção 2 (Um ícone diferente por ponto): No QGIS, crie uma coluna chamada
 *     'icone' na tabela de atributos e preencha com o caminho da imagem!
 */

const CATALOGO_TEMAS = [
  /* ========================================================================
     1. TORCIDA
     ======================================================================== */
  {
    id: "torcida",
    nome: "Torcida",
    cor: "#ffffff",
    camadas: [
      {
        id: "camisa12_subsedes",
        nome: "Camisa 12 — Sedes e Subsedes",
        arquivo: "data/torcida/camisa12_subsedes.geojson",
        tipo: "ponto",
        forma: "circulo", // 'circulo', 'diamante', 'anel'
        // Para usar imagem personalizada, basta descomentar as 2 linhas abaixo:
        // icone: "assets/icones/bandeira.svg",
        // tamanhoIcone: [28, 28],
        cor: "#ffffff",
        ativa: true,
        opacidade: 1.0
      }
      /* COLE SUAS PRÓXIMAS CAMADAS DE TORCIDA AQUI (ex: Gaviões, Pavilhão 9, etc.) */
    ]
  },

  /* ========================================================================
     2. ESTÁDIOS
     ======================================================================== */
  {
    id: "estadios",
    nome: "Estádios",
    cor: "#c8aa6e", // Dourado
    camadas: [
      {
        id: "estadios_arenas",
        nome: "Estádios & Arenas Históricas",
        arquivo: "data/estadios/estadios_paulistas.geojson",
        tipo: "ponto",
        forma: "diamante",
        // Para usar imagem personalizada de estádio, basta descomentar:
        // icone: "assets/icones/estadio.svg",
        // tamanhoIcone: [30, 30],
        cor: "#c8aa6e",
        ativa: true,
        opacidade: 1.0
      }
      /* COLE SUAS PRÓXIMAS CAMADAS DE ESTÁDIOS AQUI */
    ]
  },

  /* ========================================================================
     3. HISTÓRIA
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
        // Para usar o pin oficial do 1910, basta descomentar:
        // icone: "assets/icones/pin_corinthians.svg",
        // tamanhoIcone: [28, 28],
        cor: "#d4d4d8",
        ativa: true,
        opacidade: 1.0
      }
      /* COLE SUAS PRÓXIMAS CAMADAS DE HISTÓRIA AQUI */
    ]
  }
];
