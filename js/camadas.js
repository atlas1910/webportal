/**
 * ==========================================================================
 * ATLAS1910 — CATÁLOGO DE TEMÁTICAS E CAMADAS
 * ==========================================================================
 * 
 * COMO ADICIONAR UMA NOVA CAMADA EXPORTADA DO QGIS:
 * 1. Exporte a camada no QGIS como "GeoJSON" (com SRC em EPSG:4326 - WGS 84).
 * 2. Salve o arquivo na pasta 'data/' (ex: 'data/torcidas/minha_camada.geojson').
 * 3. Copie um dos blocos abaixo e cole no tema desejado.
 */

const CATALOGO_TEMAS = [
  {
    id: "torcidas",
    nome: "Torcidas Organizadas & Movimentos",
    cor: "#ffffff",
    camadas: [
      {
        id: "camisa12_subsedes",
        nome: "Camisa 12 — Sedes e Subsedes",
        arquivo: "data/torcidas/camisa12_subsedes.geojson",
        tipo: "ponto",
        forma: "circulo", // 'circulo', 'diamante', 'anel'
        cor: "#ffffff",
        ativa: true,
        opacidade: 1.0
      }
      /* EXEMPLO PARA ADICIONAR PRÓXIMA CAMADA:
      ,
      {
        id: "gavioes_subsedes",
        nome: "Gaviões da Fiel — Subsedes",
        arquivo: "data/torcidas/gavioes_subsedes.geojson",
        tipo: "ponto",
        forma: "circulo",
        cor: "#e4e4e7",
        ativa: true,
        opacidade: 1.0
      }
      */
    ]
  },

  {
    id: "estadios",
    nome: "Estádios & Patrimônio Histórico",
    cor: "#c8aa6e", // Dourado
    camadas: [
      {
        id: "estadios_corinthians",
        nome: "Arenas & Sedes Históricas",
        arquivo: "data/estadios/estadios_paulistas.geojson",
        tipo: "ponto",
        forma: "diamante",
        cor: "#c8aa6e",
        ativa: true,
        opacidade: 1.0
      }
    ]
  },

  {
    id: "mobilidade",
    nome: "Mobilidade Urbana & Malha Ferroviária",
    cor: "#9ca3af",
    camadas: [
      {
        id: "linhas_metro",
        nome: "Linhas de Acesso aos Estádios (Metrô/CPTM)",
        arquivo: "data/ferrovia/linhas_metro_sp.geojson",
        tipo: "linha",
        cor: "#9ca3af",
        ativa: true,
        opacidade: 0.85
      }
    ]
  }

  /* EXEMPLO PARA CRIAR UM NOVO TEMA:
  ,
  {
    id: "memorabilia",
    nome: "Marcos Históricos na Cidade",
    cor: "#f59e0b",
    camadas: [
      {
        id: "pontos_fundacao",
        nome: "Bairro do Bom Retiro 1910",
        arquivo: "data/historia/fundacao.geojson",
        tipo: "ponto",
        forma: "anel",
        cor: "#f59e0b",
        ativa: true,
        opacidade: 1.0
      }
    ]
  }
  */
];
