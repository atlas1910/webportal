/**
 * ==========================================================================
 * ATLAS1910 - CATÁLOGO DE TEMÁTICAS E CAMADAS
 * ==========================================================================
 */

const ATLAS_GEOJSON_BOUNDS_CACHE = new WeakMap();
let ATLAS_RENAMED_STADIUMS = [];
let atlasRenamedStadiumsPromise = null;

async function carregarHistoricoNomesEstadios() {
  if (!atlasRenamedStadiumsPromise) {
    atlasRenamedStadiumsPromise = fetch('data/estadio_name_history.json?v=20260928-renamed-stadiums-v1')
      .then(response => {
        if (!response.ok) throw new Error(`Status HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        ATLAS_RENAMED_STADIUMS = Array.isArray(data.stadiums) ? data.stadiums : [];
      })
      .catch(error => {
        atlasRenamedStadiumsPromise = null;
        console.warn('Aviso ao carregar histórico de nomes de estádios:', error.message);
      });
  }
  await atlasRenamedStadiumsPromise;
}

const ATLAS_CLUB_CRESTS = new Map([
  ['CORINTHIANS', 'assets/icones/escudos-historicos/2012.png'],
  ['SPORTCLUBCORINTHIANSPAULISTA', 'assets/icones/escudos-historicos/2012.png'],
  ['PALMEIRAS', 'assets/icones/escudos-clubes/palmeiras.png'],
  ['SOCIEDADEESPORTIVAPALMEIRAS', 'assets/icones/escudos-clubes/palmeiras.png'],
  ['SAOPAULO', 'assets/icones/escudos-clubes/sao-paulo.png'],
  ['SAOPAULOFUTEBOLCLUBE', 'assets/icones/escudos-clubes/sao-paulo.png'],
  ['SANTOS', 'assets/icones/escudos-clubes/santos.png'],
  ['SANTOSFUTEBOLCLUBE', 'assets/icones/escudos-clubes/santos.png'],
  ['PORTUGUESA', 'assets/icones/escudos-clubes/portuguesa.png'],
  ['ASSOCIACAOPORTUGUESADEDESPORTOS', 'assets/icones/escudos-clubes/portuguesa.png'],
  ['PORTUGUESADESPORTOS', 'assets/icones/escudos-clubes/portuguesa.png'],
  ['GUARANI', 'assets/icones/escudos-clubes/guarani.png'],
  ['GUARANIFUTEBOLCLUBE', 'assets/icones/escudos-clubes/guarani.png'],
  ['FLAMENGO', 'assets/icones/escudos-clubes/flamengo.png'],
  ['CLUBEDEREGATASDOFLAMENGO', 'assets/icones/escudos-clubes/flamengo.png'],
  ['PONTEPRETA', 'assets/icones/escudos-clubes/ponte-preta.png'],
  ['ASSOCIACAOATLETICAPONTEPRETA', 'assets/icones/escudos-clubes/ponte-preta.png'],
  ['FLUMINENSE', 'assets/icones/escudos-clubes/fluminense.png'],
  ['FLUMINENSEFOOTBALLCLUB', 'assets/icones/escudos-clubes/fluminense.png'],
  ['INTERNACIONAL', 'assets/icones/escudos-clubes/internacional.png'],
  ['SPORTCLUBINTERNACIONAL', 'assets/icones/escudos-clubes/internacional.png'],
  ['BAHIA', 'assets/icones/escudos-clubes/bahia.png'],
  ['ESPORTECLUBEBAHIA', 'assets/icones/escudos-clubes/bahia.png'],
  ['ATHLETICOPARANAENSE', 'https://a.espncdn.com/i/teamlogos/soccer/500/3458.png'],
  ['VITORIA', 'https://a.espncdn.com/i/teamlogos/soccer/500/3457.png'],
  ['MIRASSOL', 'https://a.espncdn.com/i/teamlogos/soccer/500/9169.png'],
  ['REMO', 'https://a.espncdn.com/i/teamlogos/soccer/500/4936.png'],
  ['VASCO', 'https://assets.football-logos.cc/logos/brazil/700x700/vasco-da-gama.78b15337.png'],
  ['VASCODAGAMA', 'https://assets.football-logos.cc/logos/brazil/700x700/vasco-da-gama.78b15337.png'],
  ['FERROVIARIA', 'https://assets.football-logos.cc/logos/brazil/700x700/ferroviaria.ee71494b.png'],
  ['ASSOCIACAOFERROVIARIADEESPORTES', 'https://assets.football-logos.cc/logos/brazil/700x700/ferroviaria.ee71494b.png'],
  ['BOTAFOGO', 'https://assets.football-logos.cc/logos/brazil/700x700/botafogo.c4e2a3c5.png'],
  ['BOTAFOGOFR', 'https://assets.football-logos.cc/logos/brazil/700x700/botafogo.c4e2a3c5.png'],
  ['ATLETICOMG', 'https://assets.football-logos.cc/logos/brazil/700x700/atletico-mineiro.b23bb8a6.png'],
  ['ATLETICOMINEIRO', 'https://assets.football-logos.cc/logos/brazil/700x700/atletico-mineiro.b23bb8a6.png'],
  ['CAM', 'https://assets.football-logos.cc/logos/brazil/700x700/atletico-mineiro.b23bb8a6.png'],
  ['GREMIO', 'https://assets.football-logos.cc/logos/brazil/700x700/gremio.615cef98.png'],
  ['GREMIOFOOTBALLPORTOALEGRENSE', 'https://assets.football-logos.cc/logos/brazil/700x700/gremio.615cef98.png'],
  ['CRUZEIRO', 'https://assets.football-logos.cc/logos/brazil/700x700/cruzeiro.d6af93b5.png'],
  ['BOTAFOGOSP', 'https://assets.football-logos.cc/logos/brazil/700x700/botafogo-sp.5b7e8bb3.png'],
  ['BOTAFOGODERIBEIRAOPRETO', 'https://assets.football-logos.cc/logos/brazil/700x700/botafogo-sp.5b7e8bb3.png'],
  ['REDBULLBRAGANTINO', 'https://assets.football-logos.cc/logos/brazil/700x700/rb-bragantino.f30e620c.png'],
  ['RBBRAGANTINO', 'https://assets.football-logos.cc/logos/brazil/700x700/rb-bragantino.f30e620c.png'],
  ['CORITIBA', 'https://assets.football-logos.cc/logos/brazil/700x700/coritiba.c4a44bb1.png'],
  ['CHAPECOENSE', 'https://assets.football-logos.cc/logos/brazil/700x700/chapecoense.f3a627ab.png'],
  ['ATLETICOGO', 'https://assets.football-logos.cc/logos/brazil/700x700/atletico-goianiense.bddac467.png'],
  ['ATLETICOGOIANIENSE', 'https://assets.football-logos.cc/logos/brazil/700x700/atletico-goianiense.bddac467.png'],
  ['AVAI', 'https://assets.football-logos.cc/logos/brazil/700x700/avai.61137d55.png'],
  ['CEARA', 'https://assets.football-logos.cc/logos/brazil/700x700/ceara.76058858.png'],
  ['CRICIUMA', 'https://assets.football-logos.cc/logos/brazil/700x700/criciuma.f359fd14.png'],
  ['CUIABA', 'https://assets.football-logos.cc/logos/brazil/700x700/cuiaba.b1490990.png'],
  ['FORTALEZA', 'https://assets.football-logos.cc/logos/brazil/700x700/fortaleza.b0aa0e9c.png'],
  ['GOIAS', 'https://assets.football-logos.cc/logos/brazil/700x700/goias.737efc88.png'],
  ['LONDRINA', 'https://assets.football-logos.cc/logos/brazil/700x700/londrina.87afbee1.png'],
  ['JUVENTUDE', 'https://assets.football-logos.cc/logos/brazil/700x700/juventude.5cee27ae.png'],
  ['NAUTICO', 'https://assets.football-logos.cc/logos/brazil/700x700/nautico.b6200943.png']
]);

function obterMiniaturaClube(nome) {
  const normalized = String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  const words = String(nome || '').trim().toUpperCase().split(/\s+/)
    .filter(word => word.length > 2 && !['CLUBE', 'FOOTBALL', 'FUTEBOL', 'DE', 'DA', 'DO'].includes(word));

  return {
    src: ATLAS_CLUB_CRESTS.get(normalized) || (normalized.includes('CORINTHIANS') ? ATLAS_CLUB_CRESTS.get('CORINTHIANS') : ''),
    initials: words.slice(0, 2).map(word => word[0]).join('') || '?'
  };
}

function obterLimitesFeatureGeoJSON(feature) {
  if (ATLAS_GEOJSON_BOUNDS_CACHE.has(feature)) return ATLAS_GEOJSON_BOUNDS_CACHE.get(feature);

  const bounds = L.latLngBounds();
  const visitarCoordenadas = coordinates => {
    if (!Array.isArray(coordinates)) return;
    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      bounds.extend([coordinates[1], coordinates[0]]);
      return;
    }
    coordinates.forEach(visitarCoordenadas);
  };
  const visitarGeometria = geometry => {
    if (!geometry) return;
    visitarCoordenadas(geometry.coordinates);
    if (geometry.geometries) geometry.geometries.forEach(visitarGeometria);
  };

  visitarGeometria(feature.geometry);
  ATLAS_GEOJSON_BOUNDS_CACHE.set(feature, bounds);
  return bounds;
}

function filtrarFeaturesGeoJSONVisiveis(features, viewportBounds) {
  return features.filter(feature => {
    const featureBounds = obterLimitesFeatureGeoJSON(feature);
    return featureBounds.isValid() && featureBounds.intersects(viewportBounds);
  });
}

function obterLimitesFeaturesGeoJSON(features) {
  const bounds = L.latLngBounds();
  features.forEach(feature => bounds.extend(obterLimitesFeatureGeoJSON(feature)));
  return bounds;
}

const ATLAS_JENKS_COLOR = '#ef4444';
function corComOpacidade(color, opacity) {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(String(color || ''));
  if (!match) return color;
  const [, red, green, blue] = match;
  return `rgba(${parseInt(red, 16)},${parseInt(green, 16)},${parseInt(blue, 16)},${opacity})`;
}

function obterEstiloManchaEstadio(theme, opacity = 1, color = '#ef4444', zoom = 9) {
  const zoomOpacityBoost = Math.min(0.12, Math.max(0, zoom - 9) * 0.04);
  return {
    fillColor: color,
    color,
    weight: 0.25,
    opacity: opacity * 0.55,
    fillOpacity: opacity * (0.28 + zoomOpacityBoost)
  };
}

function obterFatorEscalaJenks(zoom = 9) {
  return Math.max(0.7, Math.min(1.35, Math.pow(2, (zoom - 9) / 8)));
}

function obterRaioJenks(totalGames, layerConfig, zoom = 9) {
  const radii = layerConfig.jenksRadii || [6, 8, 10, 12, 14];
  const classIndex = classeJenks(Number(totalGames) || 0, layerConfig.intervalosJenks || []);
  return (radii[classIndex] || radii[0]) * obterFatorEscalaJenks(zoom);
}

function obterCorRota(layerConfig, theme) {
  return layerConfig.routeThemeColors?.[theme] || layerConfig.cor;
}

function criarLegendaCamada(layer, theme, zoom) {
  const config = layer.config || {};
  const section = document.createElement('section');
  section.className = 'jenks-legend-section';
  const color = (config.routeFeatures ? obterCorRota(config, theme) : config.cor)
    || layer.themeColor
    || '#6b7280';
  const items = document.createElement('div');
  items.className = 'layer-legend-items';
  const row = document.createElement('div');
  row.className = 'layer-legend-item';
  const configuredShape = String(config.legenda?.symbol || config.forma || config.tipo || '').toLowerCase();
  const symbolKind = config.fronteiraPais || config.routeFeatures || ['linha', 'line'].includes(configuredShape)
    ? 'line'
    : config.classificacao === 'jenks' || ['ponto', 'point', 'circulo', 'circle', ''].includes(configuredShape)
      ? 'point'
      : ['anel', 'ring'].includes(configuredShape)
        ? 'ring'
        : ['diamante', 'diamond'].includes(configuredShape)
          ? 'diamond'
          : 'polygon';
  const iconPath = config.classificacao === 'jenks'
    ? null
    : config.iconeDark && config.iconeLight
      ? (theme === 'light' ? config.iconeLight : config.iconeDark)
      : config.icone;
  const symbol = iconPath ? document.createElement('img') : document.createElement('span');
  symbol.className = `layer-legend-symbol is-${iconPath ? 'icon' : symbolKind}`;
  if (iconPath) {
    symbol.src = iconPath;
    symbol.alt = '';
    symbol.setAttribute('aria-hidden', 'true');
  } else {
    symbol.style.setProperty('--legend-color', color);
    symbol.style.setProperty('--legend-fill', color);
    symbol.style.setProperty('--legend-border', color);
  }
  const label = document.createElement('span');
  label.className = 'layer-legend-label';
  label.textContent = config.nome || 'Camada sem nome';
  row.append(symbol, label);
  items.appendChild(row);
  section.appendChild(items);
  return section;
}

function recolherControlesAoClicarMapa() {
  const filterButton = document.getElementById('btn-map-filter-toggle');
  if (filterButton && filterButton.getAttribute('aria-expanded') === 'true') filterButton.click();

  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  if (window.innerWidth <= 820) {
    if (!sidebar.classList.contains('mobile-hidden')) {
      document.getElementById('btn-mobile-close')?.click();
    }
    return;
  }
  if (!sidebar.classList.contains('collapsed')) {
    document.getElementById('btn-sidebar-collapse')?.click();
  }
}

const ATLAS_BRASILEIRAO_2026_ROUTES_GROUP = 'Campeonato Brasileiro 2026';
const ATLAS_BRASILEIRAO_2026_ROUTE_FILE_VERSION = '20260929-caravanas-v3';
const ATLAS_BRASILEIRAO_2026_ROUTE_LAYERS = [
  ...[
    ['arena-da-baixada', 'Athletico Paranaense - Arena da Baixada', '#c8102e', '2026-02-19', false],
    ['vila-belmiro', 'Santos - Vila Belmiro', '#111111', '2026-03-15', false, { dark: '#f8fafc', light: '#111111' }],
    ['arena-conda', 'Chapecoense - Arena Condá', '#111111', '2026-03-19', false, { dark: '#f8fafc', light: '#111111' }],
    ['barradao', 'Vitória - Barradão', '#e31b23', '2026-04-18', false],
    ['mirassol', 'Mirassol - Campos Maia', '#f2c500', '2026-05-03', false],
    ['engenhao', 'Botafogo - Engenhão', '#111111', '2026-05-17', false, { dark: '#f8fafc', light: '#111111' }],
    ['arena-fonte-nova', 'Bahia - Arena Fonte Nova', '#0060a9', '2026-07-26', false],
    ['braganca-paulista', 'Red Bull Bragantino - Bragança Paulista', '#d71920', '2026-08-09', false],
    ['couto-pereira', 'Coritiba - Couto Pereira', '#111111', '2026-08-23', false, { dark: '#f8fafc', light: '#111111' }],
    ['arena-mrv', 'Atlético-MG - Arena MRV', '#111111', null, true, { dark: '#f8fafc', light: '#111111' }],
    ['beira-rio', 'Internacional - Beira-Rio', '#c8102e', null, true],
    ['mangueirao', 'Remo - Mangueirão', '#003b7a', null, true],
    ['sao-januario', 'Vasco - São Januário', '#111111', null, true, { dark: '#f8fafc', light: '#111111' }]
  ].map(([routeId, name, color, matchDate, projected, routeThemeColors]) => ({
    id: `deslocamento-2026-${routeId}`,
    nome: name,
    arquivo: `data/deslocamentos/brasileirao-2026/${routeId}.geojson?v=${ATLAS_BRASILEIRAO_2026_ROUTE_FILE_VERSION}`,
    tipo: 'linha',
    grupo: ATLAS_BRASILEIRAO_2026_ROUTES_GROUP,
    grupoRecolhido: true,
    categoria: 'deslocamento',
    routeFeatures: true,
    projectedRoute: projected,
    dataJogo: matchDate,
    opacidade: 0.9,
    permitirCamadasSimultaneas: true,
    ativa: false,
    cor: color,
    routeThemeColors,
    legenda: { symbol: 'line', color }
  }))
];

const CATALOGO_TEMAS = [
  /* ========================================================================
     1. ESTÁDIOS
     ======================================================================== */
  {
    id: "estadios",
    nome: "Estádios",
    cor: "#7c3aed",
    camadas: [
      {
        id: "estadios_corinthians_localizacoes",
        shareId: "11e76d4b2ced",
        nome: "Estádios históricos do Corinthians",
        grupo: "Estádios do Corinthians",
        recorteEstadios: "corinthians",
        categoria: "localizacoes",
        arquivo: "data/estadios/estadios_estatisticas_unificadas.geojson?v=20260929-qgis-export-v4",
        tipo: "ponto",
        icone: "assets/icones/escudos-historicos/2012.png",
        escudosHistoricos: true,
        estatisticasIncorporadas: true,
        tamanhoIcone: [24, 24],
        cor: "#a855f7",
        ativa: false,
        opacidade: 1.0,
        permitirCamadasSimultaneas: true,
        historico: true,
        jenksRadii: [6, 8, 10, 12, 14],
        classificacao: "jenks"
      },
      {
        id: "outros_estadios_historia",
        shareId: "5bdcda72424a",
        nome: "História",
        grupo: "Outros times",
        recorteEstadios: "outros",
        categoria: "historia",
        arquivo: "data/estadios/estadios_estatisticas_unificadas.geojson?v=20260929-qgis-export-v4",
        tipo: "ponto",
        icone: "assets/icones/escudos-historicos/2012.png",
        escudosHistoricos: true,
        tamanhoIcone: [24, 24],
        cor: "#ffffff",
        ativa: false,
        opacidade: 1,
        permitirCamadasSimultaneas: true,
        historico: true
      },
      {
        id: "outros_estadios_estatisticas",
        shareId: "fe2b8c90d467",
        nome: "Estatística geral",
        grupo: "Outros times",
        recorteEstadios: "outros",
        categoria: "estatistica",
        arquivo: "data/estadios/estadios_estatisticas_unificadas.geojson?v=20260929-qgis-export-v4",
        tipo: "ponto",
        forma: "circulo",
        exibirSomentePontos: true,
        cor: ATLAS_JENKS_COLOR,
        ativa: false,
        opacidade: 1,
        permitirCamadasSimultaneas: true,
        classificacao: "jenks"
      },
      {
        id: "estadios_estatisticas_unificadas",
        shareId: "8d4c7fb29a16",
        nome: "Estatísticas em cada Estádio",
        grupo: "Estatísticas",
        categoria: "estatistica",
        arquivo: "data/estadios/estadios_estatisticas_unificadas.geojson?v=20260929-qgis-export-v4",
        tipo: "ponto",
        icone: "assets/icones/escudos-historicos/2012.png",
        escudosHistoricos: true,
        estatisticasIncorporadas: true,
        iconeSomenteCorinthians: true,
        exibirSomentePontos: true,
        somenteComEstatisticasPositivas: true,
        tamanhoIcone: [24, 24],
        cor: ATLAS_JENKS_COLOR,
        ativa: true,
        opacidade: 1,
        permitirCamadasSimultaneas: true,
        jenksRadii: [6, 8, 10, 12, 14],
        classificacao: "jenks"
      },
      {
        id: "paises_visitados_masculino",
        shareId: "b1f5a67dc11c",
        nome: "Países que o Corinthians já jogou",
        grupo: "Países que o Corinthians já jogou",
        grupoRecolhido: true,
        categoria: "fronteiras",
        arquivo: "data/basemap/paises_limites_masculino.geojson?v=20260930-country-bounds-v1",
        attribution: "&copy; <a href='https://whosonfirst.org/'>Who's On First</a>",
        fronteiraPais: true,
        cor: "#ef4444",
        ativa: true,
        opacidade: 1,
        permitirCamadasSimultaneas: true
      }
    ]
  },
  {
    id: "deslocamentos",
    nome: "Deslocamentos",
    cor: "#c8102e",
    camadas: ATLAS_BRASILEIRAO_2026_ROUTE_LAYERS
  },
  {
    id: "torcidas",
    nome: "Torcidas",
    cor: "#ef4444",
    camadas: [
      {
        id: "fiel_pelo_mundo",
        shareId: "7e29b461ac53",
        nome: "Núcleos da Fiel no exterior",
        grupo: "Fiel Pelo Mundo",
        grupoRecolhido: true,
        categoria: "torcida",
        arquivo: "data/torcidas/fiel_pelo_mundo.geojson?v=20260929-icons-v1",
        tipo: "ponto",
        icone: "assets/icones/pin_corinthians.svg",
        tamanhoIcone: [30, 30],
        cor: "#ef4444",
        ativa: false,
        opacidade: 1,
        permitirCamadasSimultaneas: true
      }
    ]
  },
];

const ESCUDOS_HISTORICOS_CORINTHIANS = {
  1910: {
    light: "assets/icones/escudos-historicos/CP-1910.png",
    dark: "assets/icones/escudos-historicos/CP-1910-BRANCO.png"
  },
  1914: "assets/icones/escudos-historicos/1914.png",
  1916: {
    early: "assets/icones/escudos-historicos/1916-A.png",
    mid: "assets/icones/escudos-historicos/1916-B.png",
    late: "assets/icones/escudos-historicos/1916-C.png",
    fallback: "assets/icones/escudos-historicos/1916 a 1919.png"
  },
  1917: "assets/icones/escudos-historicos/1916 a 1919.png",
  1918: "assets/icones/escudos-historicos/1916 a 1919.png",
  1919: "assets/icones/escudos-historicos/sc-corinthians-paulista-1919-1939-logo.png",
  1939: "assets/icones/escudos-historicos/SCCP-1939 a 1979.png",
  1991: "assets/icones/escudos-historicos/SCCP- 1991.png",
  1999: "assets/icones/escudos-historicos/SCCP- 1999.png",
  2000: "assets/icones/escudos-historicos/SCCP- 2000.png",
  "2000_mundial": "assets/icones/escudos-historicos/SCCP- 2000-mundial.png",
  2005: "assets/icones/escudos-historicos/SCCP- 2005.png",
  2012: "assets/icones/escudos-historicos/2012.png"
};

function resolverEscudoHistorico(properties, theme, fallback) {
  const date = String(properties && (properties.DATA_PRIMEIRA_PARTIDA_BRABAS || properties.DATA_PRIMEIRA_PARTIDA) || "");
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const year = Number(dateMatch
    ? dateMatch[1]
    : properties && (properties.ANO_PRIMEIRA_PARTIDA_BRABAS || properties.ANO_PRIMEIRA_PARTIDA));
  const month = dateMatch ? Number(dateMatch[2]) : null;

  if (year === 1910) {
    return theme === "light"
      ? ESCUDOS_HISTORICOS_CORINTHIANS[1910].light
      : ESCUDOS_HISTORICOS_CORINTHIANS[1910].dark;
  }
  if (year === 1914) return ESCUDOS_HISTORICOS_CORINTHIANS[1914];
  if (year === 1916) {
    if (month === null) return ESCUDOS_HISTORICOS_CORINTHIANS[1916].fallback;
    if (month <= 4) return ESCUDOS_HISTORICOS_CORINTHIANS[1916].early;
    if (month <= 8) return ESCUDOS_HISTORICOS_CORINTHIANS[1916].mid;
    return ESCUDOS_HISTORICOS_CORINTHIANS[1916].late;
  }
  if (year >= 1917 && year <= 1918) return ESCUDOS_HISTORICOS_CORINTHIANS[year];
  if (year >= 1919 && year <= 1938) return ESCUDOS_HISTORICOS_CORINTHIANS[1919];
  if (year >= 1939 && year <= 1979) return ESCUDOS_HISTORICOS_CORINTHIANS[1939];
  if (year >= 1991 && year <= 1998) return ESCUDOS_HISTORICOS_CORINTHIANS[1991];
  if (year === 1999) return ESCUDOS_HISTORICOS_CORINTHIANS[1999];
  if (year === 2000) {
    return month === 1
      ? ESCUDOS_HISTORICOS_CORINTHIANS["2000_mundial"]
      : ESCUDOS_HISTORICOS_CORINTHIANS[2000];
  }
  if (year >= 2012) return ESCUDOS_HISTORICOS_CORINTHIANS[2012];
  if (year >= 2005) return ESCUDOS_HISTORICOS_CORINTHIANS[2005];
  return fallback || null;
}

/* ==========================================================================
   CATÁLOGO DE TEMÁTICAS E CAMADAS - AS BRABAS
   Mesma lógica e uniformidade de recursos da Homepage
   ========================================================================== */
const CATALOGO_TEMAS_BRABAS = [
  {
    id: "estadios_brabas",
    nome: "Estádios",
    cor: "#c084fc", // Roxo Brabas
    camadas: [
      {
        id: "brabas_corinthians_localizacoes",
        shareId: "df67ecab0618",
        nome: "Estádios históricos do Corinthians",
        grupo: "Corinthians",
        recorteEstadios: "corinthians",
        categoria: "localizacoes",
        arquivo: "data/as_brabas/as_brabas_estadios_unificadas.geojson?v=20260929-qgis-export-v4",
        tipo: "ponto",
        historico: true,
        icone: "assets/icones/escudos-historicos/2012.png",
        escudosHistoricos: true,
        estatisticasIncorporadas: true,
        somenteComEstatisticasPositivas: true,
        tamanhoIcone: [24, 24],
        cor: ATLAS_JENKS_COLOR,
        ativa: false,
        opacidade: 1.0,
        permitirCamadasSimultaneas: true,
        jenksRadii: [6, 8, 10, 12, 14],
        classificacao: "jenks"
      },
      {
        id: "brabas_paises_visitados_feminino",
        shareId: "36d4c656fee1",
        nome: "Países que o Corinthians jogou",
        grupo: "Corinthians",
        categoria: "fronteiras",
        arquivo: "data/basemap/paises_limites_brabas.geojson?v=20260930-country-bounds-v1",
        attribution: "&copy; <a href='https://whosonfirst.org/'>Who's On First</a>",
        fronteiraPais: true,
        cor: "#a855f7",
        ativa: false,
        opacidade: 1,
        permitirCamadasSimultaneas: true
      },
      {
        id: "brabas_outros_historia",
        shareId: "4d1882104353",
        nome: "História",
        grupo: "Outros times",
        recorteEstadios: "outros",
        categoria: "historia",
        arquivo: "data/as_brabas/as_brabas_estadios_unificadas.geojson?v=20260929-qgis-export-v4",
        tipo: "ponto",
        iconeDark: "assets/icones/escudo_atual_mundo.png",
        iconeLight: "assets/icones/escudo_atual_mundo.png",
        icone: "assets/icones/escudo_atual_mundo.png",
        escudosHistoricos: true,
        tamanhoIcone: [20, 20],
        cor: "#ffffff",
        ativa: false,
        opacidade: 1,
        permitirCamadasSimultaneas: true,
        historico: true
      },
      {
        id: "brabas_outros_estatisticas",
        shareId: "4ff7aa65d52a",
        nome: "Estatística geral",
        grupo: "Outros times",
        recorteEstadios: "outros",
        categoria: "estatistica",
        arquivo: "data/as_brabas/as_brabas_estadios_unificadas.geojson?v=20260929-qgis-export-v4",
        tipo: "ponto",
        forma: "circulo",
        exibirSomentePontos: true,
        cor: "#a855f7",
        ativa: false,
        opacidade: 1,
        permitirCamadasSimultaneas: true,
        classificacao: "jenks"
      },
      {
        id: "brabas_estadios_estatisticas_unificadas",
        shareId: "a71c5be830df",
        nome: "Estatísticas em cada Estádio",
        grupo: "Estatísticas",
        categoria: "estatistica",
        arquivo: "data/as_brabas/as_brabas_estadios_unificadas.geojson?v=20260929-qgis-export-v4",
        tipo: "ponto",
        icone: "assets/icones/escudos-historicos/2012.png",
        escudosHistoricos: true,
        estatisticasIncorporadas: true,
        iconeSomenteCorinthians: true,
        somenteComEstatisticasPositivas: true,
        exibirSomentePontos: true,
        estatisticasConsolidadas: true,
        tamanhoIcone: [24, 24],
        cor: "#a855f7",
        ativa: true,
        opacidade: 1,
        permitirCamadasSimultaneas: true,
        jenksRadii: [6, 8, 10, 12, 14],
        classificacao: "jenks"
      }
    ]
  },
  {
    id: "competicoes_brabas",
    nome: "COMPETIÇÕES",
    cor: "#a855f7",
    camadas: [
      {
        id: "brabas_libertadores_2026",
        shareId: "libertadores-2026",
        nome: "2026",
        grupo: "Libertadores",
        categoria: "competicao",
        arquivo: "data/competicoes/libertadores-2026.geojson?v=20260930-crest-2012-v1",
        tipo: "ponto",
        competicao: true,
        iconePorFeature: "ESCUDO",
        tamanhoIcone: [20, 20],
        destaqueIcone: { campo: "Time", valor: "Corinthians", tamanho: [40, 40] },
        destaqueIconeZIndexOffset: 1000,
        cor: "#a855f7",
        ativa: false,
        opacidade: 1,
        permitirCamadasSimultaneas: true
      }
    ]
  }
];

const ESTADIOS_CORINTHIANS_HISTORICOS = [
  ["CAMPO DO LENHEIRO", "LENHEIRO"],
  ["PONTE GRANDE"],
  ["ALFREDO SCHURIG", "PARQUE SAO JORGE", "FAZENDINHA"],
  ["PACAEMBU"],
  ["ARENA CORINTHIANS", "NEO QUIMICA ARENA"]
];

function obterShareIdSolicitado() {
  const path = window.location.pathname;
  const pathMatch = /^\/camadas\/([^/]+)\/?$/.exec(path);
  if (pathMatch) return decodeURIComponent(pathMatch[1]).trim().toLowerCase();
  const brabasMatch = /^\/as-brabas\/camadas\/([^/]+)\/?$/.exec(path);
  if (brabasMatch) return decodeURIComponent(brabasMatch[1]).trim().toLowerCase();
  const searchParam = new URLSearchParams(window.location.search).get('camada');
  if (searchParam) return searchParam.trim().toLowerCase();
  const hashMatch = /#camada=([^&]+)/.exec(window.location.hash);
  if (hashMatch) return decodeURIComponent(hashMatch[1]).trim().toLowerCase();
  return null;
}

function obterSubgrupoShareIdSolicitado() {
  const searchParam = new URLSearchParams(window.location.search).get('subgrupo');
  return searchParam ? searchParam.trim().toLowerCase() : null;
}

function criarShareIdSubgrupo(themeId, groupName) {
  const trimmedGroupName = String(groupName).trim();
  const normalizedGroupName = /^(est[aá]dios\s+de\s+outros\s+times|outros\s+times|outros)$/i.test(trimmedGroupName)
    ? 'Outros times'
    : trimmedGroupName;
  const groupSlug = normalizedGroupName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${themeId}-${groupSlug}`;
}

function obterSubgrupoPorShareId(shareId) {
  if (!shareId) return null;
  const requestedId = String(shareId).trim().toLowerCase();
  const legacySubgroupIds = new Map([
    ['estadios-deslocamento-brasileirao-2026', 'deslocamentos-campeonato-brasileiro-2026'],
    ['estadios-corinthians', 'estadios-estadios-do-corinthians']
  ]);
  const targetId = legacySubgroupIds.get(requestedId) || requestedId;
  const catalogs = [
    { section: 'corinthians', themes: CATALOGO_TEMAS },
    { section: 'brabas', themes: CATALOGO_TEMAS_BRABAS }
  ];
  for (const catalog of catalogs) {
    for (const theme of catalog.themes) {
      const groups = new Map();
      theme.camadas.forEach(layer => {
        const groupName = String(layer.grupo || theme.nome || '').trim();
        if (!groups.has(groupName)) groups.set(groupName, []);
        groups.get(groupName).push(layer);
      });
      for (const [groupName, layers] of groups) {
        if (criarShareIdSubgrupo(theme.id, groupName) === targetId) {
          return { ...catalog, theme, groupName, layers };
        }
      }
    }
  }
  return null;
}

function obterCamadaPorShareId(shareId) {
  if (!shareId) return null;
  const targetId = String(shareId).trim().toLowerCase();
  const catalogs = [
    { section: 'corinthians', themes: CATALOGO_TEMAS },
    { section: 'brabas', themes: CATALOGO_TEMAS_BRABAS }
  ];
  for (const catalog of catalogs) {
    for (const theme of catalog.themes) {
      const layer = theme.camadas.find(candidate => (candidate.shareId || '').toLowerCase() === targetId);
      if (layer) return { ...catalog, theme, layer };
    }
  }
  return null;
}

async function copiarLinkSubgrupo(shareId) {
  const shareUrl = new URL('/', window.location.origin);
  shareUrl.searchParams.set('subgrupo', String(shareId).trim());
  const link = shareUrl.href;
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(link);
    return link;
  }

  const input = document.createElement('textarea');
  input.value = link;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('A cópia do link não foi permitida pelo navegador.');
  return link;
}

const DESCRICOES_ESTADIOS_CORINTHIANS = [
  {
    aliases: ["CAMPO DO LENHEIRO", "LENHEIRO"],
    resumo: "Campo de terra no Bom Retiro, na antiga Rua dos Imigrantes (atual Rua José Paulino), usado pelo Corinthians nos primeiros anos após a fundação. O clube registra ali a primeira vitória e o primeiro gol de sua história.",
    wikipedia: "https://pt.wikipedia.org/wiki/Campo_do_Lenheiro"
  },
  {
    aliases: ["PONTE GRANDE"],
    resumo: "Primeiro estádio do Corinthians, inaugurado em 17 de março de 1918 na região da Ponte Grande, próximo à área que hoje abriga o Centro Esportivo e de Lazer Tietê.",
    wikipedia: "https://pt.wikipedia.org/wiki/Est%C3%A1dio_da_Ponte_Grande"
  },
  {
    aliases: ["ALFREDO SCHURIG", "PARQUE SAO JORGE", "FAZENDINHA"],
    resumo: "O Estádio Alfredo Schürig (Fazendinha) integra o complexo social e esportivo do Corinthians. O acervo de partidas documenta a utilização do estádio pelo clube.",
    wikipedia: "https://pt.wikipedia.org/wiki/Est%C3%A1dio_Alfredo_Sch%C3%BCrig"
  },
  {
    aliases: ["PACAEMBU"],
    resumo: "Estádio municipal de São Paulo, oficialmente chamado Paulo Machado de Carvalho. O primeiro jogo do Corinthians registrado no local data de 1940.",
    wikipedia: "https://pt.wikipedia.org/wiki/Est%C3%A1dio_do_Pacaembu"
  },
  {
    aliases: ["ARENA CORINTHIANS", "NEO QUIMICA ARENA"],
    resumo: "Estádio do Corinthians em Itaquera, inaugurado em 2014 como Arena Corinthians e posteriormente denominado Neo Química Arena. Recebeu partidas da Copa do Mundo FIFA de 2014.",
    wikipedia: "https://pt.wikipedia.org/wiki/Neo_Qu%C3%ADmica_Arena"
  }
];

function normalizarNomeEstadio(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function formatarDataJogo(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : String(value || '');
}

function obterEmojiBandeiraPais(nomePais) {
  const codigoAlpha3 = resolverCodigoPais(nomePais);
  const codigosAlpha2 = {
    ARG: 'AR', BEL: 'BE', BIH: 'BA', BOL: 'BO', BRA: 'BR', CAN: 'CA',
    CHE: 'CH', CHL: 'CL', CHN: 'CN', COL: 'CO', CUW: 'CW', DNK: 'DK', ECU: 'EC',
    ESP: 'ES', GBR: 'GB', GRC: 'GR', GTM: 'GT', IDN: 'ID', JAM: 'JM', USA: 'US',
    FIN: 'FI', FRA: 'FR', NLD: 'NL', ITA: 'IT', JPN: 'JP', MAR: 'MA',
    MEX: 'MX', PAN: 'PA', PER: 'PE', PRT: 'PT', PRY: 'PY', SRB: 'RS',
    SWE: 'SE', THA: 'TH', TTO: 'TT', TUR: 'TR', URY: 'UY', VEN: 'VE', RUS: 'RU',
    DEU: 'DE'
  };
  const codigoAlpha2 = codigosAlpha2[codigoAlpha3];
  return codigoAlpha2
    ? [...codigoAlpha2].map(letter => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('')
    : '';
}

function formatarLocalizacaoEstadio(properties) {
  const city = properties && properties.CIDADE;
  const state = properties && (properties.ESTADO || properties['ESTADO/PROVÍNCIA']);
  const country = String(properties && (properties['PAÍS'] || properties.PAIS) || '').trim();
  const isBrazil = resolverCodigoPais(country) === 'BRA';
  const countryLabel = country && !isBrazil
    ? `${obterEmojiBandeiraPais(country)} ${country}`.trim()
    : '';
  const parts = [city, state, countryLabel]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, values) =>
      values.findIndex(candidate => normalizarNomeEstadio(candidate) === normalizarNomeEstadio(value)) === index
    );
  return parts.join(', ');
}

function formatarCapacidadeEstadio(properties) {
  const value = String(properties && properties.CAPACIDADE || '').replace(/\D/g, '');
  const capacity = Number(value);
  return capacity > 0
    ? `Capacidade: ${capacity.toLocaleString('pt-BR')} pessoas`
    : 'Capacidade: N/D';
}

function formatarEnderecoEstadio(properties) {
  const extrairEnderecoReal = value => {
    const text = String(value || '').trim();
    if (!text) return '';
    const partes = text.split(',').map(part => part.trim()).filter(Boolean);
    const rua = partes.find(part => /\b(?:rua|avenida|av\.|av|alameda|praça|travessa|estrada|rodovia|boulevard|blvd|logradouro|street|st\.|road|rd\.|calle)\b|^\d+\s/i.test(part));
    return rua || text;
  };

  const directAddress = [
    properties && (properties.ENDERECO || properties.ENDEREÇO || properties.ENDERECO_FORMATADO || properties.ENDERECO_REAL || properties['ENDEREÇO REAL']),
    properties && (properties.RUA || properties.LOGRADOURO || properties.RUA_ESTADIO || properties['RUA ESTADIO'] || properties['RUA ESTÁDIO']),
    properties && (properties.ENDERECO_ESTADIO || properties.ENDERECO_ESTD || properties['ENDEREÇO DO ESTÁDIO'] || properties['ENDEREÇO DO ESTADIO'])
  ].map(extrairEnderecoReal).filter(Boolean).find(value => /\b(?:rua|avenida|av\.|av|alameda|praça|travessa|estrada|rodovia|boulevard|blvd|logradouro|street|st\.|road|rd\.|calle)\b|\d/.test(value));

  if (directAddress) return directAddress;

  const city = properties && properties.CIDADE;
  const state = properties && (properties.ESTADO || properties['ESTADO/PROVÍNCIA']);
  const country = String(properties && (properties['PAÍS'] || properties.PAIS) || '').trim();
  const location = formatarLocalizacaoEstadio(properties);

  const geocodingAddress = properties && (properties.DISPONIBILIZA_ENDERECO || properties.DISPLAY_NAME || properties.display_name);
  if (geocodingAddress) return extrairEnderecoReal(geocodingAddress);

  const road = properties && (properties.ROAD || properties.RUA_DETALHE || properties.road);
  if (road) {
    return extrairEnderecoReal(road);
  }

  return location || 'Localização não informada';
}

function destacarCorinthiansEmTexto(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach(node => {
    if (!/\bcorinthians\b/i.test(node.textContent) || node.parentElement.closest('strong, .corinthians')) return;
    const fragment = document.createDocumentFragment();
    node.textContent.split(/(corinthians)/gi).forEach(part => {
      if (/^corinthians$/i.test(part)) {
        const strong = document.createElement('strong');
        strong.textContent = part;
        fragment.append(strong);
      } else {
        fragment.append(document.createTextNode(part));
      }
    });
    node.replaceWith(fragment);
  });
}

function obterNomesEstadio(properties) {
  const alternatives = properties && properties.NOMES_ALTERNATIVOS;
  const alternativeNames = Array.isArray(alternatives)
    ? alternatives
    : typeof alternatives === 'string'
      ? alternatives.split(/\s*[|;]\s*/)
      : [];
  const values = [
    properties && properties.ESTADIO,
    properties && properties['ESTÁDIO'],
    properties && properties['ESTÁDIO_ORIGINAL'],
    properties && properties.NOME_OFICIAL,
    properties && properties.Name,
    properties && properties.NOME_ANTIGO,
    properties && properties.NOME_ATUAL,
    properties && properties.NOME_ANTIGO_1,
    properties && properties.NOME_ANTIGO_2,
    ...alternativeNames
  ];
  return values.flat().filter(value => typeof value === 'string' && value.trim());
}

function agruparPontosCoincidentes(features) {
  const groups = new Map();
  const output = [];

  features.forEach(feature => {
    const geometry = feature.geometry || {};
    const coordinates = geometry.coordinates || [];
    if (geometry.type !== 'Point' || coordinates.length < 2) {
      output.push(feature);
      return;
    }

    const key = `${Number(coordinates[0]).toFixed(6)},${Number(coordinates[1]).toFixed(6)}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        feature: { ...feature, properties: { ...(feature.properties || {}) } },
        members: []
      };
      groups.set(key, group);
      output.push(group.feature);
    }
    group.members.push(feature.properties || {});
  });

  const metricAliases = [
    ['TOTAL_JOGOS'],
    ['VITORIAS', 'VITÓRIAS'],
    ['EMPATES'],
    ['DERROTAS'],
    ['GOLS_MARCADOS'],
    ['GOLS_SOFRIDOS']
  ];

  groups.forEach(({ feature, members }) => {
    if (members.length < 2) return;

    const properties = feature.properties;
    properties.ESTADIOS_AGRUPADOS = members.map(member => ({
      nome: member.ESTADIO || member['ESTÁDIO'] || member.NOME_OFICIAL || member.Name || 'Estádio',
      jogos: Number(member.TOTAL_JOGOS) || 0,
      vitorias: Number(member.VITORIAS ?? member['VITÓRIAS']) || 0,
      empates: Number(member.EMPATES) || 0,
      derrotas: Number(member.DERROTAS) || 0
    }));

    const names = [...new Set(members.flatMap(obterNomesEstadio))];
    const primaryName = properties.ESTADIO || properties['ESTÁDIO'] || properties.NOME_OFICIAL || properties.Name;
    properties.NOMES_ALTERNATIVOS = [...new Set([
      ...(Array.isArray(properties.NOMES_ALTERNATIVOS) ? properties.NOMES_ALTERNATIVOS : []),
      ...names.filter(name => name !== primaryName)
    ])];

    metricAliases.forEach(aliases => {
      const presentAliases = aliases.filter(alias => members.some(member => member[alias] !== undefined));
      if (!presentAliases.length) return;
      const total = members.reduce((sum, member) => {
        const value = aliases.map(alias => member[alias]).find(value => value !== undefined);
        return sum + (Number(value) || 0);
      }, 0);
      presentAliases.forEach(alias => { properties[alias] = total; });
    });
  });

  return output;
}

function criarTooltipEstatisticas(properties) {
  const container = document.createElement('div');
  container.className = 'atlas-stat-tooltip';
  let grouped = properties.ESTADIOS_AGRUPADOS;
  if (typeof grouped === 'string') {
    try {
      grouped = JSON.parse(grouped);
    } catch {
      grouped = null;
    }
  }
  if (!Array.isArray(grouped) || !grouped.length) grouped = [{
    nome: properties.ESTADIO || properties['ESTÁDIO'] || properties.NOME_OFICIAL || 'Estádio',
    jogos: Number(properties.TOTAL_JOGOS) || 0,
    vitorias: Number(properties.VITORIAS ?? properties['VITÓRIAS']) || 0,
    empates: Number(properties.EMPATES) || 0,
    derrotas: Number(properties.DERROTAS) || 0
  }];

  grouped.forEach(stadium => {
    const row = document.createElement('div');
    const gameLabel = stadium.jogos === 1 ? 'jogo' : 'jogos';
    row.textContent = `${stadium.nome}: ${stadium.jogos} ${gameLabel} (${stadium.vitorias}V ${stadium.empates}E ${stadium.derrotas}D)`;
    container.appendChild(row);
  });

  if (grouped.length > 1) {
    const total = document.createElement('strong');
    const totalGames = grouped.reduce((sum, stadium) => sum + stadium.jogos, 0);
    total.textContent = `Total no ponto: ${totalGames} ${totalGames === 1 ? 'jogo' : 'jogos'}`;
    container.appendChild(total);
  }

  return container;
}

function posicionarPreviaEstatisticasMapa(map, layer, preview) {
  const mapElement = map.getContainer();
  const mapBounds = mapElement.getBoundingClientRect();
  const mapSize = map.getSize();
  const point = layer.getLatLng ? map.latLngToContainerPoint(layer.getLatLng()) : null;
  if (!point) return;

  const width = preview.offsetWidth || Math.min(244, mapSize.x - 16);
  const height = preview.offsetHeight || 118;
  const margin = 8;
  const candidates = [
    [point.x + 16, point.y + 12],
    [point.x - width - 16, point.y + 12],
    [point.x + 16, point.y - height - 12],
    [point.x - width - 16, point.y - height - 12],
    [margin, margin],
    [mapSize.x - width - margin, margin],
    [margin, mapSize.y - height - margin],
    [mapSize.x - width - margin, mapSize.y - height - margin]
  ];
  for (let row = 0; row <= 4; row++) {
    for (let column = 0; column <= 4; column++) {
      candidates.push([
        margin + (mapSize.x - width - margin * 2) * column / 4,
        margin + (mapSize.y - height - margin * 2) * row / 4
      ]);
    }
  }
  const obstacles = [...document.querySelectorAll(
    '#sidebar:not(.mobile-hidden), .map-bottom-left-controls, .map-top-controls, .map-left-controls, .map-layer-controls, .btn-sidebar-expand, .attr-panel, #map-container .leaflet-control-container'
  )].filter(element => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }).map(element => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left - mapBounds.left,
      top: rect.top - mapBounds.top,
      right: rect.right - mapBounds.left,
      bottom: rect.bottom - mapBounds.top
    };
  });

  let best = null;
  candidates.forEach(([candidateLeft, candidateTop]) => {
    const left = Math.max(margin, Math.min(candidateLeft, mapSize.x - width - margin));
    const top = Math.max(margin, Math.min(candidateTop, mapSize.y - height - margin));
    const right = left + width;
    const bottom = top + height;
    const overlap = obstacles.reduce((area, obstacle) => {
      const overlapWidth = Math.max(0, Math.min(right, obstacle.right) - Math.max(left, obstacle.left));
      const overlapHeight = Math.max(0, Math.min(bottom, obstacle.bottom) - Math.max(top, obstacle.top));
      return area + overlapWidth * overlapHeight;
    }, 0);
    const distance = Math.hypot(left + width / 2 - point.x, top + height / 2 - point.y);
    const score = overlap ? 1000000000 + overlap * 1000 + distance : distance;
    if (!best || score < best.score) best = { left, top, score };
  });

  if (best) {
    preview.style.left = `${best.left}px`;
    preview.style.top = `${best.top}px`;
  }
}

function mostrarPreviaEstatisticasMapa(map, layer, properties, team = "Corinthians", onOpen = null) {
  if (!map || !layer || !properties) return;
  const touchPreview = typeof onOpen === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const escapePreviewText = value => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  let preview = map.getContainer().querySelector('.atlas-stat-preview');
  if (!preview) {
    preview = document.createElement('div');
    preview.className = 'atlas-stat-preview';
    map.getContainer().appendChild(preview);
  }
  preview.atlasMap = map;
  preview.atlasLayer = layer;
  if (!preview.atlasRepositionHandler) {
    preview.atlasRepositionHandler = () => posicionarPreviaEstatisticasMapa(
      preview.atlasMap,
      preview.atlasLayer,
      preview
    );
    map.on('moveend zoomend resize', preview.atlasRepositionHandler);
    window.addEventListener('resize', preview.atlasRepositionHandler, { passive: true });
  }
  if (!preview.atlasObstacleObserver) {
    preview.atlasObstacleObserver = new MutationObserver(() => {
      requestAnimationFrame(preview.atlasRepositionHandler);
    });
    document.querySelectorAll(
      '#sidebar, .map-bottom-left-controls, .map-top-controls, .map-left-controls, .map-layer-controls, .btn-sidebar-expand, .attr-panel'
    ).forEach(element => preview.atlasObstacleObserver.observe(element, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['class', 'style', 'open', 'hidden']
    }));
  }

  const stadiumName = properties.ESTADIO || properties['ESTÁDIO'] || properties.NOME_OFICIAL || 'Estádio';
  const values = [
    [Number(properties.TOTAL_JOGOS) || 0, 'jogos'],
    [Number(properties.VITORIAS ?? properties['VITÓRIAS']) || 0, 'vitórias'],
    [Number(properties.EMPATES) || 0, 'empates'],
    [Number(properties.DERROTAS) || 0, 'derrotas'],
    [Number(properties.GOLS_MARCADOS) || 0, 'gols pró'],
    [Number(properties.GOLS_SOFRIDOS) || 0, 'gols contra']
  ];
  const format = value => new Intl.NumberFormat('pt-BR').format(value);
  preview.classList.toggle('is-touch-preview', touchPreview);
  preview.innerHTML = `
    <div class="atlas-stat-preview-heading">
      <div>
        <div class="atlas-stat-preview-title">${escapePreviewText(stadiumName)}</div>
        <div class="atlas-stat-preview-subtitle">Estatísticas ${team === 'Brabas' ? 'das Brabas' : 'do Corinthians'}</div>
      </div>
      ${touchPreview ? '<button class="atlas-stat-preview-close" type="button" aria-label="Fechar prévia"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"></path></svg></button>' : ''}
    </div>
    <div class="atlas-stat-preview-metrics">
      ${values.map(([value, label]) => `<div><strong>${format(value)}</strong><span>${label}</span></div>`).join('')}
    </div>
    ${touchPreview ? '<button class="atlas-stat-preview-open" type="button">Ver partidas e detalhes</button>' : ''}`;
  if (touchPreview) {
    preview.querySelector('.atlas-stat-preview-close').onclick = event => {
      event.stopPropagation();
      ocultarPreviaEstatisticasMapa(map);
    };
    preview.querySelector('.atlas-stat-preview-open').onclick = event => {
      event.stopPropagation();
      ocultarPreviaEstatisticasMapa(map);
      onOpen();
    };
  }
  preview.hidden = false;
  posicionarPreviaEstatisticasMapa(map, layer, preview);
}

function ocultarPreviaEstatisticasMapa(map) {
  const preview = map && map.getContainer().querySelector('.atlas-stat-preview');
  if (preview) preview.hidden = true;
}

function nomesEstadioCorrespondem(nome, alias) {
  const normalizedName = normalizarNomeEstadio(nome);
  const normalizedAlias = normalizarNomeEstadio(alias);
  if (!normalizedName || !normalizedAlias) return false;
  if (normalizedName === normalizedAlias) return true;

  const ignoredTokens = new Set(['ESTADIO', 'ARENA', 'MUNICIPAL', 'STADIUM', 'DE', 'DA', 'DO', 'DAS', 'DOS', 'THE']);
  const getTokens = value => new Set(
    String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().match(/[A-Z0-9]+/g) || []
  );
  const aliasTokens = getTokens(alias);
  const sharedTokens = [...getTokens(nome)].filter(token =>
    !ignoredTokens.has(token) && aliasTokens.has(token)
  );
  if (sharedTokens.length >= 2) return true;
  return Math.min(normalizedName.length, normalizedAlias.length) >= 16
    && (normalizedName.includes(normalizedAlias) || normalizedAlias.includes(normalizedName));
}

function mesmoContextoEstadio(first, second) {
  const firstGroup = regraEstadioRenomeado(first);
  const secondGroup = regraEstadioRenomeado(second);
  if (firstGroup && secondGroup
    && normalizarNomeEstadio(firstGroup.current_name) === normalizarNomeEstadio(secondGroup.current_name)) return true;

  const firstProperties = first || {};
  const secondProperties = second || {};
  const firstCity = normalizarNomeEstadio(firstProperties.CIDADE || firstProperties.CIDADE_FONTE);
  const secondCity = normalizarNomeEstadio(secondProperties.CIDADE || secondProperties.CIDADE_FONTE);
  if (firstCity && secondCity && firstCity !== secondCity
    && !(Math.min(firstCity.length, secondCity.length) >= 6
      && (firstCity.includes(secondCity) || secondCity.includes(firstCity)))) return false;

  const firstCountry = resolverCodigoPais(firstProperties.PAIS_ISO3 || firstProperties.PAIS || firstProperties['PAÍS'] || firstProperties.PAIS_FONTE);
  const secondCountry = resolverCodigoPais(secondProperties.PAIS_ISO3 || secondProperties.PAIS || secondProperties['PAÍS'] || secondProperties.PAIS_FONTE);
  return !firstCountry || !secondCountry || firstCountry === secondCountry;
}

function regraEstadioRenomeado(value) {
  const names = (Array.isArray(value) ? value : typeof value === 'object' && value
    ? obterNomesEstadio(value)
    : [value]).filter(Boolean).map(normalizarNomeEstadio);
  return ATLAS_RENAMED_STADIUMS.find(group => {
    const aliases = [group.current_name, group.previous_name, ...(group.aliases || [])]
      .map(normalizarNomeEstadio)
      .filter(Boolean);
    return names.some(name => aliases.some(alias => nomesEstadioCorrespondem(name, alias)));
  }) || null;
}

function nomesExpandidosEstadio(properties) {
  const names = obterNomesEstadio(properties);
  const group = regraEstadioRenomeado(properties);
  return group
    ? [...new Set([...names, group.current_name, group.previous_name, ...(group.aliases || [])])]
    : names;
}

function obterEstadiosNoPonto(properties) {
  let grouped = properties && properties.ESTADIOS_AGRUPADOS;
  if (typeof grouped === 'string') {
    try {
      grouped = JSON.parse(grouped);
    } catch {
      grouped = null;
    }
  }
  if (!Array.isArray(grouped) || !grouped.length) {
    grouped = [{
      nome: properties && (properties.NOME_ATUAL || properties.ESTADIO || properties['ESTÁDIO'] || properties.Name) || 'Estádio',
      nomes_alternativos: properties && [properties.NOME_ANTIGO_1, properties.NOME_ANTIGO_2, properties.NOME_ANTIGO, properties.NOMES_ALTERNATIVOS].flat().filter(Boolean),
      cidade: properties && properties.CIDADE,
      estado: properties && properties.ESTADO,
      pais: properties && (properties['PAÍS'] || properties.PAIS),
      jogos: Number(properties && properties.TOTAL_JOGOS) || 0
    }];
  }
  return grouped.map(stadium => ({
    ...stadium,
    jogos: Number(stadium.jogos) || 0,
    nomes_alternativos: Array.isArray(stadium.nomes_alternativos)
      ? stadium.nomes_alternativos
      : typeof stadium.nomes_alternativos === 'string'
        ? stadium.nomes_alternativos.split(/\s*[|;]\s*/)
        : []
  }));
}

function resumirEstatisticasEstadios(features) {
  return features.reduce((totals, feature) => {
    const properties = feature.properties || {};
    totals.jogos += Number(properties.TOTAL_JOGOS) || 0;
    totals.vitorias += Number(properties.VITORIAS ?? properties['VITÓRIAS']) || 0;
    totals.empates += Number(properties.EMPATES) || 0;
    totals.derrotas += Number(properties.DERROTAS) || 0;
    totals.gols += Number(properties.GOLS_MARCADOS) || 0;
    return totals;
  }, { jogos: 0, vitorias: 0, empates: 0, derrotas: 0, gols: 0 });
}

function chaveIdentidadeEstadio(stadium) {
  const properties = {
    ESTADIO: stadium.nome || stadium.NOME_ATUAL || stadium.ESTADIO || stadium['ESTÁDIO'],
    NOMES_ALTERNATIVOS: stadium.nomes_alternativos || []
  };
  const group = regraEstadioRenomeado(properties);
  const name = normalizarNomeEstadio(group ? group.current_name : properties.ESTADIO);
  const city = normalizarNomeEstadio(stadium.cidade || stadium.CIDADE);
  const state = normalizarNomeEstadio(stadium.estado || stadium.ESTADO);
  const country = resolverCodigoPais(stadium.pais || stadium.PAÍS || stadium.PAIS) || '';
  return [name, city, state, country].join('|');
}

function obterNomeAntigoEstadio(properties) {
  return String(properties && properties.NOME_ANTIGO || regraEstadioRenomeado(properties)?.previous_name || '').trim();
}

function consolidarEstadiosRenomeados(features) {
  const unchanged = [];
  const renamed = new Map();

  features.forEach(feature => {
    const properties = feature.properties || {};
    const group = regraEstadioRenomeado(properties);
    if (!group) {
      unchanged.push(feature);
      return;
    }

    const key = normalizarNomeEstadio(group.current_name);
    const names = obterNomesEstadio(properties).map(normalizarNomeEstadio);
    const isCurrentName = names.some(name => nomesEstadioCorrespondem(name, key));
    let entry = renamed.get(key);
    if (!entry) {
      entry = { feature, properties: { ...properties }, aliases: new Set(), isCurrentName };
      renamed.set(key, entry);
    } else {
      Object.entries(properties).forEach(([property, value]) => {
        if ((entry.properties[property] === null || entry.properties[property] === undefined || entry.properties[property] === '')
          && value !== null && value !== undefined && value !== '') entry.properties[property] = value;
      });
      if (isCurrentName && !entry.isCurrentName) {
        entry.feature = feature;
        entry.isCurrentName = true;
      }
    }
    names.forEach(name => {
      if (name && name !== key) entry.aliases.add(name);
    });
  });

  const renamedFeatures = [...renamed.values()].map(entry => {
    const properties = { ...entry.properties };
    const group = regraEstadioRenomeado([properties.NOME_ANTIGO, ...entry.aliases, properties['ESTÁDIO'], properties.ESTADIO]);
    if (!group) return entry.feature;
    for (const key of ['ESTÁDIO', 'ESTADIO', 'Name', 'NOME_OFICIAL']) {
      if (key in properties) properties[key] = group.current_name;
    }
    properties['ESTÁDIO'] = group.current_name;
    properties.NOME_ANTIGO = group.previous_name;
    properties.FONTE_NOME_ANTIGO = (group.sources || [])[0] || properties.FONTE_NOME_ANTIGO || '';
    properties.NOMES_ALTERNATIVOS = [...new Set([
      ...(Array.isArray(properties.NOMES_ALTERNATIVOS) ? properties.NOMES_ALTERNATIVOS : []),
      ...entry.aliases,
      ...(group.aliases || []),
      group.previous_name
    ].filter(Boolean))];
    return { ...entry.feature, properties };
  });

  return [...unchanged, ...renamedFeatures];
}

function expandirNomesEstadioFiltro(nomes, gruposAdicionais = []) {
  const expandidos = new Set(
    [...nomes].map(normalizarNomeEstadio).filter(Boolean)
  );
  const grupos = [...ESTADIOS_CORINTHIANS_HISTORICOS, ...gruposAdicionais];
  const corresponde = (a, b) =>
    a === b || (Math.min(a.length, b.length) >= 8 && (a.includes(b) || b.includes(a)));

  grupos.forEach(grupo => {
    const aliases = grupo.map(normalizarNomeEstadio).filter(Boolean);
    if (aliases.some(alias =>
      [...expandidos].some(nome => corresponde(nome, alias))
    )) {
      aliases.forEach(alias => expandidos.add(alias));
    }
  });

  return expandidos;
}

function estadioCorrespondeNomesFiltro(properties, nomesAtivos, permitirCorrespondenciaParcial = false) {
  const propriedades = properties || {};
  const nomesFeicao = obterNomesEstadio(propriedades).map(normalizarNomeEstadio).filter(Boolean);
  if (!nomesFeicao.length) return false;

  return nomesFeicao.some(nomeFeicao =>
    [...nomesAtivos].some(nomeAtivo =>
      nomesEstadioCorrespondem(nomeFeicao, nomeAtivo)
    )
  );
}

function resolverCodigoPais(nome) {
  const normalized = String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  const aliases = {
    ALEMANHA: "DEU",
    ARGENTINA: "ARG",
    BELGICA: "BEL",
    BOLIVIA: "BOL",
    BOSNIAEHERZEGOVINA: "BIH",
    BRASIL: "BRA",
    CANADA: "CAN",
    CHILE: "CHL",
    CHINA: "CHN",
    CURACAO: "CUW",
    COLOMBIA: "COL",
    DINAMARCA: "DNK",
    EQUADOR: "ECU",
    ESPANHA: "ESP",
    HONGKONG: "HKG",
    ESTADOSUNIDOS: "USA",
    ESTADOSUNIDOSDAAMERICA: "USA",
    EUA: "USA",
    FINLANDIA: "FIN",
    FRANCA: "FRA",
    HOLANDA: "NLD",
    MACAU: "MAC",
    MACAUSAR: "MAC",
    PAISESBAIXOS: "NLD",
    PALESTINA: "PSE",
    RUSSIA: "RUS",
    GUATEMALA: "GTM",
    INGLATERRA: "GBR",
    REINOUNIDO: "GBR",
    ITALIA: "ITA",
    INDONESIA: "IDN",
    JAMAICA: "JAM",
    JAPAO: "JPN",
    MARROCOS: "MAR",
    MEXICO: "MEX",
    PANAMA: "PAN",
    PARAGUAI: "PRY",
    PERU: "PER",
    PORTUGAL: "PRT",
    GRECIA: "GRC",
    SERVIA: "SRB",
    SUECIA: "SWE",
    SUICA: "CHE",
    TAIWAN: "TWN",
    TAILANDIA: "THA",
    TRINIDADETOBAGO: "TTO",
    TURQUIA: "TUR",
    URUGUAI: "URY",
    VENEZUELA: "VEN"
  };
  return aliases[normalized] || null;
}

function filtrarLimitesPaises(features, statisticsFeatures) {
  const countryCodes = new Set();
  const unmatchedCountries = new Set();
  const countryCodesByName = new Map();

  features.forEach(feature => {
    const properties = feature.properties || {};
    const code = String(properties.ADM0_A3 || "").toUpperCase();
    if (!code) return;
    [properties.ADMIN, properties.NAME, properties.NAME_EN, properties.ISO_A2, code]
      .filter(Boolean)
      .forEach(name => countryCodesByName.set(normalizarNomeEstadio(name), code));
  });

  statisticsFeatures.forEach(feature => {
    const properties = feature.properties || {};
    const countryName = properties.PAIS || properties["PAÍS"] || properties.PAIS_FONTE || "";
    const resolvedWofCode = String(properties.PAIS_ISO3 || "").toUpperCase();
    if (!countryName && !resolvedWofCode) return;
    const normalizedName = normalizarNomeEstadio(countryName);
    const code = resolvedWofCode
      || resolverCodigoPais(countryName)
      || countryCodesByName.get(normalizedName);
    if (code) countryCodes.add(code);
    else unmatchedCountries.add(String(countryName));
  });

  if (unmatchedCountries.size) {
    console.warn("Países sem código cartográfico para desenhar limites:", [...unmatchedCountries]);
  }

  return features.filter(feature => countryCodes.has(String(feature.properties && feature.properties.ADM0_A3 || "")));
}

function filtrarFeaturesPaisesPorCodigos(features, countryCodes) {
  if (!countryCodes) return features;
  return features.filter(feature => countryCodes.has(
    String(feature.properties && feature.properties.ADM0_A3 || "")
  ));
}

function obterCodigosPaisesDasPartidas(games, stadiumFeatures, countryFeatures) {
  const countryCodes = new Set();
  const countryNames = new Map();
  countryFeatures.forEach(feature => {
    const properties = feature.properties || {};
    const code = String(properties.ADM0_A3 || "").toUpperCase();
    if (!code) return;
    [properties.ADMIN, properties.NAME, properties.NAME_EN, code].filter(Boolean).forEach(name => {
      countryNames.set(normalizarNomeEstadio(name), code);
    });
  });

  const resolveCountryCode = countryName => {
    const name = String(countryName || "").trim();
    if (!name) return null;
    return resolverCodigoPais(name)
      || countryNames.get(normalizarNomeEstadio(name))
      || (/^[A-Z]{3}$/i.test(name) ? name.toUpperCase() : null);
  };

  games.forEach(game => {
    const properties = game.properties || game;
    const competition = normalizarNomeEstadio(
      properties["COMPETIÇÃO"] || properties.COMPETICAO
    );
    const brazilianDomesticCompetition = [
      "COPADOBRASIL",
      "CAMPEONATOBRASILEIRO",
      "ROBERTAO",
      "TACABRASIL",
      "CAMPEONATOPAULISTA",
      "TORNEIORIOSAOPAULO"
    ].some(term => competition.includes(term));
    if (brazilianDomesticCompetition) {
      countryCodes.add("BRA");
      return;
    }

    const directCountry = properties.PAIS_ISO3
      || properties.PAIS_FONTE || properties.PAIS || properties["PAÍS"];
    const directCode = resolveCountryCode(directCountry);
    if (directCode) {
      countryCodes.add(directCode);
      return;
    }

    const gameNames = [
      properties["ESTÁDIO"], properties.ESTADIO, properties["ESTÁDIO_ORIGINAL"],
      properties["ESTÁDIO_DETALHE"], properties.ESTADIO_DETALHE
    ].filter(Boolean);
    if (!gameNames.length) return;

    const expandedNames = new Set();
    gameNames.forEach(name => {
      nomesExpandidosEstadio({ "ESTÁDIO": name }).forEach(alias => {
        expandedNames.add(normalizarNomeEstadio(alias));
      });
    });
    expandirNomesEstadioFiltro([...expandedNames]).forEach(alias => expandedNames.add(alias));

    const gameCity = normalizarNomeEstadio(properties.CIDADE_FONTE || properties.CIDADE);
    const matchingCodes = new Set();
    stadiumFeatures.forEach(feature => {
      const stadiumProperties = feature.properties || {};
      const stadiumNames = obterNomesEstadio(stadiumProperties).map(normalizarNomeEstadio);
      const nameMatches = stadiumNames.some(name => [...expandedNames].some(alias =>
        name === alias
        || (gameCity && Math.min(name.length, alias.length) >= 8
          && (name.includes(alias) || alias.includes(name)))
      ));
      if (!nameMatches) return;

      const stadiumCity = normalizarNomeEstadio(stadiumProperties.CIDADE || stadiumProperties.CIDADE_FONTE);
      if (gameCity && stadiumCity && gameCity !== stadiumCity
        && !(Math.min(gameCity.length, stadiumCity.length) >= 6
          && (gameCity.includes(stadiumCity) || stadiumCity.includes(gameCity)))) return;

      const code = resolveCountryCode(
        stadiumProperties.PAIS_ISO3
          || stadiumProperties.PAIS || stadiumProperties["PAÍS"] || stadiumProperties.PAIS_FONTE
      );
      if (code) matchingCodes.add(code);
    });

    if (matchingCodes.size === 1) countryCodes.add([...matchingCodes][0]);
  });

  return countryCodes;
}

function ehCompeticaoInternacional(properties) {
  const competition = normalizarNomeEstadio(properties && (
    properties["COMPETIÇÃO"] || properties.COMPETICAO
  ));
  if (!competition || competition.includes("AMISTOSO")) return false;
  const internationalTerms = [
    "LIBERTADORES", "MUNDIAL", "SULAMERICANA", "MERCOSUL", "MERCOSUR",
    "CONMEBOL", "FEIRADEHIDALGO", "RAMONDECARRANZA", "TORNEIOINTERNACIONAL",
    "INTERNACIONAL", "INTERNATIONAL", "INTERCONTINENTAL", "RECOPA",
    "INTERAMERICANA", "COPARIO", "FIFA", "TEAL", "ROSARIO"
  ];
  if (internationalTerms.some(term => competition.includes(term))) return true;

  const country = String(properties.PAIS_FONTE || properties.PAIS || properties["PAÍS"] || "").trim();
  if (!country) return false;
  const countryCode = resolverCodigoPais(country);
  if (countryCode) return countryCode !== "BRA";
  return !["BRASIL", "BRAZIL", "BRA"].includes(normalizarNomeEstadio(country));
}

function calcularPesoLimitePais(zoom) {
  return Math.min(2.3, Math.max(0.8, 1.2 + (8 - zoom) * 0.12));
}

function criarIconeLocalizacaoEstatistica(properties, layerConfig, theme) {
  const games = Number(properties && properties.TOTAL_JOGOS) || 0;
  const jenksClass = classeJenks(games, layerConfig.intervalosJenks || []);
  const radii = layerConfig.jenksRadii || [6, 8, 10, 12, 14];
  const radius = radii[jenksClass] || radii[0];
  const diameter = Math.round(radius * 2);
  const crest = resolverEscudoHistorico(properties || {}, theme, layerConfig.icone);
  const imageUrl = encodeURI(String(crest || layerConfig.icone || ""))
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const color = layerConfig.cor || ATLAS_JENKS_COLOR;
  const border = corComOpacidade(color, 0.55);
  const markerColor = corComOpacidade(color, 0.28);
  const imageSize = Math.min(22, diameter - 6);
  const html = `
    <div style="width:${diameter}px;height:${diameter}px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border:0.45px solid ${border};border-radius:50%;background:${markerColor};box-shadow:0 1px 4px rgba(0,0,0,.22);">
      <img src="${imageUrl}" alt="" style="width:${imageSize}px;height:${imageSize}px;object-fit:contain;">
    </div>
  `;

  return L.divIcon({
    className: "stadium-location-stat-icon",
    html,
    iconSize: [diameter, diameter],
    iconAnchor: [diameter / 2, diameter / 2],
    popupAnchor: [0, -diameter / 2]
  });
}

function criarResumoEstatisticasEstadio(properties, team = "Corinthians") {
  if (!properties || properties.ESTATISTICAS_INCORPORADAS !== true) return "";
  const numberFormat = new Intl.NumberFormat("pt-BR");
  const metrics = [
    ["TOTAL_JOGOS", "jogos"],
    ["VITORIAS", "vitórias", "VITÓRIAS"],
    ["EMPATES", "empates"],
    ["DERROTAS", "derrotas"],
    ["GOLS_MARCADOS", "gols pró"],
    ["GOLS_SOFRIDOS", "gols contra"]
  ];
  const values = metrics.map(([field, label, alternateField]) => {
    const value = Number(properties[field] ?? (alternateField && properties[alternateField])) || 0;
    return `<div class="metric"><span class="m-val">${numberFormat.format(value)}</span> <span class="m-lbl">${label}</span></div>`;
  }).join("");

  return `
    <div class="estadio-summary-card stadium-inline-stats">
      <div class="matches-list-title">Estatísticas ${team === "Brabas" ? "das Brabas" : "do Corinthians"} neste estádio</div>
      <div class="estadio-metrics-bar">${values}</div>
    </div>
  `;
}

function pertenceAoGrupoDeEstadios(feature, grupo) {
  const properties = feature.properties || {};
  const nomes = [
    properties.ESTADIO,
    properties["ESTÁDIO"],
    properties.NOME_OFICIAL,
    properties.Name
  ].map(normalizarNomeEstadio).filter(Boolean);
  const ehEstadioDoCorinthians = ESTADIOS_CORINTHIANS_HISTORICOS.some(aliases =>
    aliases.some(alias => {
      const nomeNormalizado = normalizarNomeEstadio(alias);
      return nomes.some(nome => nomeNormalizado === "PARQUESAOJORGE"
        ? nome === nomeNormalizado
        : nome.includes(nomeNormalizado));
    })
  );
  return grupo === "corinthians" ? ehEstadioDoCorinthians : !ehEstadioDoCorinthians;
}

function filtrarFeaturesEstadios(features, grupo) {
  const selected = features.filter(feature => pertenceAoGrupoDeEstadios(feature, grupo));
  if (grupo !== "corinthians") return selected;

  const uniqueFeatures = new Map();
  selected.forEach(feature => {
    const properties = feature.properties || {};
    const names = [
      properties.ESTADIO,
      properties["ESTÁDIO"],
      properties.NOME_OFICIAL,
      properties.Name
    ].map(normalizarNomeEstadio).filter(Boolean);
    const stadiumIndex = ESTADIOS_CORINTHIANS_HISTORICOS.findIndex(aliases =>
      aliases.some(alias => {
        const normalizedAlias = normalizarNomeEstadio(alias);
        return names.some(name => normalizedAlias === "PARQUESAOJORGE"
          ? name === normalizedAlias
          : name.includes(normalizedAlias));
      })
    );
    if (stadiumIndex < 0) return;

    const preferredName = stadiumIndex === 2 && names.some(name => name.includes("ALFREDOSCHURIG"));
    const previous = uniqueFeatures.get(stadiumIndex);
    const previousName = previous && [
      previous.properties.ESTADIO,
      previous.properties["ESTÁDIO"],
      previous.properties.NOME_OFICIAL,
      previous.properties.Name
    ].map(normalizarNomeEstadio).filter(Boolean);
    const previousIsPreferred = previousName && previousName.some(name => name.includes("ALFREDOSCHURIG"));
    if (!previous || (preferredName && !previousIsPreferred)) {
      uniqueFeatures.set(stadiumIndex, feature);
    }
  });
  return [...uniqueFeatures.values()];
}

function calcularIntervalosJenks(values, maximumClasses = 5) {
  const sorted = [...new Set(values.filter(Number.isFinite))].sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const classCount = Math.min(Math.max(1, maximumClasses), sorted.length);
  const lowerClassLimits = Array.from({ length: sorted.length + 1 }, () => Array(classCount + 1).fill(0));
  const variances = Array.from({ length: sorted.length + 1 }, () => Array(classCount + 1).fill(Infinity));
  variances[0][0] = 0;

  for (let end = 1; end <= sorted.length; end++) {
    let sum = 0;
    let sumSquares = 0;
    for (let start = end; start >= 1; start--) {
      const value = sorted[start - 1];
      sum += value;
      sumSquares += value * value;
      const count = end - start + 1;
      const withinClassVariance = sumSquares - (sum * sum) / count;

      if (start === 1) {
        lowerClassLimits[end][1] = 1;
        variances[end][1] = withinClassVariance;
        continue;
      }

      for (let classes = 2; classes <= classCount; classes++) {
        const previousVariance = variances[start - 1][classes - 1];
        const candidateVariance = previousVariance + withinClassVariance;
        if (candidateVariance < variances[end][classes]) {
          lowerClassLimits[end][classes] = start;
          variances[end][classes] = candidateVariance;
        }
      }
    }
  }

  const breaks = Array(classCount + 1);
  breaks[0] = sorted[0];
  breaks[classCount] = sorted[sorted.length - 1];
  let end = sorted.length;
  for (let classes = classCount; classes > 1; classes--) {
    const start = lowerClassLimits[end][classes];
    breaks[classes - 1] = sorted[start - 2];
    end = start - 1;
  }
  return breaks;
}

function classeJenks(value, breaks) {
  for (let index = 1; index < breaks.length; index++) {
    if (value <= breaks[index]) return index - 1;
  }
  return Math.max(0, breaks.length - 2);
}

function desenharLegendaJenks(
  container,
  breaks,
  color,
  markerRadii = [6, 8, 10, 12, 14],
  borderColor = "#09090b",
  iconUrl = null,
  zoom = 9
) {
  if (!container) return;
  if (breaks.length < 2) {
    container.hidden = true;
    return;
  }

  const numberFormat = new Intl.NumberFormat("pt-BR");
  const fillColor = corComOpacidade(color, 0.28);
  const legendBorderColor = corComOpacidade(borderColor, 0.55);
  const radiusScale = obterFatorEscalaJenks(zoom);
  container.innerHTML = `
    <div class="jenks-legend-title">Jogos por estádio</div>
    <div class="jenks-legend-note">Círculos maiores representam mais jogos.</div>
    <div class="jenks-legend-items">
      ${breaks.slice(1).map((upper, index) => {
        const lower = index === 0 ? breaks[0] : breaks[index] + 1;
        const radius = (markerRadii[index] || markerRadii[markerRadii.length - 1]) * radiusScale;
        const diameter = radius * 2;
        const imageSize = iconUrl ? Math.min(22, diameter - 6) : 0;
        return `
          <div class="jenks-legend-item">
            <span class="jenks-legend-circle${iconUrl ? " jenks-legend-circle-with-icon" : ""}" style="width:${diameter}px;height:${diameter}px;background:${fillColor};border-color:${legendBorderColor};--jenks-border-width:0.25px">${iconUrl ? `<img src="${encodeURI(iconUrl).replace(/"/g, "&quot;")}" alt="" style="width:${imageSize}px;height:${imageSize}px;object-fit:contain">` : ""}</span>
            <span>${numberFormat.format(lower)}–${numberFormat.format(upper)} jogos</span>
          </div>`;
      }).join("")}
    </div>
  `;
  container.hidden = false;
}
