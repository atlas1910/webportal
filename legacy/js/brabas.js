/**
 * ==========================================================================
 * ATLAS1910 - AS BRABAS (Futebol Feminino do Corinthians)
 * Módulo Especializado de Mapeamento, Estatísticas e Painel Histórico
 * Mesmos recursos, controles e lógica da Homepage
 * ==========================================================================
 */

(function() {
  'use strict';

  let map;
  let currentTheme = "dark";
  const loadedLayers = {}; // id -> { leafletLayer, data, count, config, themeId }
  let rawJogos = [];
  let rawEstadios = [];
  let brabasLayerStatistics = [];
  let brabasMatchesByStadium = new Map();
  let brabasDataPromise = null;
  let activeCompeticao = "todas";

  /* ==========================================================================
     UTILITÁRIO DE NORMALIZAÇÃO DE NOMES DE ESTÁDIO
     Garante 100% de correspondência entre jogos internacionais e estádios
     ========================================================================== */
  function normalizeStadiumName(str) {
    if (!str) return '';
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
  }

  function normalizeBrabasTeamName(name) {
    const normalized = normalizeStadiumName(name);
    if (normalized.includes('CORINTHIANS')) return 'CORINTHIANS';
    if (normalized.includes('GOTHAM')) return 'GOTHAMFC';
    return normalized;
  }

  function getBrabasCompetitionCategory(game) {
    if (game.COMPETICAO_FILTRO) return game.COMPETICAO_FILTRO;
    const competition = normalizeStadiumName(game['COMPETIÇÃO'] || game.COMPETICAO);
    if (competition.includes('COPADASCAMPEAS')) return 'COPA_DAS_CAMPEAS';
    if (competition.includes('COPAPAULISTA')) return 'COPA_PAULISTA';
    if (competition.includes('COPADOBRASIL')) return 'COPA_DO_BRASIL';
    if (competition.includes('LIBERTADORES')) return 'LIBERTADORES';
    if (competition.includes('BRASILEIRO') || competition.includes('BRASILEIRAO')) return 'BRASILEIRO';
    if (competition.includes('SUPERCOPA')) return 'SUPERCOPA';
    if (competition.includes('PAULISTA')) return 'PAULISTA';
    if (competition.includes('AMISTOSO')) return 'AMISTOSO';
    return ehCompeticaoInternacional(game) ? 'INTERNACIONAL' : 'OUTRAS';
  }

  function getBrabasMatchDeduplicationKey(game) {
    const date = normalizeStadiumName(game.DATA);
    const competitionName = normalizeStadiumName(game['COMPETIÇÃO']);
    const competition = competitionName.includes('COPADASCAMPEAS')
      ? 'COPADASCAMPEAS'
      : competitionName;
    const home = normalizeBrabasTeamName(game['TIME MANDANTE']);
    const away = normalizeBrabasTeamName(game['TIME VISITANTE']);
    const score = /^(\d+)\s*x\s*(\d+)$/i.exec(String(game.PLACAR || '').trim());
    const goalsHome = game['GOLS MANDANTE'] !== null && game['GOLS MANDANTE'] !== undefined && String(game['GOLS MANDANTE']).trim() !== ''
      ? Number(game['GOLS MANDANTE'])
      : score ? Number(score[1]) : NaN;
    const goalsAway = game['GOLS VISITANTE'] !== null && game['GOLS VISITANTE'] !== undefined && String(game['GOLS VISITANTE']).trim() !== ''
      ? Number(game['GOLS VISITANTE'])
      : score ? Number(score[2]) : NaN;

    if (date && competition && home && away && Number.isFinite(goalsHome) && Number.isFinite(goalsAway)) {
      const teamScores = [`${home}:${goalsHome}`, `${away}:${goalsAway}`].sort().join('|');
      return `${date}|${competition}|${teamScores}`;
    }
    return game.URL_FONTE || JSON.stringify(game);
  }

  function deduplicateBrabasMatches(matches) {
    const uniqueMatches = new Map();
    matches.forEach(game => {
      const key = getBrabasMatchDeduplicationKey(game);
      const existing = uniqueMatches.get(key);
      if (!existing) {
        uniqueMatches.set(key, game);
        return;
      }

      const gameHasSource = /^https:\/\/www\.meutimao\.com\.br\/jogo\//.test(game.URL_FONTE || '');
      const existingHasSource = /^https:\/\/www\.meutimao\.com\.br\/jogo\//.test(existing.URL_FONTE || '');
      const preferred = gameHasSource && !existingHasSource ? game : existing;
      const fallback = preferred === game ? existing : game;
      const merged = { ...fallback, ...preferred };
      Object.entries(fallback).forEach(([property, value]) => {
        if ((merged[property] === null || merged[property] === undefined || merged[property] === '')
          && value !== null && value !== undefined && value !== '') merged[property] = value;
      });
      uniqueMatches.set(key, merged);
    });
    return [...uniqueMatches.values()];
  }

  /* ==========================================================================
     1. INICIALIZAÇÃO
     ========================================================================== */
  async function init() {
       const requestedSubgroupId = obterSubgrupoShareIdSolicitado();
       const sharedSubgroup = requestedSubgroupId ? obterSubgrupoPorShareId(requestedSubgroupId) : null;
       const requestedShareId = requestedSubgroupId ? null : obterShareIdSolicitado();
    const skipLink = document.querySelector('.skip-link');
    if (skipLink) {
      const pageUrl = new URL(window.location.href);
      pageUrl.hash = 'map-container';
      skipLink.href = pageUrl.href;
    }
    const sharedLayer = requestedShareId ? obterCamadaPorShareId(requestedShareId) : null;
    if (requestedShareId && !sharedLayer) {
      console.warn("Camada compartilhada solicitada não encontrada no catálogo das Brabas:", requestedShareId);
    }
    if (requestedSubgroupId && !sharedSubgroup) {
      console.warn("Subgrupo compartilhado solicitado não encontrado no catálogo das Brabas:", requestedSubgroupId);
    }
    if (sharedLayer && sharedLayer.section !== 'brabas') {
      window.location.replace(`/camadas/${encodeURIComponent(requestedShareId)}`);
      return;
    }
    if (sharedSubgroup && sharedSubgroup.section !== 'brabas') {
      window.location.replace(`/?subgrupo=${encodeURIComponent(requestedSubgroupId)}`);
      return;
    }

    await carregarHistoricoNomesEstadios();

    const savedTheme = localStorage.getItem('atlas1910_brabas_theme') || "dark";
    applyTheme(savedTheme, false);

    // Mapa otimizado - desabilitando animações que causam descompasso entre tiles e camadas
    map = L.map('map', {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
      renderer: L.canvas({ tolerance: 0 }),
      zoomAnimation: false,      // Desabilita animação de zoom para sincronização perfeita
      markerZoomAnimation: false, // Evita descompasso entre tiles e camadas
      fadeAnimation: false,
      zoomSnap: 0.0625,
      zoomDelta: 1,
      wheelPxPerZoomLevel: 100,
      wheelDebounceTime: 40
    }).setView([-23.5505, -46.6333], 8);
    map.on('moveend atlas1910:beforeprojectionchange', atualizarFronteirasVisiveis);
    BasemapManager.constrainMapToSingleWorld(map);
    map.on('click', recolherControlesAoClicarMapa);
    map.on('zoomend', () => {
      updateCountryBoundaryWeights();
      updateStadiumSpotOpacity();
      updateJenksLegend();
    });

    BasemapManager.init(map, currentTheme);
    BasemapManager.setupMapNavigationControls(map);

    setupProtection();
    await loadAllCatalogLayers(requestedShareId, sharedSubgroup);
    renderThemesUI();
    if (brabasLayerStatistics.length) {
      renderBrabasStats();
    } else if (requestedShareId || sharedSubgroup) {
      const statsSection = document.getElementById('btn-numbers-open')?.closest('.sidebar-extra-section');
      if (statsSection) statsSection.hidden = true;
      const mapFilterPanel = document.getElementById('map-filter-panel');
      if (mapFilterPanel) mapFilterPanel.hidden = true;
    } else {
      renderBrabasStats();
    }
    setupEvents();
  }

  function setupProtection() {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
      }
    });
  }

  /* ==========================================================================
     2. CARREGAMENTO DOS DADOS (GEOJSON)
     ========================================================================== */
  function loadBrabasData() {
    if (!brabasDataPromise) {
      brabasDataPromise = (async () => {
        try {
          const response = await fetch('data/as_brabas/brabas_bootstrap.json?v=20260929-qgis-export-v3');
          if (!response.ok) throw new Error(`Status HTTP ${response.status}`);
          const bootstrap = await response.json();
          if (bootstrap.schema_version !== 3 || !Array.isArray(bootstrap.matches)) {
            throw new Error('Estrutura do pacote de inicialização inválida');
          }

          rawJogos = bootstrap.matches;
        } catch (err) {
          console.warn("Aviso ao carregar pacote das Brabas; usando o arquivo local de partidas:", err.message);
          const response = await fetch('data/as_brabas/as_brabas_jogos.geojson?v=20260928-brabas-export-v3');
          if (!response.ok) throw new Error(`Status HTTP ${response.status}`);
          const collection = await response.json();
          rawJogos = deduplicateBrabasMatches((collection.features || []).map(feature => feature.properties || {}));
        }
        brabasMatchesByStadium = buildBrabasMatchIndex(rawJogos);
      })().catch(error => {
        brabasDataPromise = null;
        throw error;
      });
    }
    return brabasDataPromise;
  }

  function getBrabasMatchesForLocation(properties) {
    const locationNames = nomesExpandidosEstadio(properties).map(normalizeStadiumName).filter(Boolean);
    const coreAliases = ESTADIOS_CORINTHIANS_HISTORICOS.find(aliases =>
      aliases.some(alias => {
        return locationNames.some(name => nomesEstadioCorrespondem(name, alias));
      })
    ) || [];
    const matchNames = new Set([
      ...locationNames,
      ...coreAliases.map(normalizeStadiumName)
    ]);
    const matches = new Set();
    brabasMatchesByStadium.forEach((games, gameName) => {
      const matchesLocation = [...matchNames].some(name => nomesEstadioCorrespondem(name, gameName));
      if (!matchesLocation) return;
      games.forEach(game => {
        if (mesmoContextoEstadio(properties, game)) matches.add(game);
      });
    });
    return [...matches].sort((a, b) => String(a.DATA || '').localeCompare(String(b.DATA || '')));
  }

  function buildBrabasMatchIndex(matches) {
    const index = new Map();
    matches.forEach(game => {
      const properties = {
        ESTADIO: game.ESTADIO,
        'ESTÁDIO': game['ESTÁDIO'],
        'ESTÁDIO_ORIGINAL': game['ESTÁDIO_ORIGINAL']
      };
      const names = new Set(
        nomesExpandidosEstadio(properties).map(normalizeStadiumName).filter(Boolean)
      );
      const coreAliases = ESTADIOS_CORINTHIANS_HISTORICOS.find(aliases =>
        aliases.some(alias => {
          return [...names].some(name => nomesEstadioCorrespondem(name, alias));
        })
      ) || [];
      coreAliases.forEach(alias => names.add(normalizeStadiumName(alias)));
      names.forEach(name => {
        if (!index.has(name)) index.set(name, []);
        index.get(name).push(game);
      });
    });
    return index;
  }

  function openBrabasStadiumDetails(properties, history = false) {
    loadBrabasData()
      .then(() => {
        if (history) {
          showBrabasStadiumHistory(properties);
          return;
        }
        showEstadioDetails(properties, getBrabasMatchesForLocation(properties));
      })
      .catch(error => {
        console.warn('Não foi possível carregar as partidas das Brabas:', error.message);
      });
  }

  /* ==========================================================================
     3. CARREGAMENTO DAS CAMADAS DO CATÁLOGO DAS BRABAS
     ========================================================================== */
  async function loadAllCatalogLayers(sharedShareId = null, sharedSubgroup = null) {
    if (typeof CATALOGO_TEMAS_BRABAS === 'undefined') {
      console.error("CATALOGO_TEMAS_BRABAS não definido em js/camadas.js");
      return;
    }

    const targetId = sharedShareId ? String(sharedShareId).trim().toLowerCase() : null;
    const sharedLayerIds = sharedSubgroup
      ? new Set(sharedSubgroup.layers.map(layer => layer.id))
      : null;
    const activeLayers = CATALOGO_TEMAS_BRABAS.flatMap(tema =>
      tema.camadas
        .filter(camada => targetId
          ? (camada.shareId || '').toLowerCase() === targetId
          : sharedLayerIds
            ? sharedLayerIds.has(camada.id)
            : camada.ativa)
        .map(camada => ({ tema, camada }))
    );
    await Promise.all(activeLayers.map(async ({ tema, camada }) => {
      try {
        const layer = await loadBrabasCatalogLayer(tema, camada);
        if (layer && (targetId || sharedLayerIds || camada.ativa)) layer.leafletLayer.addTo(map);
      } catch (err) {
        console.warn(`Aviso: Camada '${camada.nome}' (${camada.arquivo}) não pôde ser carregada:`, err.message);
      }
    }));
    if (sharedSubgroup) {
      const bounds = L.latLngBounds();
      sharedSubgroup.layers.forEach(camada => {
        const layer = loadedLayers[camada.id];
        if (!layer) return;
        if (camada.fronteiraPais) atualizarCamadaDeFronteirasNoViewport(layer);
        if (typeof layer.leafletLayer.getBounds !== 'function') return;
        const layerBounds = layer.leafletLayer.getBounds();
        if (layerBounds.isValid()) bounds.extend(layerBounds);
      });
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }

  async function loadBrabasCatalogLayer(tema, camada) {
    if (loadedLayers[camada.id]) return loadedLayers[camada.id];

    let geojson = null;
    if (camada.arquivo) {
      const response = await fetch(camada.arquivo);
      if (!response.ok) throw new Error(`Status HTTP ${response.status}`);
      geojson = await response.json();
    } else if (camada.dados) {
      geojson = camada.dados;
    }

    if (!geojson || !geojson.features) return null;
    if (camada.arquivo && camada.arquivo.includes('as_brabas_estadios_unificadas.geojson')) {
      brabasLayerStatistics = geojson.features;
      rawEstadios = geojson.features.filter(feature => feature.geometry?.type === 'Point');
    }
    if (camada.recorteEstadios) {
      geojson = { ...geojson, features: filtrarFeaturesEstadios(geojson.features, camada.recorteEstadios) };
    }
    if (camada.fronteiraPais && camada.arquivoPaisesOrigem) {
      const response = await fetch(camada.arquivoPaisesOrigem);
      if (!response.ok) throw new Error(`Status HTTP ${response.status}`);
      const countryCollection = await response.json();
      brabasLayerStatistics = countryCollection.features || [];
      rawEstadios = brabasLayerStatistics.filter(feature => feature.geometry?.type === 'Point');
      geojson = {
        ...geojson,
        features: filtrarLimitesPaises(geojson.features, countryCollection.features || [])
      };
    }
    if (camada.somenteComEstatisticasPositivas && !camada.estatisticasConsolidadas) {
      geojson.features = geojson.features.filter(feature =>
        Number(feature.properties && feature.properties.TOTAL_JOGOS) > 0
      );
    }
    if (camada.estatisticasConsolidadas) {
      brabasLayerStatistics = geojson.features;
      rawEstadios = geojson.features.filter(feature => feature.geometry?.type === 'Point');
    }
    const mapFeatures = geojson.features.filter(feature => {
      if (camada.exibirSomentePontos && (!feature.geometry || feature.geometry.type !== 'Point')) return false;
      if (camada.somenteComEstatisticasPositivas
        && !(Number(feature.properties && feature.properties.TOTAL_JOGOS) > 0)) return false;
      return true;
    });
    if (camada.classificacao === 'jenks') {
      camada.intervalosJenks = calcularIntervalosJenks(
        mapFeatures.map(feature => Number(feature.properties && feature.properties.TOTAL_JOGOS) || 0)
      );
    }

    const visibleFeatures = camada.fronteiraPais
      ? filtrarFeaturesGeoJSONVisiveis(mapFeatures, map.getBounds())
      : mapFeatures;
    const renderedFeatures = camada.classificacao === 'jenks'
      ? agruparPontosCoincidentes(visibleFeatures)
      : visibleFeatures;
    const renderData = renderedFeatures === geojson.features ? geojson : { ...geojson, features: renderedFeatures };
    const leafletLayer = buildBrabasLeafletLayer(renderData, camada, tema.cor);
    loadedLayers[camada.id] = {
      leafletLayer,
      data: geojson,
      renderedFeatures,
      fullBounds: camada.fronteiraPais ? obterLimitesFeaturesGeoJSON(geojson.features) : null,
      themeColor: tema.cor,
      count: mapFeatures.length,
      config: camada,
      themeId: tema.id
    };
    return loadedLayers[camada.id];
  }

  function findBrabasCatalogLayer(layerId) {
    for (const theme of CATALOGO_TEMAS_BRABAS) {
      const layer = theme.camadas.find(candidate => candidate.id === layerId);
      if (layer) return { theme, layer };
    }
    return null;
  }

  async function ensureBrabasLayerLoaded(layerId) {
    if (loadedLayers[layerId]) return loadedLayers[layerId];
    const catalogEntry = findBrabasCatalogLayer(layerId);
    if (!catalogEntry) return null;

    const { theme, layer } = catalogEntry;
    const loadedLayer = await loadBrabasCatalogLayer(theme, layer);
    return loadedLayer;
  }

  function buildBrabasLeafletLayer(geojson, layerConfig, themeColor) {
    const defaultColor = layerConfig.cor || themeColor || '#c084fc';
    const opacity = layerConfig.opacidade !== undefined ? layerConfig.opacidade : 1;

    return L.geoJSON(geojson, {
      attribution: layerConfig.attribution,
      pointToLayer: function(feature, latlng) {
        const p = feature.properties || {};
        const isStatisticsLayer = layerConfig.classificacao === 'jenks';

        const featureIconPath = layerConfig.iconePorFeature && p[layerConfig.iconePorFeature];
        if (featureIconPath) {
          const highlight = layerConfig.destaqueIcone;
          const highlighted = highlight && p[highlight.campo] === highlight.valor;
          const size = highlighted ? highlight.tamanho : layerConfig.tamanhoIcone || [20, 20];
          return L.marker(latlng, {
            icon: L.icon({
              iconUrl: featureIconPath,
              iconSize: size,
              iconAnchor: [size[0] / 2, size[1] / 2],
              popupAnchor: [0, -size[1] / 2],
              className: 'custom-image-marker'
            }),
            zIndexOffset: highlighted ? layerConfig.destaqueIconeZIndexOffset || 0 : 0,
            opacity: opacity
          });
        }

        if (layerConfig.estatisticasIncorporadas
          && (!layerConfig.iconeSomenteCorinthians || pertenceAoGrupoDeEstadios(feature, 'corinthians'))) {
          return L.marker(latlng, {
            icon: criarIconeLocalizacaoEstatistica(p, layerConfig, currentTheme),
            opacity: opacity
          });
        }

        if (layerConfig.escudosHistoricos && !isStatisticsLayer) {
          const iconPath = resolverEscudoHistorico(p, currentTheme, layerConfig.icone);
          const size = layerConfig.tamanhoIcone || [20, 20];
          return L.marker(latlng, {
            icon: L.icon({
              iconUrl: iconPath,
              iconSize: size,
              iconAnchor: [size[0] / 2, size[1] / 2],
              popupAnchor: [0, -size[1] / 2],
              className: 'custom-image-marker'
            }),
            opacity: opacity
          });
        }

        // Se a camada possui ícone customizado com suporte a variante dark/light
        if (!isStatisticsLayer && layerConfig.iconeDark && layerConfig.iconeLight) {
          const iconUrl = currentTheme === 'light' ? layerConfig.iconeLight : layerConfig.iconeDark;
          const size = layerConfig.tamanhoIcone || [20, 20];
          return L.marker(latlng, {
            icon: L.icon({
              iconUrl: iconUrl,
              iconSize: size,
              iconAnchor: [size[0] / 2, size[1] / 2],
              popupAnchor: [0, -size[1] / 2],
              className: 'custom-image-marker'
            }),
            opacity: opacity
          });
        }

        // Se a camada possui ícone customizado simples (sem variante de tema)
        if (!isStatisticsLayer && layerConfig.icone) {
          const size = layerConfig.tamanhoIcone || [20, 20];
          return L.marker(latlng, {
            icon: L.icon({
              iconUrl: layerConfig.icone,
              iconSize: size,
              iconAnchor: [size[0] / 2, size[1] / 2],
              popupAnchor: [0, -size[1] / 2],
              className: 'custom-image-marker'
            }),
            opacity: opacity
          });
        }

        const estNome = (p['ESTÁDIO'] || p['EST\ufffdDIO'] || '').trim().toUpperCase();
        
        // Se for a camada de estatísticas dinâmicas, calcula raio proporcional
        const radius = isStatisticsLayer
          ? obterRaioJenks(p.TOTAL_JOGOS || p['TOTAL_JOGOS'], layerConfig, map.getZoom())
          : 5;

        // Destaque para palcos históricos
        const isPrincipal = estNome.includes("FAZENDINHA") || estNome.includes("NEO QUÍMICA");
        const fillColor = isStatisticsLayer
          ? (layerConfig.cor || ATLAS_JENKS_COLOR)
          : (isPrincipal ? "#e879f9" : defaultColor);

        const circleStyle = isStatisticsLayer
          ? obterEstiloManchaEstadio(currentTheme, opacity, layerConfig.cor || ATLAS_JENKS_COLOR, map.getZoom())
          : {
            fillColor,
            color: currentTheme === 'dark' ? '#ffffff' : '#09090b',
            weight: 1.5,
            opacity,
            fillOpacity: opacity
          };
        return L.circleMarker(latlng, {
          radius,
          ...circleStyle,
          interactive: true,
          bubblingMouseEvents: false
        });
      },
      style: function() {
        if (layerConfig.fronteiraPais) {
          return {
            color: defaultColor,
            weight: calcularPesoLimitePais(map.getZoom()),
            opacity: opacity,
            fill: false,
            fillOpacity: 0,
            interactive: false
          };
        }
        return {
          color: defaultColor,
          weight: 3.5,
          opacity: opacity,
          fillColor: defaultColor,
          fillOpacity: 0.25 * opacity,
          dashArray: layerConfig.tipo === 'linha' ? '7, 5' : null
        };
      },
      onEachFeature: function(feature, layer) {
        if (layerConfig.competicao) {
          const p = feature.properties || {};
          const group = escapeHtml(p.Grupo || 'Sem grupo');
          const team = escapeHtml(p.Time || 'Equipe');
          const stadium = escapeHtml(p['Estádio'] || '');
          const city = [p.Cidade, p.País].filter(Boolean).map(escapeHtml).join(', ');
          const details = [
            `<strong>${team}</strong>`,
            `Grupo ${group}`,
            stadium,
            city
          ].filter(Boolean).join('<br>');
          layer.bindPopup(details);
          layer.bindTooltip(`${team} - Grupo ${group}`, { direction: 'top' });
          return;
        }
        if (layerConfig.classificacao === 'jenks' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
          layer.on('mouseover', () => mostrarPreviaEstatisticasMapa(map, layer, feature.properties || {}, 'Brabas'));
          layer.on('mouseout', () => ocultarPreviaEstatisticasMapa(map));
        }
        if (layerConfig.fronteiraPais) return;
        layer.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          const p = feature.properties || {};
          if (layerConfig.classificacao === 'jenks') {
            if (window.matchMedia('(pointer: coarse)').matches) {
              mostrarPreviaEstatisticasMapa(map, layer, p, 'Brabas', () => {
                openBrabasStadiumDetails(p);
              });
              return;
            }
            ocultarPreviaEstatisticasMapa(map);
            openBrabasStadiumDetails(p);
            return;
          }
          if (layerConfig.historico) {
            openBrabasStadiumDetails(p, true);
            return;
          }

          openBrabasStadiumDetails(p);
        });
      }
    });
  }

  /* ==========================================================================
     4. RENDERIZAÇÃO DA BARRA LATERAL (TEMAS & CAMADAS - MESMA LÓGICA DA HOME)
     ========================================================================== */
  function sanitizeGroupName(name) {
    if (!name) return '';
    const trimmed = String(name).trim();
    if (/^(est[aá]dios\s+de\s+outros\s+times|outros\s+times|outros)$/i.test(trimmed)) {
      return 'Outros times';
    }
    return trimmed;
  }

  function renderThemesUI() {
    const container = document.getElementById('theme-list');
    if (!container) return;

    container.innerHTML = '';
    let totalActive = 0;
    const updateHierarchy = () => {
      container.querySelectorAll('.theme-layer-root').forEach(themeRoot => {
        const activeIds = [];
        themeRoot.querySelectorAll('.layer-group').forEach(group => {
          const childIds = [...group.querySelectorAll('.layer-group-content input.layer-switch[data-layer-id]')]
            .filter(input => loadedLayers[input.dataset.layerId]
              && map.hasLayer(loadedLayers[input.dataset.layerId].leafletLayer))
            .map(input => input.dataset.layerId);
          const groupSwitch = group.querySelector('.group-layer-switch');
          if (groupSwitch) {
            groupSwitch.checked = childIds.length > 0;
            if (childIds.length) groupSwitch.dataset.restoreLayerIds = JSON.stringify(childIds);
          }
          activeIds.push(...childIds);
        });
        const themeSwitch = themeRoot.querySelector('.theme-group-switch');
        if (themeSwitch) {
          themeSwitch.checked = activeIds.length > 0;
          if (activeIds.length) themeSwitch.dataset.restoreLayerIds = JSON.stringify(activeIds);
        }
      });
      updateActiveCount();
      updateJenksLegend();
      applyFiltersToActiveLayers();
    };

    CATALOGO_TEMAS_BRABAS.forEach(tema => {
      if (!tema.camadas || tema.camadas.length === 0) return;

      const groups = new Map();
      const hiddenGroupNames = new Set(['Corinthians', 'Outros times']);
      tema.camadas.forEach(camada => {
        const groupName = sanitizeGroupName(camada.grupo || tema.nome);
        if (hiddenGroupNames.has(groupName)) return;
        if (!groups.has(groupName)) groups.set(groupName, []);
        groups.get(groupName).push(camada);
      });

      const themeRoot = document.createElement('section');
      themeRoot.className = 'theme-card theme-layer-root';
      const themeHeader = document.createElement('div');
      themeHeader.className = 'theme-layer-header';
      const themeSwitch = document.createElement('input');
      themeSwitch.className = 'layer-switch theme-group-switch';
      themeSwitch.type = 'checkbox';
      themeSwitch.setAttribute('role', 'switch');
      themeSwitch.setAttribute('aria-label', `Ativar grupo ${tema.nome}`);
      const themeContent = document.createElement('div');
      themeContent.className = 'theme-layer-content';
      themeContent.id = `theme-content-${tema.id}`;
      const themeDisclosure = document.createElement('button');
      themeDisclosure.className = 'theme-layer-disclosure';
      themeDisclosure.type = 'button';
      themeDisclosure.setAttribute('aria-expanded', 'true');
      themeDisclosure.setAttribute('aria-controls', themeContent.id);
      themeDisclosure.title = `Recolher ${tema.nome}`;
      themeDisclosure.innerHTML = '<span class="theme-layer-title"></span><svg class="hierarchy-disclosure-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"></path></svg>';
      themeDisclosure.querySelector('.theme-layer-title').textContent = tema.nome || '';
      themeDisclosure.onclick = () => {
        const expanded = themeDisclosure.getAttribute('aria-expanded') !== 'true';
        themeDisclosure.setAttribute('aria-expanded', String(expanded));
        themeDisclosure.title = `${expanded ? 'Recolher' : 'Expandir'} ${tema.nome}`;
        themeContent.hidden = !expanded;
      };
      const getActiveIds = layers => layers
        .filter(layer => loadedLayers[layer.id] && map.hasLayer(loadedLayers[layer.id].leafletLayer))
        .map(layer => layer.id);
      const initialActiveIds = getActiveIds(tema.camadas);
      themeSwitch.checked = initialActiveIds.length > 0;
      themeSwitch.dataset.restoreLayerIds = JSON.stringify(initialActiveIds);
      themeHeader.append(themeSwitch, themeDisclosure);
      themeRoot.append(themeHeader, themeContent);

      const appendLayerRow = (parent, camada, label = camada.nome) => {
        const loaded = loadedLayers[camada.id];
        const isChecked = loaded && map.hasLayer(loaded.leafletLayer);
        if (isChecked) totalActive++;

        const row = document.createElement('div');
        row.className = 'layer-row';
        row.innerHTML = `
          <div class="layer-main">
            <label class="layer-switch-control">
              <input class="layer-switch" type="checkbox" role="switch" ${isChecked ? 'checked' : ''} aria-label="${escapeHtml(label)}" data-layer-id="${camada.id}">
              <span class="layer-name" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
            </label>
            <div class="layer-actions">
              <button class="action-btn zoom-btn" type="button" title="Aproximar visualização" aria-label="Aproximar visualização" data-layer-id="${camada.id}">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>
              </button>
            </div>
          </div>
        `;
        parent.appendChild(row);
      };

      themeSwitch.onchange = async () => {
        themeSwitch.disabled = true;
        try {
          if (!themeSwitch.checked) {
            const activeIds = getActiveIds(tema.camadas);
            if (activeIds.length) themeSwitch.dataset.restoreLayerIds = JSON.stringify(activeIds);
            tema.camadas.forEach(layer => {
              if (loadedLayers[layer.id]) map.removeLayer(loadedLayers[layer.id].leafletLayer);
            });
            themeContent.querySelectorAll('input.layer-switch[data-layer-id]').forEach(input => { input.checked = false; });
            themeContent.querySelectorAll('.group-layer-switch').forEach(input => { input.checked = false; });
          } else {
            let restoreIds = [];
            try {
              restoreIds = JSON.parse(themeSwitch.dataset.restoreLayerIds || '[]');
            } catch {}
            if (!restoreIds.length) {
              restoreIds = tema.camadas.filter(layer => layer.ativa).map(layer => layer.id);
            }
            for (const group of themeContent.querySelectorAll('.layer-group')) {
              const childInputs = [...group.querySelectorAll('input.layer-switch[data-layer-id]')];
              const groupIds = restoreIds.filter(id => childInputs.some(input => input.dataset.layerId === id));
              const groupSwitch = group.querySelector('.group-layer-switch');
              groupSwitch.checked = groupIds.length > 0;
              if (groupIds.length) groupSwitch.dataset.restoreLayerIds = JSON.stringify(groupIds);
              for (const id of groupIds) {
                let layer = loadedLayers[id];
                if (!layer) layer = await ensureBrabasLayerLoaded(id);
                if (!layer) continue;
                enableLayerExclusive(id);
                const input = childInputs.find(candidate => candidate.dataset.layerId === id);
                if (input) input.checked = true;
              }
            }
          }
        } catch (error) {
          console.warn('Não foi possível restaurar o grupo de estádios:', error.message);
        } finally {
          themeSwitch.disabled = false;
          updateHierarchy();
        }
      };

      groups.forEach((layers, groupName) => {
        const group = document.createElement('section');
        group.className = 'layer-group';
        const groupHeader = document.createElement('div');
        groupHeader.className = 'layer-group-header';
        if (/^(corinthians|outros times)$/i.test(groupName)) groupHeader.hidden = true;
        const groupId = `layer-group-${layers[0].id}`;
        const groupContent = document.createElement('div');
        groupContent.className = 'layer-group-content';
        groupContent.id = `${groupId}-content`;
        const activeIds = getActiveIds(layers);
        const childSwitches = [];

        const groupDisclosure = document.createElement('button');
        groupDisclosure.className = 'layer-group-disclosure';
        groupDisclosure.type = 'button';
        groupDisclosure.setAttribute('aria-expanded', 'true');
        groupDisclosure.setAttribute('aria-controls', groupContent.id);
        groupDisclosure.title = `Recolher ${groupName}`;
        groupDisclosure.innerHTML = `<span class="layer-group-name">${escapeHtml(groupName)}</span><svg class="hierarchy-disclosure-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"></path></svg>`;
        groupDisclosure.onclick = () => {
          const expanded = groupDisclosure.getAttribute('aria-expanded') !== 'true';
          groupDisclosure.setAttribute('aria-expanded', String(expanded));
          groupDisclosure.title = `${expanded ? 'Recolher' : 'Expandir'} ${groupName}`;
          groupContent.hidden = !expanded;
        };
        const groupShareId = criarShareIdSubgrupo(tema.id, groupName);
        const groupShareButton = document.createElement('button');
        groupShareButton.className = 'action-btn share-btn';
        groupShareButton.type = 'button';
        groupShareButton.title = 'Copiar link deste subgrupo';
        groupShareButton.setAttribute('aria-label', `Copiar link do subgrupo ${groupName}`);
        groupShareButton.dataset.subgroupShareId = groupShareId;
        groupShareButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="m8.59 13.51 6.83 3.98"></path><path d="m15.41 6.51-6.82 3.98"></path></svg>';

        const groupSwitch = document.createElement('input');
        groupSwitch.className = 'layer-switch group-layer-switch';
        groupSwitch.type = 'checkbox';
        groupSwitch.setAttribute('role', 'switch');
        groupSwitch.setAttribute('aria-label', `Ativar grupo ${groupName}`);
        groupSwitch.checked = activeIds.length > 0;
        groupSwitch.dataset.restoreLayerIds = JSON.stringify(activeIds);
        groupSwitch.onchange = async () => {
          groupSwitch.disabled = true;
          try {
            if (!groupSwitch.checked) {
              const currentlyActive = childSwitches
                .filter(input => loadedLayers[input.dataset.layerId]
                  && map.hasLayer(loadedLayers[input.dataset.layerId].leafletLayer))
                .map(input => input.dataset.layerId);
              if (currentlyActive.length) groupSwitch.dataset.restoreLayerIds = JSON.stringify(currentlyActive);
              childSwitches.forEach(input => {
                input.checked = false;
                const layer = loadedLayers[input.dataset.layerId];
                if (layer) map.removeLayer(layer.leafletLayer);
              });
            } else {
              let restoreIds = [];
              try {
                restoreIds = JSON.parse(groupSwitch.dataset.restoreLayerIds || '[]');
              } catch {}
              if (!restoreIds.length) {
                restoreIds = childSwitches
                  .filter(input => findBrabasCatalogLayer(input.dataset.layerId)?.layer.ativa)
                  .map(input => input.dataset.layerId);
              }
              for (const id of restoreIds) {
                let layer = loadedLayers[id];
                if (!layer) layer = await ensureBrabasLayerLoaded(id);
                if (!layer) continue;
                enableLayerExclusive(id);
                const input = childSwitches.find(candidate => candidate.dataset.layerId === id);
                if (input) input.checked = true;
              }
            }
          } catch (error) {
            console.warn('Não foi possível restaurar as subcamadas do grupo:', error.message);
          } finally {
            const restoredIds = childSwitches
              .filter(input => loadedLayers[input.dataset.layerId]
                && map.hasLayer(loadedLayers[input.dataset.layerId].leafletLayer))
              .map(input => input.dataset.layerId);
            groupSwitch.checked = restoredIds.length > 0;
            if (restoredIds.length) groupSwitch.dataset.restoreLayerIds = JSON.stringify(restoredIds);
            groupSwitch.disabled = false;
            updateHierarchy();
          }
        };

        groupHeader.append(groupSwitch, groupDisclosure, groupShareButton);
        group.appendChild(groupHeader);
        [...layers]
          .sort((a, b) => (a.categoria === 'estatistica' ? 0 : 1) - (b.categoria === 'estatistica' ? 0 : 1))
          .forEach(camada => {
            appendLayerRow(groupContent, camada);
            const input = groupContent.querySelector(`input.layer-switch[data-layer-id="${camada.id}"]`);
            if (input) childSwitches.push(input);
          });
        group.appendChild(groupContent);
        themeContent.appendChild(group);
      });
      container.appendChild(themeRoot);
    });

    const activeBadge = document.getElementById('active-layer-count');
    if (activeBadge) {
      activeBadge.textContent = `${totalActive} ativas`;
    }
    updateJenksLegend();

    // Ouvintes de checkbox, zoom e opacidade
    container.querySelectorAll('input.layer-switch[data-layer-id]').forEach(chk => {
      chk.onchange = async function() {
        const layerId = this.dataset.layerId;
        let layerObj = loadedLayers[layerId];
        if (this.checked && !layerObj) {
          this.disabled = true;
          try {
            layerObj = await ensureBrabasLayerLoaded(layerId);
          } catch (error) {
            this.checked = false;
            console.warn('Não foi possível carregar os limites dos países:', error.message);
          } finally {
            this.disabled = false;
          }
        }
        if (!layerObj) return;

        if (this.checked) {
          enableLayerExclusive(layerId);
        } else {
          map.removeLayer(layerObj.leafletLayer);
        }
        updateHierarchy();
      };
    });

    container.querySelectorAll('.zoom-btn').forEach(btn => {
      btn.onclick = async function() {
        const layerId = this.dataset.layerId;
        let layerObj = loadedLayers[layerId];
        if (!layerObj) {
          try {
            layerObj = await ensureBrabasLayerLoaded(layerId);
          } catch (error) {
            console.warn('Não foi possível carregar a camada para aproximar:', error.message);
          }
        }
        if (!layerObj) return;

        if (!map.hasLayer(layerObj.leafletLayer)) {
          enableLayerExclusive(layerId);
          updateActiveCount();
          updateJenksLegend();
        }

        try {
          const bounds = layerObj.fullBounds || layerObj.leafletLayer.getBounds();
          if (bounds && bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
          }
        } catch (e) {
          console.warn("Erro ao aproximar camada:", e);
        }
      };
    });

    container.querySelectorAll('.share-btn').forEach(btn => {
      btn.onclick = async function() {
        const originalLabel = this.getAttribute('aria-label');
        try {
          await copiarLinkSubgrupo(this.dataset.subgroupShareId);
          this.title = 'Link copiado';
          this.setAttribute('aria-label', 'Link copiado');
          this.classList.add('copied');
          setTimeout(() => {
            this.title = 'Copiar link deste subgrupo';
            this.setAttribute('aria-label', originalLabel);
            this.classList.remove('copied');
          }, 1600);
        } catch (error) {
          console.warn('Não foi possível copiar o link:', error.message);
        }
      };
    });

    applyFiltersToActiveLayers();
  }

  function updateActiveCount() {
    let totalActive = 0;
    Object.values(loadedLayers).forEach(layerObj => {
      if (map.hasLayer(layerObj.leafletLayer)) totalActive++;
    });
    const activeBadge = document.getElementById('active-layer-count');
    if (activeBadge) {
      activeBadge.textContent = `${totalActive} ativas`;
    }
  }

  function updateJenksLegend() {
    const legend = document.getElementById('jenks-legend');
    const legendContent = document.getElementById('jenks-legend-content');
    const activeLayers = Object.values(loadedLayers).filter(layer => map.hasLayer(layer.leafletLayer));
    if (!legend || !legendContent) return;
    if (!activeLayers.length) {
      legendContent.innerHTML = '<p class="jenks-legend-empty">Ative uma camada estatística para ver a legenda.</p>';
      legend.hidden = false;
      return;
    }
    legendContent.innerHTML = '';
    activeLayers.forEach(layer => legendContent.appendChild(
      criarLegendaCamada(layer, currentTheme, map.getZoom())
    ));
    legend.hidden = false;
  }

  function updateCountryBoundaryWeights() {
    const weight = calcularPesoLimitePais(map.getZoom());
    Object.values(loadedLayers)
      .filter(layer => layer.config.fronteiraPais && map.hasLayer(layer.leafletLayer))
      .forEach(layer => layer.leafletLayer.setStyle({ weight }));
    const swatch = document.querySelector('.country-border-swatch');
    if (swatch) swatch.style.setProperty('--country-border-weight', `${weight}px`);
  }

  function updateStadiumSpotOpacity() {
    Object.values(loadedLayers)
      .filter(layer => layer.config.classificacao === 'jenks' && map.hasLayer(layer.leafletLayer))
      .forEach(layer => {
        const opacity = layer.config.opacidade !== undefined ? layer.config.opacidade : 1;
        layer.leafletLayer.eachLayer(marker => {
          if (!(marker instanceof L.CircleMarker)) return;
          marker.setRadius(obterRaioJenks(
            marker.feature && marker.feature.properties && marker.feature.properties.TOTAL_JOGOS,
            layer.config,
            map.getZoom()
          ));
          const markerOpacity = marker.options.atlasFilterHidden ? 0 : opacity;
          marker.setStyle(obterEstiloManchaEstadio(
            currentTheme,
            markerOpacity,
            layer.config.cor || ATLAS_JENKS_COLOR,
            map.getZoom()
          ));
        });
      });
  }

  function atualizarCamadaDeFronteirasNoViewport(layerObj) {
    const competitionFeatures = filtrarFeaturesPaisesPorCodigos(
      layerObj.data.features,
      layerObj.countryFilterCodes
    );
    const renderedFeatures = filtrarFeaturesGeoJSONVisiveis(competitionFeatures, map.getBounds());
    const previousFeatures = layerObj.renderedFeatures || [];
    if (renderedFeatures.length === previousFeatures.length
      && renderedFeatures.every((feature, index) => feature === previousFeatures[index])) return;

    const wasActive = map.hasLayer(layerObj.leafletLayer);
    if (wasActive) map.removeLayer(layerObj.leafletLayer);
    layerObj.renderedFeatures = renderedFeatures;
    layerObj.leafletLayer = buildBrabasLeafletLayer(
      { ...layerObj.data, features: renderedFeatures },
      layerObj.config,
      layerObj.themeColor
    );
    if (wasActive) map.addLayer(layerObj.leafletLayer);
  }

  function atualizarFronteirasVisiveis() {
    Object.values(loadedLayers)
      .filter(layerObj => layerObj.config.fronteiraPais && map.hasLayer(layerObj.leafletLayer))
      .forEach(atualizarCamadaDeFronteirasNoViewport);
  }

  function enableLayerExclusive(layerId) {
    const target = loadedLayers[layerId];
    if (!target) return;

    if (target.config.grupo) {
      const targetGroup = sanitizeGroupName(target.config.grupo);
      Object.entries(loadedLayers).forEach(([otherId, layer]) => {
        if (otherId === layerId || sanitizeGroupName(layer.config.grupo) !== targetGroup) return;
        if (target.config.permitirCamadasSimultaneas && layer.config.permitirCamadasSimultaneas) return;
        map.removeLayer(layer.leafletLayer);
        const checkbox = document.querySelector(`#theme-list input[type="checkbox"][data-layer-id="${otherId}"]`);
        if (checkbox) checkbox.checked = false;
      });
    }
    if (target.config.fronteiraPais) atualizarCamadaDeFronteirasNoViewport(target);
    map.addLayer(target.leafletLayer);
    const checkbox = document.querySelector(`#theme-list input[type="checkbox"][data-layer-id="${layerId}"]`);
    if (checkbox) checkbox.checked = true;
  }

  /* ==========================================================================
     5. FILTROS INTERATIVOS & SINCRONIZAÇÃO
     ========================================================================== */
  function applyFiltersToActiveLayers() {
    // Filtrar jogos de acordo com os filtros selecionados
    const filteredJogos = rawJogos.filter(j => {
      // 1. Filtro Competição
      if (activeCompeticao !== "todas"
        && getBrabasCompetitionCategory(j) !== activeCompeticao) return false;

      return true;
    });
    const activeStadiumNames = filteredJogos.flatMap(j => [
      j["ESTÁDIO"],
      j.ESTADIO,
      j["ESTÁDIO_ORIGINAL"],
      j["EST\ufffdDIO"]
    ].filter(Boolean));
    const activeStadiumNorms = expandirNomesEstadioFiltro(activeStadiumNames);
    const stadiumFeatures = Object.values(loadedLayers)
      .filter(layerObj => !layerObj.config.fronteiraPais
        && (layerObj.config.classificacao === 'jenks' || layerObj.config.estatisticasIncorporadas))
      .flatMap(layerObj => layerObj.data.features || []);
    const countryFeatures = Object.values(loadedLayers)
      .filter(layerObj => layerObj.config.fronteiraPais)
      .flatMap(layerObj => layerObj.data.features || []);
    const activeCountryCodes = activeCompeticao === 'todas'
      ? null
      : obterCodigosPaisesDasPartidas(filteredJogos, stadiumFeatures, countryFeatures);

    Object.values(loadedLayers).forEach(layerObj => {
      if (layerObj.config.fronteiraPais) {
        layerObj.countryFilterCodes = activeCountryCodes;
        if (map.hasLayer(layerObj.leafletLayer)) atualizarCamadaDeFronteirasNoViewport(layerObj);
        return;
      }
      if (!map.hasLayer(layerObj.leafletLayer)) return;
      const isStadiumLayer = layerObj.config.classificacao === 'jenks'
        || layerObj.config.historico
        || layerObj.config.categoria === 'localizacoes';
      if (!isStadiumLayer) return;

      layerObj.leafletLayer.eachLayer(marker => {
        const op = layerObj.config.opacidade !== undefined ? layerObj.config.opacidade : 1;
        const properties = marker.feature && marker.feature.properties;
        const visible = activeCompeticao === 'todas'
          || estadioCorrespondeNomesFiltro(properties, activeStadiumNorms);
        marker.options.atlasFilterHidden = !visible;
        marker.options.interactive = visible;
        const element = marker.getElement && marker.getElement();
        if (element) element.style.pointerEvents = visible ? '' : 'none';

        if (typeof marker.setOpacity === 'function') {
          marker.setOpacity(visible ? op : 0);
        } else if (typeof marker.setStyle === 'function') {
          marker.setStyle({
            opacity: visible ? op : 0,
            fillOpacity: visible
              ? op * (layerObj.config.classificacao === 'jenks' ? 0.62 : 1)
              : 0
          });
        }
      });
    });

    const countBadge = document.getElementById('filtered-stadium-count');
    if (countBadge) {
      const allCompetitions = activeCompeticao === 'todas';
      const displayedStadiums = new Set();
      Object.values(loadedLayers)
        .filter(layerObj => layerObj.config.classificacao === 'jenks' && map.hasLayer(layerObj.leafletLayer))
        .forEach(layerObj => {
          layerObj.leafletLayer.eachLayer(marker => {
            const properties = marker.feature && marker.feature.properties;
            if (!properties) return;
            obterEstadiosNoPonto(properties).forEach(stadium => {
              if (stadium.jogos <= 0) return;
              const stadiumProperties = {
                ESTADIO: stadium.nome,
                NOMES_ALTERNATIVOS: stadium.nomes_alternativos,
                CIDADE: stadium.cidade,
                ESTADO: stadium.estado,
                PAÍS: stadium.pais
              };
              if (allCompetitions || estadioCorrespondeNomesFiltro(stadiumProperties, activeStadiumNorms)) {
                displayedStadiums.add(chaveIdentidadeEstadio(stadium));
              }
            });
          });
        });
      const totalJogos = allCompetitions
        ? resumirEstatisticasEstadios(brabasLayerStatistics).jogos
        : filteredJogos.length;
      countBadge.textContent = `${displayedStadiums.size} estádios (${totalJogos} jogos)`;
    }
  }

  /* ==========================================================================
     6. ESTATÍSTICAS HISTÓRICAS DAS BRABAS
     ========================================================================== */
  function getBrabasMappedStadiumCount() {
    const identities = new Set();
    rawEstadios.forEach(feature => {
      const properties = feature.properties || {};
      obterEstadiosNoPonto(properties).forEach(stadium => {
        if (stadium.jogos > 0) identities.add(chaveIdentidadeEstadio(stadium));
      });
    });
    return identities.size;
  }

  function renderBrabasStats() {
    if (!brabasLayerStatistics.length) {
      console.warn('Não foi possível exibir os números: a camada estatística combinada das Brabas não está carregada.');
      return;
    }
    const totals = resumirEstatisticasEstadios(brabasLayerStatistics);
    const titulos = 19; // 5 Libertadores, 6 Brasileiros, 4 Paulistas, 3 Supercopas, 1 Copa BR

    const aproveitamento = totals.jogos > 0
      ? Math.round(((totals.vitorias * 3 + totals.empates) / (totals.jogos * 3)) * 100)
      : 0;

    const stats = [
      { label: 'Títulos Oficiais', value: titulos },
      { label: 'Total de Jogos', value: totals.jogos },
      { label: 'Aproveitamento', value: `${aproveitamento}%` },
      { label: 'Gols Marcados', value: totals.gols },
      { label: 'Vitórias', value: totals.vitorias },
      { label: 'Estádios Mapeados', value: getBrabasMappedStadiumCount() }
    ];

    const container = document.getElementById('brabas-stats-grid');
    if (container) {
      container.innerHTML = stats.map(s => `
        <div class="stat-card">
          <div class="label">${s.label}</div>
          <div class="value">${s.value}</div>
        </div>
      `).join('');
    }
  }

  function showBrabasStadiumHistory(properties) {
    const panel = document.getElementById('attr-panel');
    const title = document.getElementById('attr-layer-name');
    const tag = document.querySelector('.attr-tag');
    const body = document.getElementById('attr-body');
    if (!panel || !body) return;

    panel.classList.add('history-view');
    const stadiumName = properties.ESTADIO_EXIBICAO
      || properties['ESTÁDIO']
      || properties.ESTADIO
      || 'Estádio';
    const normalizedNames = [stadiumName, properties.NOME_OFICIAL].map(normalizeStadiumName);
    const description = DESCRICOES_ESTADIOS_CORINTHIANS.find(item =>
      item.aliases.some(alias => normalizedNames.some(name => {
        const normalizedAlias = normalizeStadiumName(alias);
        return normalizedAlias === 'PARQUESAOJORGE'
          ? name === normalizedAlias
          : name.includes(normalizedAlias);
      }))
    );
    const officialName = String(properties.NOME_OFICIAL || properties.NOME_ATUAL || '').replace(/[.?!\s]+$/g, '');
    const oldName = obterNomeAntigoEstadio(properties)
      || String(properties.NOME_ANTIGO_1 || properties.NOME_ANTIGO_2 || '').trim();
    const debutYear = Number(properties.ANO_PRIMEIRA_PARTIDA_BRABAS || properties.ANO_PRIMEIRA_PARTIDA);
    const firstMatchDate = properties.DATA_PRIMEIRA_PARTIDA_BRABAS || properties.DATA_PRIMEIRA_PARTIDA;
    const debutDate = firstMatchDate
      ? formatarDataJogo(firstMatchDate)
      : '';
    const firstMatch = String(properties.PRIMEIRA_PARTIDA_BRABAS || properties.PRIMEIRA_PARTIDA || '').trim();
    const matches = getBrabasMatchesForLocation(properties)
      .sort((a, b) => String(b.DATA || '').localeCompare(String(a.DATA || '')));
    const matchesHtml = matches.map(game => {
      const resultClass = game.RESULTADO === 'VITÓRIA'
        ? 'win'
        : game.RESULTADO === 'EMPATE' ? 'draw' : 'loss';
      const home = game['TIME MANDANTE'] || '';
      const away = game['TIME VISITANTE'] || '';
      const homeCrest = obterMiniaturaClube(home);
      const awayCrest = obterMiniaturaClube(away);
      const matchScore = `
        <div class="brabas-match-item ${resultClass}">
          <div class="match-meta">
            <span class="match-date">${escapeHtml(formatarDataJogo(game.DATA))}</span>
            ${(game.COMPETICAO_EXIBICAO || game['COMPETIÇÃO']) ? `<span class="jogo-tag comp">${escapeHtml(game.COMPETICAO_EXIBICAO || game['COMPETIÇÃO'])}</span>` : ''}
          </div>
          <div class="match-score">
            <span class="mandante ${normalizeBrabasTeamName(home) === 'CORINTHIANS' ? 'corinthians' : ''}"><span class="club-name">${escapeHtml(home)}</span>${homeCrest.src ? `<img class="club-mini-crest" src="${homeCrest.src}" alt="" aria-hidden="true" loading="lazy">` : `<span class="club-mini-crest-fallback" aria-hidden="true">${escapeHtml(homeCrest.initials)}</span>`}</span>
            <span class="score-badge ${resultClass}">${escapeHtml(game.PLACAR || 'x')}</span>
            <span class="visitante ${normalizeBrabasTeamName(away) === 'CORINTHIANS' ? 'corinthians' : ''}">${awayCrest.src ? `<img class="club-mini-crest" src="${awayCrest.src}" alt="" aria-hidden="true" loading="lazy">` : `<span class="club-mini-crest-fallback" aria-hidden="true">${escapeHtml(awayCrest.initials)}</span>`}<span class="club-name">${escapeHtml(away)}</span></span>
          </div>
          ${game.AUTORAS ? `<div class="jogo-autoras"><em>${escapeHtml(game.AUTORAS)}</em></div>` : ''}
        </div>
      `;
      return matchScore;
    }).join('');
    const wikipediaUrl = description
      ? description.wikipedia
      : `https://pt.wikipedia.org/w/index.php?search=${encodeURIComponent(stadiumName)}`;

    if (title) title.textContent = stadiumName;
    if (tag) tag.textContent = 'História do estádio';
    body.innerHTML = `
      <div class="stadium-history">
        ${oldName ? `<p>Antigo nome: ${escapeHtml(oldName)}.</p>` : ''}
        ${officialName && officialName !== stadiumName ? `<p>Nome ou referência histórica: ${escapeHtml(officialName)}.</p>` : ''}
        ${description ? `<p>${escapeHtml(description.resumo)}</p>` : '<p>Não há descrição histórica disponível para este estádio no acervo.</p>'}
        ${firstMatch && debutYear ? `<p>O acervo registra a primeira partida das Brabas neste estádio em ${debutYear}${debutDate ? ` (${debutDate})` : ''}: ${escapeHtml(firstMatch)}.</p>` : ''}
        ${criarResumoEstatisticasEstadio({ ...properties, ESTATISTICAS_INCORPORADAS: true }, 'Brabas')}
        <div class="matches-list-title">Histórico de partidas (${matches.length})</div>
        <div class="brabas-matches-container">
          ${matchesHtml || '<div class="attr-hint">Não há partidas individuais registradas para este estádio.</div>'}
        </div>
        <div class="stadium-history-sources wikipedia-sources">
          <strong>Fontes</strong>
          <a href="${escapeHtml(wikipediaUrl)}" target="_blank" rel="noopener noreferrer">Wikipedia ↗</a>
        </div>
      </div>
    `;
    destacarCorinthiansEmTexto(panel);
    panel.style.display = 'flex';
  }

  /* ==========================================================================
     7. PAINEL DE HISTÓRIA E ESTATÍSTICAS DE ESTÁDIO DAS BRABAS
     ========================================================================== */
  function showEstadioDetails(estProps, jogos) {
    const attrPanel = document.getElementById('attr-panel');
    const attrBody = document.getElementById('attr-body');
    const titleEl = document.getElementById('attr-layer-name');
    const tagEl = document.querySelector('.attr-tag');

    if (attrPanel) attrPanel.classList.remove('history-view');
    const estNome = estProps['ESTÁDIO'] || estProps.ESTADIO || estProps['EST\ufffdDIO'] || estProps.NOME_OFICIAL || estProps.Name || 'Estádio';
    if (titleEl) titleEl.textContent = estNome;
    if (tagEl) tagEl.textContent = 'ESTATÍSTICA DE JOGOS';

    const total = jogos.length;
    const vit = jogos.filter(j => j["RESULTADO"] === "VITÓRIA").length;
    const emp = jogos.filter(j => j["RESULTADO"] === "EMPATE").length;
    const der = jogos.filter(j => j["RESULTADO"] === "DERROTA").length;
    const aproveitamento = total > 0 ? Math.round(((vit * 3 + emp) / (total * 3)) * 100) : 0;

    const localizacao = formatarEnderecoEstadio(estProps);
      const oldName = obterNomeAntigoEstadio(estProps);

    let jogosHtml = [...jogos]
      .sort((a, b) => String(b.DATA || '').localeCompare(String(a.DATA || '')))
      .map(j => {
      const resClass = j["RESULTADO"] === "VITÓRIA" ? "win" : (j["RESULTADO"] === "EMPATE" ? "draw" : "loss");
      const home = j["TIME MANDANTE"] || "";
      const away = j["TIME VISITANTE"] || "";
      const homeCrest = obterMiniaturaClube(home);
      const awayCrest = obterMiniaturaClube(away);
      const autorasText = j["AUTORAS"] ? `<div class="jogo-autoras"><em>${escapeHtml(j["AUTORAS"])}</em></div>` : '';
      const publicoText = (j["PÚBLICO TOTAL"] && j["PÚBLICO TOTAL"] !== "ND" && j["PÚBLICO TOTAL"] !== "N/A") ? 
        `<span class="jogo-tag">Público: ${j["PÚBLICO TOTAL"]}</span>` : '';
      const competitionLabel = j.COMPETICAO_EXIBICAO || j["COMPETIÇÃO"] || j["COMPETICAO"];
      const compText = competitionLabel ? `<span class="jogo-tag comp">${escapeHtml(competitionLabel)}</span>` : '';

      return `
        <div class="brabas-match-item ${resClass}">
          <div class="match-meta">
            <span class="match-date">${escapeHtml(formatarDataJogo(j["DATA"]))}</span>
            ${compText}
            ${publicoText}
          </div>
          <div class="match-score">
            <span class="mandante ${normalizeBrabasTeamName(home) === 'CORINTHIANS' ? 'corinthians' : ''}"><span class="club-name">${escapeHtml(home)}</span>${homeCrest.src ? `<img class="club-mini-crest" src="${homeCrest.src}" alt="" aria-hidden="true" loading="lazy">` : `<span class="club-mini-crest-fallback" aria-hidden="true">${escapeHtml(homeCrest.initials)}</span>`}</span>
            <span class="score-badge ${resClass}">${j["PLACAR"] || "x"}</span>
            <span class="visitante ${normalizeBrabasTeamName(away) === 'CORINTHIANS' ? 'corinthians' : ''}">${awayCrest.src ? `<img class="club-mini-crest" src="${awayCrest.src}" alt="" aria-hidden="true" loading="lazy">` : `<span class="club-mini-crest-fallback" aria-hidden="true">${escapeHtml(awayCrest.initials)}</span>`}<span class="club-name">${escapeHtml(away)}</span></span>
          </div>
          ${autorasText}
        </div>
      `;
    }).join('');

    if (total === 0) {
      jogosHtml = '<div class="attr-hint">Nenhum registro de partida individual filtrado para este estádio no momento.</div>';
    }

    attrBody.innerHTML = `
      <div class="estadio-summary-card">
        <div class="estadio-location">${escapeHtml(localizacao || 'Localização não informada')}</div>
          ${oldName ? `<div class="estadio-cap">Antigo nome: ${escapeHtml(oldName)}</div>` : ''}
        <div class="estadio-cap estadio-capacity">${escapeHtml(formatarCapacidadeEstadio(estProps))}</div>
        <div class="estadio-metrics-bar">
          <div class="metric"><span class="m-val">${total}</span> <span class="m-lbl">jogos</span></div>
          <div class="metric win"><span class="m-val">${vit}</span> <span class="m-lbl">vitórias</span></div>
          <div class="metric draw"><span class="m-val">${emp}</span> <span class="m-lbl">empates</span></div>
          <div class="metric loss"><span class="m-val">${der}</span> <span class="m-lbl">derrotas</span></div>
          <div class="metric"><span class="m-val">${aproveitamento}%</span> <span class="m-lbl">aprov.</span></div>
        </div>
      </div>
      <div class="matches-list-title">Histórico de Partidas (${total}):</div>
      <div class="brabas-matches-container">
        ${jogosHtml}
      </div>
    `;
    destacarCorinthiansEmTexto(attrPanel);
    attrPanel.style.display = 'flex';
  }

  /* ==========================================================================
     8. EVENTOS DA INTERFACE
     ========================================================================== */
  function applyTheme(theme, syncBasemap = true) {
    currentTheme = theme === 'light' ? 'light' : 'dark';
    document.body.dataset.theme = currentTheme;
    localStorage.setItem('atlas1910_brabas_theme', currentTheme);

    const themeButton = document.getElementById('map-theme-toggle');
    if (themeButton) {
      themeButton.setAttribute('aria-pressed', String(currentTheme === 'light'));
      themeButton.setAttribute('aria-label', currentTheme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
      themeButton.title = currentTheme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro';
    }

    const siteLogo = document.getElementById('site-logo');
    if (siteLogo) {
      siteLogo.src = currentTheme === 'dark'
        ? 'assets/ATLAS%20BRABAS%202.png'
        : 'assets/ATLAS%20BRABAS.png';
    }
    const brabasLogo = document.getElementById('brabas-icon-img');
    if (brabasLogo) {
      brabasLogo.src = currentTheme === 'dark'
        ? 'assets/brabas-dark.png'
        : 'assets/brabas-light.png';
    }

    Object.values(loadedLayers).forEach(layerObj => {
      const config = layerObj.config;
      if (!layerObj.leafletLayer) return;
      if (config.escudosHistoricos) {
        layerObj.leafletLayer.eachLayer(marker => {
          const properties = marker.feature && marker.feature.properties;
          if (!properties || typeof marker.setIcon !== 'function') return;
          if (config.estatisticasIncorporadas) {
            marker.setIcon(criarIconeLocalizacaoEstatistica(properties, config, currentTheme));
            return;
          }
          const iconUrl = resolverEscudoHistorico(properties, currentTheme, config.icone);
          if (!iconUrl) return;
          const size = config.tamanhoIcone || [20, 20];
          marker.setIcon(L.icon({
            iconUrl,
            iconSize: size,
            iconAnchor: [size[0] / 2, size[1] / 2],
            popupAnchor: [0, -size[1] / 2],
            className: 'custom-image-marker'
          }));
        });
        if (config.classificacao !== 'jenks') return;
      }
      if (config.iconeDark && config.iconeLight) {
        const iconUrl = currentTheme === 'light' ? config.iconeLight : config.iconeDark;
        const size = config.tamanhoIcone || [20, 20];
        const icon = L.icon({
          iconUrl,
          iconSize: size,
          iconAnchor: [size[0] / 2, size[1] / 2],
          popupAnchor: [0, -size[1] / 2],
          className: 'custom-image-marker'
        });
        layerObj.leafletLayer.eachLayer(marker => {
          if (marker && typeof marker.setIcon === 'function') marker.setIcon(icon);
        });
        return;
      }
      layerObj.leafletLayer.eachLayer(marker => {
        if (typeof marker.setStyle !== 'function') return;
        const style = config.classificacao === 'jenks'
          ? obterEstiloManchaEstadio(
            currentTheme,
            config.opacidade !== undefined ? config.opacidade : 1,
            config.cor || ATLAS_JENKS_COLOR,
            map.getZoom()
          )
          : { color: currentTheme === 'light' ? '#09090b' : '#ffffff', weight: 1.5 };
        marker.setStyle(marker.options.atlasFilterHidden
          ? { ...style, opacity: 0, fillOpacity: 0 }
          : style);
      });
    });

    if (syncBasemap && typeof BasemapManager !== 'undefined') {
      BasemapManager.onThemeChange(currentTheme);
    }
    updateJenksLegend();
  }

  function setupEvents() {
    // Filtro Competição
    const compSelect = document.getElementById('filter-comp');
    if (compSelect) {
      compSelect.onchange = async (e) => {
        activeCompeticao = e.target.value;
        if (activeCompeticao !== "todas") {
          try {
            await loadBrabasData();
          } catch (error) {
            console.warn('Não foi possível carregar as partidas para aplicar o filtro:', error.message);
            activeCompeticao = "todas";
            compSelect.value = "todas";
          }
        }
        applyFiltersToActiveLayers();
      };
    }

    const themeButton = document.getElementById('map-theme-toggle');
    if (themeButton) {
      themeButton.onclick = () => {
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark', true);
      };
    }

    const numbersOpenButton = document.getElementById('btn-numbers-open');
    const numbersDialog = document.getElementById('numbers-dialog');
    if (numbersOpenButton && numbersDialog) {
      numbersOpenButton.addEventListener('click', () => numbersDialog.showModal());
      numbersDialog.addEventListener('click', event => {
        if (event.target === numbersDialog) numbersDialog.close();
      });
    }

    // Painel informativo do estádio
    const attrPanel = document.getElementById('attr-panel');
    const attrCloseBtn = document.getElementById('attr-close-btn');

    if (attrCloseBtn) {
      attrCloseBtn.onclick = () => {
        attrPanel.style.display = 'none';
      };
    }

    // Colabore com o Projeto
    setupColaboreModal();
    setupSidebarControls();
  }

  function setupColaboreModal() {
    const colaboreBtn      = document.getElementById('btn-colabore-toggle');
    const colaborePanel    = document.getElementById('colabore-panel');
    const colaboreClose    = document.getElementById('colabore-close-btn');
    const colaboreBackdrop = document.getElementById('colabore-backdrop');
    const COLABORE_SHOWN_KEY = 'atlas1910_colabore_popup_shown';

    function openColaborePopup() {
      if (!colaborePanel) return;
      colaborePanel.style.display = 'flex';
      if (colaboreBackdrop) {
        colaboreBackdrop.style.display = 'block';
        requestAnimationFrame(() => colaboreBackdrop.classList.add('active'));
      }
      requestAnimationFrame(() => colaborePanel.classList.add('active'));
    }

    function closeColaborePopup() {
      if (!colaborePanel) return;
      colaborePanel.classList.remove('active');
      if (colaboreBackdrop) colaboreBackdrop.classList.remove('active');
      setTimeout(() => {
        colaborePanel.style.display = 'none';
        if (colaboreBackdrop) colaboreBackdrop.style.display = 'none';
      }, 250);
    }

    if (colaboreBtn) {
      colaboreBtn.onclick = () => {
        if (colaborePanel && colaborePanel.classList.contains('active')) {
          closeColaborePopup();
        } else {
          // Ao abrir manualmente, registra para não incomodar no timer automático
          localStorage.setItem(COLABORE_SHOWN_KEY, 'true');
          openColaborePopup();
        }
      };
    }

    if (colaboreClose) {
      colaboreClose.onclick = closeColaborePopup;
    }

    if (colaboreBackdrop) {
      colaboreBackdrop.onclick = closeColaborePopup;
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && colaborePanel && colaborePanel.classList.contains('active')) {
        closeColaborePopup();
      }
    });

    // Aparece após 4 minutos do acesso à página, mesmo com o usuário totalmente parado, apenas uma vez
    if (!localStorage.getItem(COLABORE_SHOWN_KEY)) {
      const pageOpenedAt = Date.now();
      const popupDelayMs = 4 * 60 * 1000;
      const triggerOnce = () => {
        if (localStorage.getItem(COLABORE_SHOWN_KEY)) return;
        const elapsed = Date.now() - pageOpenedAt;
        if (elapsed >= popupDelayMs) {
          openColaborePopup();
          localStorage.setItem(COLABORE_SHOWN_KEY, 'true');
        }
      };

      // Timer principal de 4 minutos
      setTimeout(triggerOnce, popupDelayMs);

      // Verificação adicional para garantir execução mesmo com aba em segundo plano ou tela parada
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          triggerOnce();
        }
      });
    }
  }

  function setupSidebarControls() {
    const sidebar = document.getElementById('sidebar');
    const collapseBtn = document.getElementById('btn-sidebar-collapse');
    const expandBtn = document.getElementById('btn-sidebar-expand');
    const layerPanelBtn = document.getElementById('btn-layer-panel');
    const mobileCloseBtn = document.getElementById('btn-mobile-close');
    const backdrop = document.getElementById('drawer-backdrop');

    if (collapseBtn) {
      collapseBtn.onclick = () => {
        sidebar.classList.add('collapsed');
        if (expandBtn) expandBtn.classList.add('visible');
        setTimeout(() => { if (map) map.invalidateSize(); }, 320);
      };
    }
    if (expandBtn) {
      expandBtn.onclick = () => {
        sidebar.classList.remove('collapsed');
        expandBtn.classList.remove('visible');
        setTimeout(() => { if (map) map.invalidateSize(); }, 320);
      };
    }
    if (layerPanelBtn) {
      layerPanelBtn.onclick = () => {
        if (window.innerWidth <= 820) {
          sidebar.classList.remove('mobile-hidden');
          if (backdrop) backdrop.classList.add('active');
          setTimeout(() => { if (map) map.invalidateSize(); }, 300);
          return;
        }
        sidebar.classList.remove('collapsed');
        if (expandBtn) expandBtn.classList.remove('visible');
        setTimeout(() => { if (map) map.invalidateSize(); }, 320);
      };
    }
    const closeDrawer = () => {
      sidebar.classList.add('mobile-hidden');
      if (backdrop) backdrop.classList.remove('active');
      setTimeout(() => { if (map) map.invalidateSize(); }, 300);
    };
    if (mobileCloseBtn) mobileCloseBtn.onclick = closeDrawer;
    if (backdrop) backdrop.onclick = closeDrawer;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  window.addEventListener('DOMContentLoaded', init);
})();
