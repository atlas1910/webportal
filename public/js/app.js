/**
 * ==========================================================================
 * ATLAS1910 - Acervo Cartográfico do Corinthians
 * Núcleo da Aplicação (Leaflet, Camadas do QGIS, Proteção de Dados e Temas)
 * Tipografia Oficial: Inter (Neo-Grotesque / Helvetica)
 * ==========================================================================
 */

(function() {
  'use strict';

  let map;
  let routeOriginMarker;
  const loadedLayers = {}; // id -> { leafletLayer, data, count, config, themeId }
  let currentSelectedFeatureProps = null;
  let currentTheme = "dark"; // "dark" (Luz Noturna) ou "light" (Modo Normal)
  let maleMatchFeatures = null;
  let maleMatchPromise = null;

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
      console.warn("Camada compartilhada solicitada não encontrada no catálogo:", requestedShareId);
    }

    if (requestedSubgroupId && !sharedSubgroup) {
      console.warn("Subgrupo compartilhado solicitado não encontrado no catálogo:", requestedSubgroupId);
    }
    if (sharedLayer && sharedLayer.section === 'brabas') {
      window.location.replace(`/as-brabas.html?camada=${encodeURIComponent(requestedShareId)}`);
      return;
    }
    if (sharedSubgroup && sharedSubgroup.section === 'brabas') {
      window.location.replace(`/as-brabas.html?subgrupo=${encodeURIComponent(requestedSubgroupId)}`);
      return;
    }

    await carregarHistoricoNomesEstadios();

    // 1. Carregar tema preferido salvo (ou padrão dark)
    const savedTheme = localStorage.getItem('atlas1910_theme') || "dark";
    applyTheme(savedTheme, false);

    // 2. Criar mapa Leaflet otimizado - desabilitando animações que causam descompasso
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
    }).setView([-23.5505, -46.6333], 9);
    routeOriginMarker = L.marker([-23.53096, -46.56809], {
      icon: L.icon({
        iconUrl: 'assets/icones/escudos-historicos/2012.png',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
        alt: 'Marco zero - Parque São Jorge'
      }),
      title: 'Marco zero - Parque São Jorge',
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000
    });
    map.on('layeradd layerremove', syncRouteOriginMarker);
    map.on('moveend atlas1910:beforeprojectionchange', atualizarFronteirasVisiveis);
    BasemapManager.constrainMapToSingleWorld(map);
    map.on('click', recolherControlesAoClicarMapa);
    map.on('zoomend', () => {
      updateCountryBoundaryWeights();
      updateStadiumSpotOpacity();
      updateJenksLegend();
    });

    // 3. Inicializar Mapas Base sincronizados com o tema atual
    BasemapManager.init(map, currentTheme);
    BasemapManager.setupMapNavigationControls(map);

    // 4. Ativar Mecanismos de Proteção contra Download e Cópia
    setupProtection();

    // 5. Carregar todas as camadas definidas no CATALOGO_TEMAS
    await loadAllCatalogLayers(requestedShareId, sharedSubgroup);

    // 6. Renderizar Lista de Temáticas na Barra Lateral
    renderThemesUI();

    // 7. Configurar Ouvintes de Eventos da Interface
    setupUIEvents();

    // Shared links keep the initial request focused on the selected layer.
    const statsSection = document.getElementById('btn-numbers-open')?.closest('.sidebar-extra-section');
    if ((requestedShareId || sharedSubgroup) && statsSection) {
      statsSection.hidden = true;
      const mapFilterPanel = document.getElementById('map-filter-panel');
      if (mapFilterPanel) mapFilterPanel.hidden = true;
    }
  }

  /* ==========================================================================
     2. MECANISMOS DE PROTEÇÃO (ANTI-DOWNLOAD)
     ========================================================================== */
  function setupProtection() {
    // Bloqueia clique com botão direito do mouse no mapa e em toda a página
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      return false;
    });

    // Bloqueia atalhos comuns de download/inspeção: Ctrl+S (Salvar), Ctrl+U (Ver Código-Fonte)
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        return false;
      }
    });

    // Evita arraste acidental de imagens/SVG
    document.addEventListener('dragstart', function(e) {
      e.preventDefault();
    });
  }

  /* ==========================================================================
     3. CARREGAMENTO DAS CAMADAS DO QGIS / GEOJSON
     ========================================================================== */
  async function loadAllCatalogLayers(sharedShareId = null, sharedSubgroup = null) {
    if (typeof CATALOGO_TEMAS === 'undefined') {
      console.error("CATALOGO_TEMAS não definido em js/camadas.js");
      return;
    }

    const targetId = sharedShareId ? String(sharedShareId).trim().toLowerCase() : null;
    const sharedLayerIds = sharedSubgroup
      ? new Set(sharedSubgroup.layers.map(layer => layer.id))
      : null;
    const initialLayers = CATALOGO_TEMAS.flatMap(tema => tema.camadas
      .filter(camada => targetId
        ? (camada.shareId || '').toLowerCase() === targetId
        : sharedLayerIds
          ? sharedLayerIds.has(camada.id)
          : camada.ativa)
      .map(camada => ({ tema, camada })));

    await Promise.all(initialLayers.map(async ({ tema, camada }) => {
      try {
        const layer = await loadCatalogLayer(tema, camada);
        if (layer && (targetId || sharedLayerIds || camada.ativa)) layer.leafletLayer.addTo(map);
      } catch (err) {
        console.warn(`Aviso: Camada '${camada.nome}' (${camada.arquivo}) não pôde ser carregada:`, err.message);
      }
    }));

    if (targetId) {
      const activeObj = Object.values(loadedLayers).find(
        l => (l.config.shareId || '').toLowerCase() === targetId
      );
      if (activeObj) {
        if (activeObj.config.fronteiraPais) {
          atualizarCamadaDeFronteirasNoViewport(activeObj);
        }
        let bounds = null;
        if (activeObj.fullBounds && typeof activeObj.fullBounds.isValid === 'function' && activeObj.fullBounds.isValid()) {
          bounds = activeObj.fullBounds;
        } else if (activeObj.leafletLayer && typeof activeObj.leafletLayer.getBounds === 'function') {
          const b = activeObj.leafletLayer.getBounds();
          if (b && typeof b.isValid === 'function' && b.isValid()) bounds = b;
        }
        if (bounds) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
          if (activeObj.config.fronteiraPais) {
            setTimeout(() => atualizarCamadaDeFronteirasNoViewport(activeObj), 150);
          }
        }
      }
    }

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

  async function ensureCatalogLayerLoaded(layerId) {
    if (loadedLayers[layerId]) return loadedLayers[layerId];
    for (const tema of CATALOGO_TEMAS) {
      const camada = tema.camadas.find(candidate => candidate.id === layerId);
      if (!camada) continue;
      return loadCatalogLayer(tema, camada);
    }
    return null;
  }

  async function activateCatalogLayers(layerIds, container) {
    const inputs = new Map(
      [...container.querySelectorAll('input.layer-switch[data-layer-id]')]
        .map(input => [input.dataset.layerId, input])
    );

    for (const id of layerIds) {
      const input = inputs.get(id);
      if (input) input.disabled = true;
      try {
        const layer = await ensureCatalogLayerLoaded(id);
        if (!layer) throw new Error(`Camada '${id}' não encontrada no catálogo.`);
        enableLayerExclusive(id);
        if (input) input.checked = true;
      } finally {
        if (input) input.disabled = false;
      }
    }
  }

  async function loadCatalogLayer(tema, camada) {
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

    if (camada.recorteEstadios) {
      geojson = {
        ...geojson,
        features: filtrarFeaturesEstadios(geojson.features, camada.recorteEstadios)
      };
    }
    if (camada.fronteiraPais && camada.arquivoPaisesOrigem) {
      const response = await fetch(camada.arquivoPaisesOrigem);
      if (!response.ok) throw new Error(`Status HTTP ${response.status}`);
      const countryCollection = await response.json();
      geojson = {
        ...geojson,
        features: filtrarLimitesPaises(geojson.features, countryCollection.features || [])
      };
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
    const renderData = renderedFeatures === geojson.features
      ? geojson
      : { ...geojson, features: renderedFeatures };
    const leafletLayer = buildLeafletLayer(renderData, camada, tema.cor);

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

  function buildLeafletLayer(geojson, layerConfig, themeColor) {
    const color = layerConfig.cor || themeColor || '#ffffff';
    const shape = layerConfig.forma || 'circulo';
    const opacity = layerConfig.opacidade !== undefined ? layerConfig.opacidade : 1;

    return L.geoJSON(geojson, {
      attribution: layerConfig.attribution,
      pointToLayer: function(feature, latlng) {
        const isStatisticsLayer = layerConfig.classificacao === 'jenks';
        const radius = isStatisticsLayer
          ? obterRaioJenks(feature.properties && feature.properties.TOTAL_JOGOS, layerConfig, map.getZoom())
          : 5;
        if (layerConfig.estatisticasIncorporadas
          && (!layerConfig.iconeSomenteCorinthians || pertenceAoGrupoDeEstadios(feature, 'corinthians'))) {
          return L.marker(latlng, {
            icon: criarIconeLocalizacaoEstatistica(feature.properties || {}, layerConfig, currentTheme),
            opacity: opacity
          });
        }

        // Seleção de ícone com suporte a variantes claro/escuro
        let iconPath = (feature.properties && (feature.properties.icone || feature.properties.icon || feature.properties.imagem_marcador)) || layerConfig.icone;
        if (layerConfig.routeFeatures && feature.properties && feature.properties.tipo === 'estadio_destino') {
          iconPath = obterMiniaturaClube(feature.properties.clube).src || iconPath;
        }
        if (layerConfig.escudosHistoricos && feature.properties) {
          iconPath = resolverEscudoHistorico(feature.properties, currentTheme, iconPath) || iconPath;
        }
        if (!isStatisticsLayer && layerConfig.iconeDark && layerConfig.iconeLight) {
          iconPath = currentTheme === 'light' ? layerConfig.iconeLight : layerConfig.iconeDark;
        }

        if (!isStatisticsLayer && iconPath) {
          const size = layerConfig.tamanhoIcone || [22, 22];
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

        if (shape === 'diamante') {
          return L.marker(latlng, {
            icon: L.divIcon({
              className: 'custom-geo-marker',
              html: `<div style="width:12px;height:12px;background:${color};border:1.5px solid #000;box-shadow:0 0 6px ${color};transform:rotate(45deg);opacity:${opacity};"></div>`,
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            })
          });
        }
        if (shape === 'anel') {
          return L.circleMarker(latlng, {
            radius: 5.5,
            fillOpacity: 0,
            color: layerConfig.cor || ATLAS_JENKS_COLOR,
            weight: 0.25,
            opacity: opacity * 0.55
          });
        }
        // Círculo preenchido padrão
        const circleStyle = obterEstiloManchaEstadio(currentTheme, opacity, layerConfig.cor || ATLAS_JENKS_COLOR, map.getZoom());
        return L.circleMarker(latlng, {
          radius,
          ...circleStyle,
          interactive: true,
          bubblingMouseEvents: false
        });
      },
      style: function() {
        if (layerConfig.routeFeatures) {
          return {
            color: obterCorRota(layerConfig, currentTheme) || color,
            weight: 4,
            opacity: opacity,
            fill: false,
            dashArray: null
          };
        }
        if (layerConfig.classificacao === 'jenks') {
          return obterEstiloManchaEstadio(currentTheme, opacity, layerConfig.cor || ATLAS_JENKS_COLOR, map.getZoom());
        }
        if (layerConfig.fronteiraPais) {
          return {
            color: color,
            weight: calcularPesoLimitePais(map.getZoom()),
            opacity: opacity,
            fill: false,
            fillOpacity: 0,
            interactive: false
          };
        }
        return {
          color: color,
          weight: 3.5,
          opacity: opacity,
          fillColor: color,
          fillOpacity: 0.25 * opacity,
          dashArray: layerConfig.tipo === 'linha' ? '7, 5' : null
        };
      },
      onEachFeature: function(feature, layer) {
        if (layerConfig.classificacao === 'jenks' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
          layer.on('mouseover', () => mostrarPreviaEstatisticasMapa(map, layer, feature.properties || {}, 'Corinthians'));
          layer.on('mouseout', () => ocultarPreviaEstatisticasMapa(map));
        }
        if (layerConfig.fronteiraPais) return;
        layer.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          if (layerConfig.classificacao === 'jenks') {
            const properties = feature.properties || {};
            if (window.matchMedia('(pointer: coarse)').matches) {
              mostrarPreviaEstatisticasMapa(map, layer, properties, 'Corinthians', () => showStadiumStatistics(properties));
              return;
            }
            ocultarPreviaEstatisticasMapa(map);
            showStadiumStatistics(properties);
          } else if (layerConfig.historico) {
            showStadiumHistory(feature.properties);
          } else {
            const properties = feature.properties || {};
            if (layerConfig.routeFeatures) {
              const routeProperties = { ...properties };
              delete routeProperties.match_status;
              delete routeProperties.projecao;
              if (properties.projecao) {
                routeProperties.status = 'Adversário, data e estádio sujeitos à confirmação oficial.';
              }
              showFeatureAttributes(layerConfig.nome, routeProperties);
            } else {
              showFeatureAttributes(layerConfig.nome, properties);
            }
          }
        });
      }
    });
  }

  function normalizeMatchValue(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
  }

  async function loadMaleMatchArchive() {
    if (maleMatchFeatures) return maleMatchFeatures;
    if (!maleMatchPromise) {
      maleMatchPromise = fetch('data/partidas/corinthians_masculino.geojson?v=20260928-admin-locations-v2')
        .then(response => {
          if (!response.ok) throw new Error(`Status HTTP ${response.status}`);
          return response.json();
        })
        .then(collection => {
          maleMatchFeatures = collection.features || [];
          return maleMatchFeatures;
        })
        .catch(error => {
          maleMatchPromise = null;
          throw error;
        });
    }
    return maleMatchPromise;
  }

  const STADIUM_ALIASES_JS = {
    'NEOQUIMICAARENA': ['ARENACORINTHIANS', 'NEOQUIMICAARENA'],
    'ARENACORINTHIANS': ['ARENACORINTHIANS', 'NEOQUIMICAARENA'],
    'PACAEMBU': ['PACAEMBU', 'ESTADIODOPACAEMBU', 'PAULOMACHADODECARVALHO'],
    'MORUMBI': ['MORUMBI', 'CICERO POMPEU DE TOLEDO', 'CICERO POMPEU DE TOLEDO (MORUMBI)'],
    'PARQUESAOJORGE': ['PARQUESAOJORGE', 'FAZENDINHA', 'ALFREDOSCHURIG', 'ESTADIOALFREDOSCHURIG'],
    'ALFREDOSCHURIG': ['PARQUESAOJORGE', 'FAZENDINHA', 'ALFREDOSCHURIG', 'ESTADIOALFREDOSCHURIG'],
    'CANINDE': ['CANINDE', 'ESTADIODOCANINDE', 'OSWALDOTEIXEIRADUARTE'],
    'PARQUEANTARCTICA': ['PALESTRAITALIA', 'PARQUEANTARCTICA', 'ALLIANZPARQUE'],
    'ALLIANZPARQUE': ['ALLIANZPARQUE', 'PALESTRAITALIA', 'PARQUEANTARCTICA'],
    'MARACANA': ['MARACANA', 'ESTADIODOMARACANA', 'JORNALISTAMARIOFILHO'],
    'VILABELMIRO': ['VILABELMIRO', 'URBANOCALDEIRA'],
    'NISSAMSTADIUM': ['INTERNACIONALDEYOKOHAMA', 'YOKOHAMA', 'NISSANSTADIUM'],
    'CENTENARIO': ['CENTENARIO', 'ESTADIOCENTENARIO'],
    'ARENAINDEPENDENCIA': ['ARENAINDEPENDENCIA', 'INDEPENDENCIA', 'ESTADIORAIMUNDOSAMPAIO'],
    'DEFENSORESDELCHACO': ['DEFENSORESDELCHACO'],
    'LABOMBONERA': ['BOMBONERA', 'ALBERTOJARMANDO'],
    'ELCILINDRO': ['PRESIDENTEPERON', 'ELCILINDRO'],
    'MONUMENTALDENUNEZ': ['MONUMENTALDENUNEZ', 'ANTONIOVESPUCIOLIBERTI']
  };

  function getMatchesForStadium(features, stadiumProps) {
    const names = nomesExpandidosEstadio(stadiumProps);
    const aliasGroups = Object.entries(STADIUM_ALIASES_JS)
      .map(([key, aliases]) => [key, ...aliases]);
    const matchNames = expandirNomesEstadioFiltro(names, aliasGroups);

    return features
      .map(feature => feature.properties || {})
      .filter(properties => estadioCorrespondeNomesFiltro(properties, matchNames));
  }

  function findHistoricalStadiumProperties(stadiumProps) {
    const targetNames = nomesExpandidosEstadio(stadiumProps).map(normalizeMatchValue).filter(Boolean);
    const aliases = new Set(targetNames);

    Object.entries(STADIUM_ALIASES_JS).forEach(([key, values]) => {
      const group = [key, ...values].map(normalizeMatchValue);
      if (targetNames.some(name => group.some(alias =>
        name === alias || (alias.length >= 8 && name.includes(alias))
      ))) {
        group.forEach(alias => aliases.add(alias));
      }
    });

    const historyFeatures = Object.values(loadedLayers)
      .filter(layer => layer.config.historico)
      .flatMap(layer => layer.data.features);
    const matchingFeature = historyFeatures.find(feature => {
      const properties = feature.properties || {};
      const historyNames = [
        properties.ESTADIO,
        properties['ESTÁDIO'],
        properties.NOME_OFICIAL,
        properties.Name
      ].map(normalizeMatchValue).filter(Boolean);
      return historyNames.some(name => aliases.has(name) || [...aliases].some(alias =>
        alias === 'PARQUESAOJORGE' ? name === alias : name.includes(alias)
      ));
    });
    if (!matchingFeature) return stadiumProps;
    const historyProperties = { ...matchingFeature.properties };
    if (/^https:\/\/www\.meutimao\.com\.br\/jogo\//.test(stadiumProps.FONTE_PRIMEIRA_PARTIDA || '')) {
      historyProperties.FONTE_PRIMEIRA_PARTIDA = stadiumProps.FONTE_PRIMEIRA_PARTIDA;
    }
    return historyProperties;
  }

  function showStadiumHistory(stadiumProps) {
    const panel = document.getElementById('attr-panel');
    const titleEl = document.getElementById('attr-layer-name');
    const tagEl = document.querySelector('.attr-tag');
    const bodyEl = document.getElementById('attr-body');
    const searchBox = document.querySelector('.attr-search-box');
    if (!panel || !bodyEl) return;

    panel.classList.add('history-view');
    currentSelectedFeatureProps = stadiumProps || {};
    const name = stadiumProps.ESTADIO || stadiumProps['ESTÁDIO'] || stadiumProps.Name || 'Estádio';
    const normalizedNames = [
      name,
      stadiumProps.NOME_OFICIAL
    ].map(normalizarNomeEstadio);
    const curatedDescription = DESCRICOES_ESTADIOS_CORINTHIANS.find(item =>
      item.aliases.some(alias => normalizedNames.some(value => {
        const normalizedAlias = normalizarNomeEstadio(alias);
        return normalizedAlias === 'PARQUESAOJORGE'
          ? value === normalizedAlias
          : value.includes(normalizedAlias);
      }))
    );
    const description = curatedDescription ? '' : String(stadiumProps.DESCRICAO_ORIGINAL || stadiumProps.OBSERVACOES || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/Primeira partida:[\s\S]*$/i, '')
      .trim();
    const officialName = String(stadiumProps.NOME_OFICIAL || '').trim();
    const oldName = obterNomeAntigoEstadio(stadiumProps);
    const debutDate = stadiumProps.DATA_PRIMEIRA_PARTIDA
      ? formatarDataJogo(stadiumProps.DATA_PRIMEIRA_PARTIDA)
      : '';
    const firstMatch = String(stadiumProps.PRIMEIRA_PARTIDA || '').trim();
    const year = Number(stadiumProps.ANO_PRIMEIRA_PARTIDA);
    const narrative = [
      oldName ? `Antigo nome: ${oldName}.` : '',
      officialName && officialName !== name
        ? `Nome ou referência histórica: ${officialName.replace(/[.?!\s]+$/g, '')}.`
        : '',
      curatedDescription ? curatedDescription.resumo : description,
      firstMatch && year
        ? `O acervo registra a primeira partida do Corinthians neste estádio em ${year}${debutDate ? ` (${debutDate})` : ''}: ${firstMatch}.`
        : ''
    ].filter(Boolean);
    const sourceText = [stadiumProps.OBSERVACOES, stadiumProps.DESCRICAO_ORIGINAL].filter(Boolean).join(' ');
    const wikipediaUrls = [...new Set(sourceText.match(/https?:\/\/(?:pt\.)?wikipedia\.org\/[^\s<)]+/gi) || [])];
    const wikiUrl = curatedDescription
      ? curatedDescription.wikipedia
      : wikipediaUrls[0] || `https://pt.wikipedia.org/w/index.php?search=${encodeURIComponent(name)}`;
    const sourceLinks = [
      wikiUrl ? `<a href="${escapeHtml(wikiUrl)}" target="_blank" rel="noopener noreferrer">Wikipedia ↗</a>` : ''
    ].filter(Boolean);

    if (titleEl) titleEl.textContent = name;
    if (tagEl) tagEl.textContent = 'História do estádio';
    if (searchBox) searchBox.style.display = 'none';
    bodyEl.innerHTML = `
      <div class="stadium-history">
        ${narrative.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('') || '<p>Não há descrição histórica disponível para este estádio no acervo.</p>'}
        ${criarResumoEstatisticasEstadio(stadiumProps)}
        <div class="matches-list-title">Todos os jogos do Corinthians neste estádio</div>
        <div id="stadium-match-history" class="brabas-matches-container">
          <div class="attr-hint">Carregando partidas do acervo...</div>
        </div>
        ${sourceLinks.length ? `<div class="stadium-history-sources wikipedia-sources"><strong>Fontes</strong>${sourceLinks.join('')}</div>` : ''}
      </div>
    `;
    destacarCorinthiansEmTexto(panel);
    panel.style.display = 'flex';
    renderStadiumMatchHistory(bodyEl.querySelector('#stadium-match-history'), stadiumProps);
  }

  async function renderStadiumMatchHistory(container, stadiumProps) {
    if (!container) return;
    try {
      const features = await loadMaleMatchArchive();
      if (!container.isConnected || currentSelectedFeatureProps !== stadiumProps) return;

      const matches = getMatchesForStadium(features, stadiumProps)
        .sort((a, b) => String(b.DATA || '').localeCompare(String(a.DATA || '')));
      container.innerHTML = matches.map(game => {
        const outcome = game.RESULTADO === 'VITÓRIA' ? 'win' : game.RESULTADO === 'EMPATE' ? 'draw' : game.RESULTADO === 'DERROTA' ? 'loss' : '';
        const home = game['TIME MANDANTE'] || '';
        const away = game['TIME VISITANTE'] || '';
        const homeCrest = obterMiniaturaClube(home);
        const awayCrest = obterMiniaturaClube(away);
        return `
          <div class="brabas-match-item ${outcome}">
            <div class="match-meta">
              <span class="match-date">${escapeHtml(formatarDataJogo(game.DATA))}</span>
              <span class="jogo-tag comp">${escapeHtml(game.COMPETIÇÃO || '')}</span>
            </div>
            <div class="match-score">
              <span class="mandante ${normalizeMatchValue(home).includes('CORINTHIANS') ? 'corinthians' : ''}"><span class="club-name">${escapeHtml(home)}</span>${homeCrest.src ? `<img class="club-mini-crest" src="${homeCrest.src}" alt="" aria-hidden="true" loading="lazy">` : `<span class="club-mini-crest-fallback" aria-hidden="true">${escapeHtml(homeCrest.initials)}</span>`}</span>
              <span class="score-badge ${outcome}">${escapeHtml(game.PLACAR || 'x')}</span>
              <span class="visitante ${normalizeMatchValue(away).includes('CORINTHIANS') ? 'corinthians' : ''}">${awayCrest.src ? `<img class="club-mini-crest" src="${awayCrest.src}" alt="" aria-hidden="true" loading="lazy">` : `<span class="club-mini-crest-fallback" aria-hidden="true">${escapeHtml(awayCrest.initials)}</span>`}<span class="club-name">${escapeHtml(away)}</span></span>
            </div>
          </div>`;
      }).join('') || '<div class="attr-hint">Nenhuma partida deste estádio foi encontrada no acervo.</div>';
      const title = container.previousElementSibling;
      if (title) title.textContent = `Todos os jogos do Corinthians neste estádio (${matches.length})`;
      destacarCorinthiansEmTexto(container.closest('.attr-panel'));
    } catch (error) {
      container.innerHTML = '<div class="attr-hint">Não foi possível carregar as partidas deste estádio.</div>';
      console.warn('Aviso ao carregar partidas da ficha histórica:', error.message);
    }
  }

  async function showStadiumStatistics(stadiumProps) {
    const panel = document.getElementById('attr-panel');
    const titleEl = document.getElementById('attr-layer-name');
    const tagEl = document.querySelector('.attr-tag');
    const bodyEl = document.getElementById('attr-body');
    const searchBox = document.querySelector('.attr-search-box');
    if (!panel || !bodyEl) return;

    panel.classList.remove('history-view');
    currentSelectedFeatureProps = stadiumProps || {};
    const stadiumName = stadiumProps['ESTÁDIO'] || stadiumProps.ESTADIO || stadiumProps.Name || 'Estádio';
    titleEl.textContent = stadiumName;
    if (tagEl) tagEl.textContent = 'ESTATÍSTICA DE JOGOS';
    if (searchBox) searchBox.style.display = 'none';
    bodyEl.innerHTML = '<div class="attr-hint">Carregando acervo de partidas...</div>';
    panel.style.display = 'flex';

    try {
      const features = await loadMaleMatchArchive();
      const matches = getMatchesForStadium(features, stadiumProps)
        .sort((a, b) => String(b.DATA || '').localeCompare(String(a.DATA || '')));
      const displayedMatches = matches.filter(matchesActiveCompetition);
      const hasCompetitionFilter = activeComp !== 'todas';
      const metricMatches = hasCompetitionFilter ? displayedMatches : matches;
      const useStoredStatistics = !hasCompetitionFilter && metricMatches.length === 0;
      const wins = metricMatches.length
        ? metricMatches.filter(game => game.RESULTADO === 'VITÓRIA').length
        : useStoredStatistics ? (Number(stadiumProps.VITÓRIAS || stadiumProps.VITORIAS) || 0) : 0;
      const draws = metricMatches.length
        ? metricMatches.filter(game => game.RESULTADO === 'EMPATE').length
        : useStoredStatistics ? (Number(stadiumProps.EMPATES) || 0) : 0;
      const losses = metricMatches.length
        ? metricMatches.filter(game => game.RESULTADO === 'DERROTA').length
        : useStoredStatistics ? (Number(stadiumProps.DERROTAS) || 0) : 0;
      const totalCount = hasCompetitionFilter
        ? displayedMatches.length
        : matches.length || Number(stadiumProps.TOTAL_JOGOS) || (wins + draws + losses);
      const resultCount = wins + draws + losses;
      const performance = resultCount
        ? Math.round(((wins * 3 + draws) / (resultCount * 3)) * 100)
        : useStoredStatistics ? (Number(stadiumProps.APROVEITAMENTO_PCT) || 0) : 0;
      const location = formatarEnderecoEstadio(stadiumProps);
      const oldName = obterNomeAntigoEstadio(stadiumProps);

      const debutBanner = stadiumProps.PRIMEIRA_PARTIDA ? `
        <div class="estadio-debut-banner" style="background: color-mix(in srgb, var(--accent) 12%, transparent); border-left: 3px solid var(--accent); padding: 7px 10px; margin: 8px 0; border-radius: 4px; font-size: 11.5px; line-height: 1.4;">
          <strong>1ª Partida:</strong> ${escapeHtml(stadiumProps.PRIMEIRA_PARTIDA)} ${stadiumProps.DATA_PRIMEIRA_PARTIDA ? '(' + escapeHtml(formatarDataJogo(stadiumProps.DATA_PRIMEIRA_PARTIDA)) + ')' : ''}
          ${stadiumProps.COMPETICAO_PRIMEIRA_PARTIDA ? ' · <span class="jogo-tag comp">' + escapeHtml(stadiumProps.COMPETICAO_PRIMEIRA_PARTIDA) + '</span>' : ''}
        </div>
      ` : '';

      const matchesHtml = displayedMatches.map(game => {
        const outcome = game.RESULTADO === 'VITÓRIA' ? 'win' : game.RESULTADO === 'EMPATE' ? 'draw' : game.RESULTADO === 'DERROTA' ? 'loss' : '';
        const home = game['TIME MANDANTE'] || '';
        const away = game['TIME VISITANTE'] || '';
        const homeCrest = obterMiniaturaClube(home);
        const awayCrest = obterMiniaturaClube(away);
        return `
          <div class="brabas-match-item ${outcome}">
            <div class="match-meta">
              <span class="match-date">${escapeHtml(formatarDataJogo(game.DATA))}</span>
              <span class="jogo-tag comp">${escapeHtml(game.COMPETIÇÃO || '')}</span>
            </div>
            <div class="match-score">
              <span class="mandante ${normalizeMatchValue(home).includes('CORINTHIANS') ? 'corinthians' : ''}"><span class="club-name">${escapeHtml(home)}</span>${homeCrest.src ? `<img class="club-mini-crest" src="${homeCrest.src}" alt="" aria-hidden="true" loading="lazy">` : `<span class="club-mini-crest-fallback" aria-hidden="true">${escapeHtml(homeCrest.initials)}</span>`}</span>
              <span class="score-badge ${outcome}">${escapeHtml(game.PLACAR || 'x')}</span>
              <span class="visitante ${normalizeMatchValue(away).includes('CORINTHIANS') ? 'corinthians' : ''}">${awayCrest.src ? `<img class="club-mini-crest" src="${awayCrest.src}" alt="" aria-hidden="true" loading="lazy">` : `<span class="club-mini-crest-fallback" aria-hidden="true">${escapeHtml(awayCrest.initials)}</span>`}<span class="club-name">${escapeHtml(away)}</span></span>
            </div>
          </div>`;
      }).join('');

      bodyEl.innerHTML = `
        <div class="estadio-summary-card">
          <div class="estadio-location">${escapeHtml(location || 'Localização não informada')}</div>
          ${oldName ? `<div class="estadio-cap">Antigo nome: ${escapeHtml(oldName)}</div>` : ''}
          <div class="estadio-cap estadio-capacity">${escapeHtml(formatarCapacidadeEstadio(stadiumProps))}</div>
          ${debutBanner}
          <div class="estadio-metrics-bar">
            <div class="metric"><span class="m-val">${displayedMatches.length}</span> <span class="m-lbl">jogos listados</span></div>
            <div class="metric"><span class="m-val">${totalCount}</span> <span class="m-lbl">jogos</span></div>
            <div class="metric win"><span class="m-val">${wins}</span> <span class="m-lbl">vitórias</span></div>
            <div class="metric draw"><span class="m-val">${draws}</span> <span class="m-lbl">empates</span></div>
            <div class="metric loss"><span class="m-val">${losses}</span> <span class="m-lbl">derrotas</span></div>
            <div class="metric"><span class="m-val">${performance}%</span> <span class="m-lbl">aprov.</span></div>
          </div>
        </div>
        <div class="matches-list-title">Histórico de partidas no estádio (${displayedMatches.length})${activeComp !== 'todas' ? ` · ${escapeHtml(document.getElementById('filter-comp')?.selectedOptions[0]?.textContent || '')}` : ''}</div>
        <div class="brabas-matches-container">${matchesHtml || '<div class="attr-hint">Nenhuma partida desta competição está listada para este estádio.</div>'}</div>
      `;
      destacarCorinthiansEmTexto(panel);
    } catch (error) {
      bodyEl.innerHTML = '<div class="attr-hint">Não foi possível carregar o histórico de partidas.</div>';
      console.warn('Aviso ao carregar histórico do estádio:', error.message);
    }
  }

  /* ==========================================================================
     4. RENDERIZAÇÃO DA BARRA LATERAL (TEMAS & CAMADAS)
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
    const hiddenGroupNames = new Set(['Corinthians', 'Outros times']);

    CATALOGO_TEMAS.forEach(tema => {
      if (!tema.camadas || tema.camadas.length === 0) return;

      const groups = new Map();
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

      const syncGroupSwitches = () => {
        const activeIds = [];
        themeContent.querySelectorAll('.layer-group').forEach(group => {
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
        themeSwitch.checked = activeIds.length > 0;
        if (activeIds.length) themeSwitch.dataset.restoreLayerIds = JSON.stringify(activeIds);
        return activeIds;
      };

      const updateLayerStatus = () => {
        syncGroupSwitches();
        const activeCount = Object.values(loadedLayers)
          .filter(layer => map.hasLayer(layer.leafletLayer)).length;
        const activeBadge = document.getElementById('active-layer-count');
        if (activeBadge) activeBadge.textContent = `${activeCount} ativas`;
        updateJenksLegend();
        applyStadiumFilters();
      };

      const appendLayerRow = (parent, camada, label = camada.nome) => {
        const loaded = loadedLayers[camada.id];
        const isChecked = loaded && map.hasLayer(loaded.leafletLayer);

        const row = document.createElement('div');
        row.className = 'layer-row';
        row.innerHTML = `
          <div class="layer-main">
            <label class="layer-switch-control">
              <input class="layer-switch" type="checkbox" role="switch" ${isChecked ? 'checked' : ''} data-layer-id="${camada.id}">
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
          if (!restoreIds.length) restoreIds = tema.camadas.filter(layer => layer.ativa).map(layer => layer.id);
          if (!restoreIds.length) restoreIds = tema.camadas.map(layer => layer.id);
          themeSwitch.disabled = true;
          try {
            await activateCatalogLayers(restoreIds, themeContent);
          } catch (error) {
            console.warn(`Não foi possível ativar o grupo '${tema.nome}':`, error.message);
          } finally {
            themeSwitch.disabled = false;
          }
        }
        updateLayerStatus();
      };

      groups.forEach((layers, groupName) => {
        const group = document.createElement('section');
        group.className = 'layer-group';
        const initiallyExpanded = !layers.some(layer => layer.grupoRecolhido);
        const groupHeader = document.createElement('div');
        groupHeader.className = 'layer-group-header';
        const groupId = `layer-group-${layers[0].id}`;
        const groupContent = document.createElement('div');
        groupContent.className = 'layer-group-content';
        groupContent.id = `${groupId}-content`;
        const childSwitches = [];
        const activeIds = getActiveIds(layers);

        const groupDisclosure = document.createElement('button');
        groupDisclosure.className = 'layer-group-disclosure';
        groupDisclosure.type = 'button';
        groupDisclosure.setAttribute('aria-expanded', String(initiallyExpanded));
        groupDisclosure.setAttribute('aria-controls', groupContent.id);
        groupDisclosure.title = `${initiallyExpanded ? 'Recolher' : 'Expandir'} ${groupName}`;
        groupDisclosure.innerHTML = `<span class="layer-group-name">${escapeHtml(groupName)}</span><svg class="hierarchy-disclosure-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"></path></svg>`;
        groupContent.hidden = !initiallyExpanded;
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
            if (!restoreIds.length) restoreIds = childSwitches.map(input => input.dataset.layerId);
            groupSwitch.disabled = true;
            try {
              await activateCatalogLayers(restoreIds, groupContent);
            } catch (error) {
              console.warn(`Não foi possível ativar o subgrupo '${groupName}':`, error.message);
            } finally {
              groupSwitch.disabled = false;
            }
          }

          const restoredIds = childSwitches
            .filter(input => loadedLayers[input.dataset.layerId]
              && map.hasLayer(loadedLayers[input.dataset.layerId].leafletLayer))
            .map(input => input.dataset.layerId);
          groupSwitch.checked = restoredIds.length > 0;
          if (restoredIds.length) groupSwitch.dataset.restoreLayerIds = JSON.stringify(restoredIds);
          updateLayerStatus();
        };

        groupHeader.append(groupSwitch, groupDisclosure, groupShareButton);
        group.appendChild(groupHeader);
        [...layers]
          .sort((a, b) => {
            if (a.routeFeatures && b.routeFeatures) {
              const dateOrder = (a.dataJogo || '9999-12-31').localeCompare(b.dataJogo || '9999-12-31');
              return dateOrder || a.nome.localeCompare(b.nome, 'pt-BR');
            }
            return (a.categoria === 'estatistica' ? 0 : 1) - (b.categoria === 'estatistica' ? 0 : 1);
          })
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

    const totalActive = Object.values(loadedLayers).filter(layer => map.hasLayer(layer.leafletLayer)).length;
    const activeBadge = document.getElementById('active-layer-count');
    if (activeBadge) {
      activeBadge.textContent = `${totalActive} ativas`;
    }
    updateJenksLegend();
  }

  function updateJenksLegend() {
    const legend = document.getElementById('jenks-legend');
    const legendContent = document.getElementById('jenks-legend-content');
    const catalogOrder = new Map(CATALOGO_TEMAS.flatMap((theme, themeIndex) =>
      theme.camadas.map((layer, layerIndex) => [
        layer.id,
        themeIndex * 10000 + layerIndex
      ])
    ));
    const activeLayers = Object.values(loadedLayers)
      .filter(layer => map.hasLayer(layer.leafletLayer))
      .sort((a, b) => {
        if (a.config.routeFeatures && b.config.routeFeatures) {
          const dateOrder = (a.config.dataJogo || '9999-12-31')
            .localeCompare(b.config.dataJogo || '9999-12-31');
          return dateOrder || a.config.nome.localeCompare(b.config.nome, 'pt-BR');
        }
        return (catalogOrder.get(a.config.id) ?? Number.MAX_SAFE_INTEGER)
          - (catalogOrder.get(b.config.id) ?? Number.MAX_SAFE_INTEGER);
      });
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

  function syncRouteOriginMarker() {
    if (!map || !routeOriginMarker) return;
    const hasActiveRoute = Object.values(loadedLayers).some(layer =>
      layer.config.routeFeatures && map.hasLayer(layer.leafletLayer)
    );
    if (hasActiveRoute && !map.hasLayer(routeOriginMarker)) {
      routeOriginMarker.addTo(map);
    } else if (!hasActiveRoute && map.hasLayer(routeOriginMarker)) {
      map.removeLayer(routeOriginMarker);
    }
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
    layerObj.leafletLayer = buildLeafletLayer(
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
    updateThemedIcons(currentTheme, [layerId]);
    map.addLayer(target.leafletLayer);
    const checkbox = document.querySelector(`#theme-list input[type="checkbox"][data-layer-id="${layerId}"]`);
    if (checkbox) checkbox.checked = true;
  }

  /* ==========================================================================
     5. PAINEL INFORMATIVO E DADOS DO ESTÁDIO
     ========================================================================== */
  function showFeatureAttributes(layerName, props) {
    const panel = document.getElementById('attr-panel');
    const titleEl = document.getElementById('attr-layer-name');
    const tagEl = document.querySelector('.attr-tag');
    const searchInput = document.getElementById('attr-search-input');
    const searchBox = document.querySelector('.attr-search-box');

    if (!panel) return;

    panel.classList.remove('history-view');
    currentSelectedFeatureProps = props || {};
    titleEl.textContent = layerName || 'Informações da feição';
    if (tagEl) tagEl.textContent = 'INFORMAÇÕES DO ACERVO';
    if (searchBox) searchBox.style.display = '';
    if (searchInput) searchInput.value = '';

    renderAttributesList(currentSelectedFeatureProps, '');
    
    // Abre a ficha e oculta o botão flutuante de reabertura
    panel.style.display = 'flex';
  }

  function renderAttributesList(props, filterText) {
    const bodyEl = document.getElementById('attr-body');
    if (!bodyEl) return;

    // Ignora colunas técnicas internas do QGIS/KML se existirem
    const ignoredKeys = new Set(['altitudeMo', 'tessellate', 'extrude', 'visibility', 'drawOrder', 'icon', 'fid', 'id', 'DESCRICAO_ORIGINAL']);
    
    const entries = Object.entries(props || {}).filter(([k]) => !ignoredKeys.has(k));
    if (entries.length === 0) {
      bodyEl.innerHTML = '<div class="attr-hint">Nenhum detalhe adicional registrado para este ponto.</div>';
      return;
    }

    const filtered = entries.filter(([k, v]) => {
      if (!filterText) return true;
      const q = filterText.toLowerCase();
      return String(k).toLowerCase().includes(q) || String(v).toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      bodyEl.innerHTML = '<div class="attr-hint">Nenhum dado corresponde ao filtro digitado.</div>';
      return;
    }

    const attributeLabels = {
      NOME_ANTIGO: 'Antigo nome',
      FONTES_NOME_ANTIGO: 'Fontes do nome anterior',
      ESTADIO: 'Estádio',
      NOME_OFICIAL: 'Nome oficial',
      CIDADE: 'Cidade',
      ESTADO: 'Estado / Província',
      PAIS: 'País',
      PRIMEIRA_PARTIDA: 'Primeira partida',
      ADVERSARIO: 'Adversário',
      PLACAR: 'Placar',
      DATA_PRIMEIRA_PARTIDA: 'Data da primeira partida',
      ANO_PRIMEIRA_PARTIDA: 'Ano da primeira partida',
      COMPETICAO_PRIMEIRA_PARTIDA: 'Competição',
      MANDO_PRIMEIRA_PARTIDA: 'Mando da 1ª partida',
      TOTAL_JOGOS: 'Total de jogos no estádio',
      VITORIAS: 'Vitórias',
      EMPATES: 'Empates',
      DERROTAS: 'Derrotas',
      APROVEITAMENTO_PCT: 'Aproveitamento (%)',
      GOLS_MARCADOS: 'Gols marcados',
      GOLS_SOFRIDOS: 'Gols sofridos',
      ESTADIOS_COM_ESTREIA_NA_DECADA: 'Estádios com estreia na década',
      OBSERVACOES: 'Observações',
      FONTE_PRIMEIRA_PARTIDA: 'Fonte da primeira partida',
      LATITUDE: 'Latitude',
      LONGITUDE: 'Longitude'
    };

    const hasMatchData = props && (props.ESTADIO || props['ESTÁDIO'] || props.PRIMEIRA_PARTIDA);
    const toggleToStatsHtml = hasMatchData ? `
      <div style="margin-bottom: 12px;">
        <button id="btn-toggle-stats-view" style="width: 100%; font-size: 11px; padding: 6px; background: color-mix(in srgb, var(--accent) 15%, transparent); border: 1px solid var(--accent); border-radius: 4px; color: inherit; cursor: pointer; font-weight: 600;">
          Ver Estatísticas e Histórico de Partidas
        </button>
      </div>
    ` : '';

    const html = toggleToStatsHtml + filtered.map(([key, val]) => {
      const cleanKey = attributeLabels[key] || key.replace(/_/g, ' ');
      const cleanVal = formatAttributeValue(val);
      return `
        <div class="attr-row">
          <span class="attr-key">${escapeHtml(cleanKey)}</span>
          <span class="attr-val">${cleanVal}</span>
        </div>
      `;
    }).join('');

    bodyEl.innerHTML = html;
    destacarCorinthiansEmTexto(bodyEl);

    const btnStatsToggle = document.getElementById('btn-toggle-stats-view');
    if (btnStatsToggle) {
      btnStatsToggle.onclick = () => {
        showStadiumStatistics(props);
      };
    }
  }

  function formatAttributeValue(val) {
    if (val === null || val === undefined) return '';
    let str = String(val);
    str = str.replace(/<br\s*\/?>/gi, '\n');
    str = str.replace(/<\/?[^>]+(>|$)/g, '');
    return escapeHtml(str).replace(/\n/g, '<br>');
  }

    /* ==========================================================================
      6. ESTATÍSTICAS HISTÓRICAS DO TIMÃO & FILTROS
      ========================================================================== */
  let activeComp = 'todas';

  function matchesActiveCompetition(properties) {
    if (activeComp === 'todas') return true;

    const comp = normalizarNomeEstadio(properties['COMPETIÇÃO'] || properties.COMPETICAO || '');
    if (activeComp === 'AMISTOSO') return comp.includes('AMISTOSO');
    if (activeComp === 'MUNDIAL') return comp.includes('MUNDIAL');
    if (activeComp === 'LIBERTADORES') return comp.includes('LIBERTADORES');
    if (activeComp === 'SUL-AMERICANA') return comp.includes('SULAMERICANA');
    if (activeComp === 'BRASILEIRO') {
      return ['BRASILEIRO', 'BRASILEIRAO', 'ROBERTAO', 'TACABRASIL']
        .some(term => comp.includes(term));
    }
    if (activeComp === 'COPA DO BRASIL') return comp.includes('COPADOBRASIL');
    if (activeComp === 'PAULISTA') return comp.includes('PAULISTA');
    if (activeComp === 'RIO-SAO PAULO') return comp.includes('RIOSAOPAULO');
    if (activeComp === 'INTERNACIONAL') {
      return ehCompeticaoInternacional(properties);
    }
    return true;
  }

  async function applyStadiumFilters() {
    if (obterShareIdSolicitado()) return;

    let filteredGames = [];
    if (activeComp !== 'todas') {
      let allMatches;
      try {
        allMatches = await loadMaleMatchArchive();
      } catch (error) {
        console.warn('Aviso ao filtrar partidas masculinas:', error.message);
        return;
      }
      filteredGames = allMatches.filter(feature =>
        matchesActiveCompetition(feature.properties || {})
      );
    }
    const activeStadiumNames = filteredGames.flatMap(feature => {
      const properties = feature.properties || {};
      return [properties['ESTÁDIO'], properties.ESTADIO, properties['ESTÁDIO_ORIGINAL']];
    }).filter(Boolean);
    const activeStadiumNorms = expandirNomesEstadioFiltro(activeStadiumNames);
    const stadiumFeatures = Object.values(loadedLayers)
      .filter(layerObj => !layerObj.config.fronteiraPais
        && (layerObj.config.classificacao === 'jenks' || layerObj.config.estatisticasIncorporadas))
      .flatMap(layerObj => layerObj.data.features || []);
    const countryFeatures = Object.values(loadedLayers)
      .filter(layerObj => layerObj.config.fronteiraPais)
      .flatMap(layerObj => layerObj.data.features || []);
    const activeCountryCodes = activeComp === 'todas'
      ? null
      : obterCodigosPaisesDasPartidas(filteredGames, stadiumFeatures, countryFeatures);

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
        const visible = activeComp === 'todas'
          || estadioCorrespondeNomesFiltro(properties, activeStadiumNorms);
        marker.options.atlasFilterHidden = !visible;
        marker.options.interactive = visible;
        const element = marker.getElement && marker.getElement();
        if (element) element.style.pointerEvents = visible ? '' : 'none';

        if (typeof marker.setOpacity === 'function') {
          marker.setOpacity(visible ? op : 0);
        } else if (marker instanceof L.CircleMarker) {
          marker.setStyle({
            opacity: visible ? op : 0,
            fillOpacity: visible
              ? op * (layerObj.config.classificacao === 'jenks' ? 0.62 : 1)
              : 0
          });
        } else if (typeof marker.setStyle === 'function') {
          marker.setStyle({ opacity: visible ? op : 0, fillOpacity: visible ? op * 0.25 : 0 });
        }
      });
    });

    const countBadge = document.getElementById('filtered-stadium-count');
    if (countBadge) {
      if (activeComp === 'todas') {
        countBadge.textContent = `${getMappedStadiumCount()} estádios`;
      } else {
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
                if (!estadioCorrespondeNomesFiltro(stadiumProperties, activeStadiumNorms)) return;
                displayedStadiums.add(chaveIdentidadeEstadio(stadium));
              });
            });
          });
        countBadge.textContent = `${displayedStadiums.size} estádios (${filteredGames.length} jogos)`;
      }
    }
  }

  function updateStats() {
    const container = document.getElementById('stats-grid');
    if (!container) return;

    const statisticsLayer = loadedLayers.estadios_estatisticas_unificadas;
    if (!statisticsLayer) {
      console.warn('Não foi possível exibir os números: a camada estatística combinada não está carregada.');
      return;
    }
    const totals = resumirEstatisticasEstadios(statisticsLayer.data.features);
    const performance = totals.jogos
      ? Math.round(((totals.vitorias * 3 + totals.empates) / (totals.jogos * 3)) * 100)
      : 0;
    const mappedStadiumCount = getMappedStadiumCount();
    const officialTitles = 51;

    const stats = [
      { label: 'Títulos Oficiais', value: officialTitles.toLocaleString('pt-BR') },
      { label: 'Total de Jogos', value: totals.jogos.toLocaleString('pt-BR') },
      { label: 'Aproveitamento', value: `${performance}%` },
      { label: 'Gols Marcados', value: totals.gols.toLocaleString('pt-BR') },
      { label: 'Vitórias', value: totals.vitorias.toLocaleString('pt-BR') },
      { label: 'Estádios Mapeados', value: mappedStadiumCount.toLocaleString('pt-BR') }
    ];

    container.innerHTML = stats.map(s => `
      <div class="stat-card">
        <div class="label">${s.label}</div>
        <div class="value">${s.value}</div>
      </div>
    `).join('');

    const countBadge = document.getElementById('filtered-stadium-count');
    if (countBadge) countBadge.textContent = `${mappedStadiumCount} estádios`;
  }

  function getMappedStadiumCount() {
    const stadiumIdentities = new Set();
    Object.values(loadedLayers)
      .filter(layer => layer.config.classificacao === 'jenks' && map.hasLayer(layer.leafletLayer))
      .forEach(layer => {
        layer.data.features.forEach(feature => {
          const properties = feature.properties || {};
          if (feature.geometry?.type !== 'Point') return;
          obterEstadiosNoPonto(properties).forEach(stadium => {
            if (stadium.jogos > 0) stadiumIdentities.add(chaveIdentidadeEstadio(stadium));
          });
        });
      });
    return stadiumIdentities.size;
  }

  /* ==========================================================================
     7. GERENCIAMENTO DE TEMA
     ========================================================================== */
  function updateThemedIcons(theme, layerIds = Object.keys(loadedLayers)) {
    layerIds
      .map(layerId => loadedLayers[layerId])
      .filter(Boolean)
      .forEach(layerObj => {
        const cfg = layerObj.config;
        if (cfg.routeFeatures) {
          if (layerObj.leafletLayer && cfg.routeThemeColors) {
            layerObj.leafletLayer.setStyle({ color: obterCorRota(cfg, theme) });
          }
          return;
        }
        if (layerObj.leafletLayer) {
        const markerStyle = obterEstiloManchaEstadio(theme, cfg.opacidade !== undefined ? cfg.opacidade : 1, cfg.cor || ATLAS_JENKS_COLOR, map.getZoom());
        layerObj.leafletLayer.eachLayer(marker => {
          if (!(marker instanceof L.CircleMarker)) return;
          marker.setStyle(marker.options.atlasFilterHidden
            ? { ...markerStyle, opacity: 0, fillOpacity: 0 }
            : markerStyle);
        });
      }
      if (cfg.escudosHistoricos && layerObj.leafletLayer) {
        layerObj.leafletLayer.eachLayer(marker => {
          const properties = marker.feature && marker.feature.properties;
          if (!properties || typeof marker.setIcon !== 'function') return;
          if (cfg.estatisticasIncorporadas) {
            marker.setIcon(criarIconeLocalizacaoEstatistica(properties, cfg, theme));
            return;
          }
          const iconUrl = resolverEscudoHistorico(properties, theme, cfg.icone);
          if (!iconUrl) return;
          const size = cfg.tamanhoIcone || [26, 26];
          marker.setIcon(L.icon({
            iconUrl: iconUrl,
            iconSize: size,
            iconAnchor: [size[0] / 2, size[1] / 2],
            popupAnchor: [0, -size[1] / 2],
            className: 'custom-image-marker'
          }));
        });
        return;
      }
      if (cfg.iconeDark && cfg.iconeLight && layerObj.leafletLayer) {
        const iconUrl = theme === 'light' ? cfg.iconeLight : cfg.iconeDark;
        const size = cfg.tamanhoIcone || [26, 26];
        const newIcon = L.icon({
          iconUrl: iconUrl,
          iconSize: size,
          iconAnchor: [size[0] / 2, size[1] / 2],
          popupAnchor: [0, -size[1] / 2],
          className: 'custom-image-marker'
        });
        layerObj.leafletLayer.eachLayer(marker => {
          if (marker && typeof marker.setIcon === 'function') {
            marker.setIcon(newIcon);
          }
        });
      }
    });
  }

  function applyTheme(theme, syncBasemap = true) {
    currentTheme = theme;
    document.body.dataset.theme = theme;
    localStorage.setItem('atlas1910_theme', theme);

    const mapToggleBtn = document.getElementById('map-theme-toggle');
    if (mapToggleBtn) {
      mapToggleBtn.setAttribute('aria-pressed', String(theme === 'light'));
      mapToggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
      mapToggleBtn.title = theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro';
    }

    // Atualiza logotipo: dark usa PRETO-TRANSPARENTE.png, light usa BRANCO-TRANSPARENTE.png
    const logoImg = document.getElementById('site-logo');
    if (logoImg) {
      logoImg.src = theme === "dark" ? "assets/PRETO-TRANSPARENTE.png" : "assets/BRANCO-TRANSPARENTE.png";
    }

    // Atualiza logo das Brabas de acordo com o modo visual:
    // O tema controla as variantes visuais da identidade feminina.
    const brabasImg = document.getElementById('brabas-icon-img');
    if (brabasImg) {
      brabasImg.src = theme === "dark" ? "assets/brabas-dark.png" : "assets/brabas-light.png";
    }
    const floatingBrabasImg = document.getElementById('floating-brabas-img');
    if (floatingBrabasImg) {
      floatingBrabasImg.src = theme === "dark" ? "assets/brabas-dark.png" : "assets/brabas-light.png";
    }

    // Atualiza ícones com suporte a variantes claro/escuro (ex: campos mandante)
    updateThemedIcons(theme);

    if (syncBasemap && typeof BasemapManager !== 'undefined') {
      BasemapManager.onThemeChange(theme);
    }
    updateJenksLegend();
  }

  function toggleTheme() {
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme, true);
  }

  /* ==========================================================================
     8. CONTROLES DA SIDEBAR (RECOLHER/EXPANDIR DESKTOP + DRAWER MOBILE)
     ========================================================================== */
  function setupSidebarControls() {
    const sidebar        = document.getElementById('sidebar');
    const collapseBtn    = document.getElementById('btn-sidebar-collapse');
    const expandBtn      = document.getElementById('btn-sidebar-expand');
    const layerPanelBtn  = document.getElementById('btn-layer-panel');
    const mobileCloseBtn = document.getElementById('btn-mobile-close');
    const backdrop       = document.getElementById('drawer-backdrop');

    // Desktop - recolher painel de camadas
    if (collapseBtn) {
      collapseBtn.addEventListener('click', function() {
        sidebar.classList.add('collapsed');
        if (expandBtn) expandBtn.classList.add('visible');
        setTimeout(() => { if (map) map.invalidateSize(); }, 320);
      });
    }

    // Desktop - expandir painel de camadas
    if (expandBtn) {
      expandBtn.addEventListener('click', function() {
        sidebar.classList.remove('collapsed');
        expandBtn.classList.remove('visible');
        setTimeout(() => { if (map) map.invalidateSize(); }, 320);
      });
    }

    // Mobile - abrir gaveta de camadas
    function openMobileDrawer() {
      sidebar.classList.remove('mobile-hidden');
      if (backdrop) backdrop.classList.add('active');
      setTimeout(() => { if (map) map.invalidateSize(); }, 300);
    }

    // Mobile - fechar gaveta de camadas
    function closeMobileDrawer() {
      sidebar.classList.add('mobile-hidden');
      if (backdrop) backdrop.classList.remove('active');
      setTimeout(() => { if (map) map.invalidateSize(); }, 300);
    }

    if (layerPanelBtn) {
      layerPanelBtn.addEventListener('click', function() {
        if (window.innerWidth <= 820) {
          openMobileDrawer();
          return;
        }
        sidebar.classList.remove('collapsed');
        if (expandBtn) expandBtn.classList.remove('visible');
        setTimeout(() => { if (map) map.invalidateSize(); }, 320);
      });
    }

    if (mobileCloseBtn) {
      mobileCloseBtn.addEventListener('click', closeMobileDrawer);
    }

    if (backdrop) {
      backdrop.addEventListener('click', closeMobileDrawer);
    }

    // Sincronização ao redimensionar tela (desktop <-> mobile)
    window.addEventListener('resize', function() {
      const isMobile = window.innerWidth <= 820;
      if (!isMobile) {
        sidebar.classList.remove('mobile-hidden');
        if (backdrop) backdrop.classList.remove('active');
      } else {
        if (sidebar.classList.contains('mobile-hidden') && backdrop) backdrop.classList.remove('active');
      }
      if (map) map.invalidateSize();
    });
  }

  /* ==========================================================================
     9. OUVINTES DE EVENTOS DA INTERFACE
     ========================================================================== */
  function setupUIEvents() {
    const themeListEl = document.getElementById('theme-list');

    const mapThemeToggleBtn = document.getElementById('map-theme-toggle');
    if (mapThemeToggleBtn) {
      mapThemeToggleBtn.onclick = toggleTheme;
    }

    // Controles de recolher/expandir sidebar e mobile drawer
    setupSidebarControls();

    const numbersOpenButton = document.getElementById('btn-numbers-open');
    const numbersDialog = document.getElementById('numbers-dialog');
    if (numbersOpenButton && numbersDialog) {
      numbersOpenButton.addEventListener('click', () => {
        updateStats();
        numbersDialog.showModal();
      });
      numbersDialog.addEventListener('click', event => {
        if (event.target === numbersDialog) numbersDialog.close();
      });
    }

    // Ligar / Desligar Camadas
    themeListEl.addEventListener('change', async function(e) {
      if (e.target.dataset.layerId) {
        const input = e.target;
        const id = input.dataset.layerId;
        let layerInfo = loadedLayers[id];
        if (input.checked && !layerInfo) {
          input.disabled = true;
          try {
            layerInfo = await ensureCatalogLayerLoaded(id);
          } catch (error) {
            input.checked = false;
            console.warn('Não foi possível carregar a camada:', error.message);
          } finally {
            input.disabled = false;
          }
        }
        if (layerInfo) {
          if (input.checked) {
            enableLayerExclusive(id);
          } else {
            map.removeLayer(layerInfo.leafletLayer);
          }
        }

        const group = e.target.closest('.layer-group');
        const groupSwitch = group && group.querySelector('.group-layer-switch');
        if (groupSwitch) {
          const activeIds = [...group.querySelectorAll('input.layer-switch[data-layer-id]')]
            .filter(input => loadedLayers[input.dataset.layerId]
              && map.hasLayer(loadedLayers[input.dataset.layerId].leafletLayer))
            .map(input => input.dataset.layerId);
          groupSwitch.checked = activeIds.length > 0;
          if (activeIds.length) groupSwitch.dataset.restoreLayerIds = JSON.stringify(activeIds);
        }

        const themeRoot = e.target.closest('.theme-layer-root');
        if (themeRoot) {
          const themeSwitch = themeRoot.querySelector('.theme-group-switch');
          const themeContent = themeRoot.querySelector('.theme-layer-content');
          const activeIds = [...themeRoot.querySelectorAll('.layer-group-content input.layer-switch[data-layer-id]')]
            .filter(input => loadedLayers[input.dataset.layerId]
              && map.hasLayer(loadedLayers[input.dataset.layerId].leafletLayer))
            .map(input => input.dataset.layerId);
          themeSwitch.checked = activeIds.length > 0;
          if (activeIds.length) {
            themeSwitch.dataset.restoreLayerIds = JSON.stringify(activeIds);
          }
        }

        // Atualiza badge de contagem
        let totalActive = 0;
        Object.values(loadedLayers).forEach(l => {
          if (map.hasLayer(l.leafletLayer)) totalActive++;
        });
        const activeBadge = document.getElementById('active-layer-count');
        if (activeBadge) activeBadge.textContent = `${totalActive} ativas`;
        updateJenksLegend();
        applyStadiumFilters();
      }
    });

    // Zoom para Camada
    themeListEl.addEventListener('click', async function(e) {
      const shareButton = e.target.closest('.share-btn');
      if (shareButton) {
        const originalLabel = shareButton.getAttribute('aria-label');
        copiarLinkSubgrupo(shareButton.dataset.subgroupShareId).then(() => {
          shareButton.title = 'Link copiado';
          shareButton.setAttribute('aria-label', 'Link copiado');
          shareButton.classList.add('copied');
          setTimeout(() => {
            shareButton.title = 'Copiar link deste subgrupo';
            shareButton.setAttribute('aria-label', originalLabel);
            shareButton.classList.remove('copied');
          }, 1600);
        }).catch(error => console.warn('Não foi possível copiar o link:', error.message));
        return;
      }

      const zoomBtn = e.target.closest('.zoom-btn');
      if (zoomBtn) {
        const id = zoomBtn.dataset.layerId;
        let layerInfo = loadedLayers[id];
        if (!layerInfo) {
          try {
            layerInfo = await ensureCatalogLayerLoaded(id);
          } catch (error) {
            console.warn('Não foi possível carregar a camada para aproximar:', error.message);
          }
        }
        if (layerInfo && layerInfo.leafletLayer && layerInfo.leafletLayer.getBounds) {
          try {
            enableLayerExclusive(id);
            let totalActive = 0;
            Object.values(loadedLayers).forEach(layer => {
              if (map.hasLayer(layer.leafletLayer)) totalActive++;
            });
            const activeBadge = document.getElementById('active-layer-count');
            if (activeBadge) activeBadge.textContent = `${totalActive} ativas`;
            updateJenksLegend();
            const bounds = layerInfo.fullBounds || layerInfo.leafletLayer.getBounds();
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
            }
          } catch (err) {
            console.warn("Erro ao ajustar zoom:", err);
          }
        }
      }
    });

    // Painel informativo do estádio
    const attrPanel = document.getElementById('attr-panel');
    const attrCloseBtn = document.getElementById('attr-close-btn');

    // Minimizar / Fechar ficha
    if (attrCloseBtn) {
      attrCloseBtn.onclick = () => {
        attrPanel.style.display = 'none';
      };
    }

    const searchInput = document.getElementById('attr-search-input');
    if (searchInput) {
      searchInput.oninput = (e) => {
        if (currentSelectedFeatureProps) {
          renderAttributesList(currentSelectedFeatureProps, e.target.value);
        }
      };
    }

    // ═══ FILTROS ESPACIAIS & DE COMPETIÇÃO ═══
    const compSelect = document.getElementById('filter-comp');
    if (compSelect) {
      compSelect.onchange = function() {
        activeComp = this.value;
        applyStadiumFilters();
      };
    }

    // ═══ POP-UP MODAL: COLABORE COM O PROJETO ═══
    const colaboreToggleBtn = document.getElementById('btn-colabore-toggle');
    const colaborePanel     = document.getElementById('colabore-panel');
    const colaboreCloseBtn  = document.getElementById('colabore-close-btn');
    const colaboreBackdrop  = document.getElementById('colabore-backdrop');
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

    if (colaboreToggleBtn) {
      colaboreToggleBtn.onclick = () => {
        if (colaborePanel && colaborePanel.classList.contains('active')) {
          closeColaborePopup();
        } else {
          // Ao abrir manualmente, registra para não incomodar no timer automático
          localStorage.setItem(COLABORE_SHOWN_KEY, 'true');
          openColaborePopup();
        }
      };
    }

    if (colaboreCloseBtn) {
      colaboreCloseBtn.onclick = closeColaborePopup;
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

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Inicializa quando o DOM estiver carregado
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
