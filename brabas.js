/**
 * ==========================================================================
 * ATLAS1910 — AS BRABAS (Futebol Feminino do Corinthians)
 * Módulo Especializado de Mapeamento, Estatísticas e Inspeção Histórica
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
  let activeEra = "todas";
  let activeCompeticao = "todas";
  let activeMando = "todos";

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

  /* ==========================================================================
     1. INICIALIZAÇÃO
     ========================================================================== */
  async function init() {
    const savedTheme = localStorage.getItem('atlas1910_theme') || "dark";
    applyTheme(savedTheme, false);

    // Mapa otimizado — desabilitando animações que causam descompasso entre tiles e camadas
    map = L.map('map', {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
      zoomAnimation: false,      // Desabilita animação de zoom para sincronização perfeita
      markerZoomAnimation: false, // Evita descompasso entre tiles e camadas
      fadeAnimation: false,
      zoomSnap: 1,
      zoomDelta: 1,
      wheelPxPerZoomLevel: 100,
      wheelDebounceTime: 40
    }).setView([-23.5505, -46.6333], 8);

    BasemapManager.init(map, currentTheme);

    setupProtection();
    await loadBrabasData();
    await loadAllCatalogLayers();
    renderThemesUI();
    renderBrabasStats();
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
  async function loadBrabasData() {
    try {
      const [resJogos, resEstadios] = await Promise.all([
        fetch('data/as_brabas/as_brabas_jogos.geojson'),
        fetch('data/as_brabas/as_brabas_estadios.geojson')
      ]);

      if (resJogos.ok) {
        const dataJogos = await resJogos.json();
        rawJogos = (dataJogos.features || []).map(f => f.properties);
      }
      if (resEstadios.ok) {
        const dataEst = await resEstadios.json();
        rawEstadios = dataEst.features || [];
      }
    } catch (err) {
      console.warn("Aviso ao carregar dados brutos das Brabas:", err);
    }
  }

  /* ==========================================================================
     3. CARREGAMENTO DAS CAMADAS DO CATÁLOGO DAS BRABAS
     ========================================================================== */
  async function loadAllCatalogLayers() {
    if (typeof CATALOGO_TEMAS_BRABAS === 'undefined') {
      console.error("CATALOGO_TEMAS_BRABAS não definido em js/camadas.js");
      return;
    }

    for (const tema of CATALOGO_TEMAS_BRABAS) {
      for (const camada of tema.camadas) {
        try {
          let geojson = null;
          if (camada.arquivo) {
            const resp = await fetch(camada.arquivo);
            if (!resp.ok) throw new Error(`Status HTTP ${resp.status}`);
            geojson = await resp.json();
          } else if (camada.dados) {
            geojson = camada.dados;
          }

          if (geojson && geojson.features) {
            const leafletLayer = buildBrabasLeafletLayer(geojson, camada, tema.cor);
            
            loadedLayers[camada.id] = {
              leafletLayer,
              data: geojson,
              count: geojson.features.length,
              config: camada,
              themeId: tema.id
            };

            if (camada.ativa) {
              leafletLayer.addTo(map);
            }
          }
        } catch (err) {
          console.warn(`Aviso: Camada '${camada.nome}' (${camada.arquivo}) não pôde ser carregada:`, err.message);
        }
      }
    }
  }

  function buildBrabasLeafletLayer(geojson, layerConfig, themeColor) {
    const defaultColor = layerConfig.cor || themeColor || '#c084fc';
    const opacity = layerConfig.opacidade !== undefined ? layerConfig.opacidade : 1;

    return L.geoJSON(geojson, {
      pointToLayer: function(feature, latlng) {
        const p = feature.properties || {};

        // Se a camada possui ícone customizado com suporte a variante dark/light
        if (layerConfig.iconeDark && layerConfig.iconeLight) {
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
        if (layerConfig.icone) {
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
        const isEstatisticasLayer = layerConfig.id === "brabas_todos_com_estatisticas";
        const totalJogos = Number(p.TOTAL_JOGOS || p['TOTAL_JOGOS'] || 1);
        const radius = isEstatisticasLayer 
          ? Math.min(Math.max(6 + Math.log2(totalJogos + 1) * 2.4, 6.5), 18)
          : 7.5;

        // Destaque para palcos históricos
        const isPrincipal = estNome.includes("PARQUE SÃO JORGE") || estNome.includes("FAZENDINHA") || estNome.includes("NEO QUÍMICA");
        const fillColor = isPrincipal ? "#e879f9" : defaultColor;

        return L.circleMarker(latlng, {
          radius: radius,
          fillColor: fillColor,
          color: currentTheme === 'light' ? '#4c1d95' : '#ffffff',
          weight: 1.5,
          opacity: 0.95 * opacity,
          fillOpacity: 0.85 * opacity
        });
      },
      onEachFeature: function(feature, layer) {
        layer.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          const p = feature.properties || {};
          const estNome = (p['ESTÁDIO'] || p['EST\ufffdDIO'] || '').trim();
          const normTarget = normalizeStadiumName(estNome);
          
          // Buscar todos os jogos deste estádio com correspondência normalizada
          const jogosDoEstadio = rawJogos.filter(j => {
            const jEst = (j['ESTÁDIO'] || j['EST\ufffdDIO'] || '').trim();
            return normalizeStadiumName(jEst) === normTarget;
          });

          showEstadioDetails(p, jogosDoEstadio);
        });
      }
    });
  }

  /* ==========================================================================
     4. RENDERIZAÇÃO DA BARRA LATERAL (TEMAS & CAMADAS — MESMA LÓGICA DA HOME)
     ========================================================================== */
  function renderThemesUI() {
    const container = document.getElementById('theme-list');
    if (!container) return;

    container.innerHTML = '';
    let totalActive = 0;

    CATALOGO_TEMAS_BRABAS.forEach(tema => {
      if (!tema.camadas || tema.camadas.length === 0) return;

      const details = document.createElement('details');
      details.className = 'theme-card';
      details.open = true;

      const summary = document.createElement('summary');
      summary.innerHTML = `
        <span class="theme-color-dot" style="background:${tema.cor}"></span>
        <span class="theme-title-text">${escapeHtml(tema.nome)}</span>
        <span class="theme-layer-count">${tema.camadas.length} ${tema.camadas.length === 1 ? 'camada' : 'camadas'}</span>
      `;
      details.appendChild(summary);

      tema.camadas.forEach(camada => {
        const loaded = loadedLayers[camada.id];
        const isChecked = loaded && map.hasLayer(loaded.leafletLayer);
        if (isChecked) totalActive++;

        const row = document.createElement('div');
        row.className = 'layer-row';
        row.innerHTML = `
          <div class="layer-main">
            <label>
              <input type="checkbox" ${isChecked ? 'checked' : ''} data-layer-id="${camada.id}">
              <span class="layer-name" title="${escapeHtml(camada.nome)}">${escapeHtml(camada.nome)}</span>
            </label>
            <div class="layer-actions">
              <button class="action-btn zoom-btn" title="Aproximar visualização" data-layer-id="${camada.id}">🔍</button>
            </div>
          </div>
          <div class="layer-controls">
            <span class="opacity-val">${Math.round((camada.opacidade || 1) * 100)}%</span>
            <input type="range" min="0" max="100" value="${Math.round((camada.opacidade || 1) * 100)}" data-layer-id="${camada.id}">
          </div>
        `;
        details.appendChild(row);
      });

      container.appendChild(details);
    });

    const activeBadge = document.getElementById('active-layer-count');
    if (activeBadge) {
      activeBadge.textContent = `${totalActive} ativas`;
    }

    // Ouvintes de checkbox, zoom e opacidade
    container.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      chk.onchange = function() {
        const layerId = this.dataset.layerId;
        const layerObj = loadedLayers[layerId];
        if (!layerObj) return;

        if (this.checked) {
          map.addLayer(layerObj.leafletLayer);
        } else {
          map.removeLayer(layerObj.leafletLayer);
        }
        updateActiveCount();
        applyFiltersToActiveLayers();
      };
    });

    container.querySelectorAll('.zoom-btn').forEach(btn => {
      btn.onclick = function() {
        const layerId = this.dataset.layerId;
        const layerObj = loadedLayers[layerId];
        if (!layerObj) return;

        if (!map.hasLayer(layerObj.leafletLayer)) {
          map.addLayer(layerObj.leafletLayer);
          const chk = container.querySelector(`input[type="checkbox"][data-layer-id="${layerId}"]`);
          if (chk) chk.checked = true;
          updateActiveCount();
        }

        try {
          const bounds = layerObj.leafletLayer.getBounds();
          if (bounds && bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
          }
        } catch (e) {
          console.warn("Erro ao aproximar camada:", e);
        }
      };
    });

    container.querySelectorAll('input[type="range"]').forEach(slider => {
      slider.oninput = function() {
        const layerId = this.dataset.layerId;
        const layerObj = loadedLayers[layerId];
        if (!layerObj) return;

        const val = parseInt(this.value, 10) / 100;
        const label = this.parentElement.querySelector('.opacity-val');
        if (label) label.textContent = `${Math.round(val * 100)}%`;

        layerObj.config.opacidade = val;
        layerObj.leafletLayer.eachLayer(marker => {
          if (typeof marker.setOpacity === 'function') {
            marker.setOpacity(val);
          } else if (typeof marker.setStyle === 'function') {
            marker.setStyle({
              opacity: 0.95 * val,
              fillOpacity: 0.85 * val
            });
          }
        });
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

  /* ==========================================================================
     5. FILTROS INTERATIVOS & SINCRONIZAÇÃO
     ========================================================================== */
  function applyFiltersToActiveLayers() {
    // Filtrar jogos de acordo com os filtros selecionados
    const filteredJogos = rawJogos.filter(j => {
      // 1. Filtro Período (Antes de 2016 vs Depois da Reativação)
      if (activeEra === "ate_2016") {
        const eraStr = (j.ERA || "").toLowerCase();
        const ano = parseFloat(j["ANO JOGO"]) || 0;
        if (!eraStr.includes("2016") && ano > 2016) return false;
        if (eraStr.includes("depois")) return false;
      }
      if (activeEra === "depois_2016") {
        const eraStr = (j.ERA || "").toLowerCase();
        const ano = parseFloat(j["ANO JOGO"]) || 0;
        if (!eraStr.includes("depois") && ano < 2016) return false;
      }

      // 2. Filtro Competição
      if (activeCompeticao !== "todas") {
        const comp = (j["COMPETIÇÃO"] || j["COMPETI\ufffd\ufffdO"] || "").toUpperCase();
        if (activeCompeticao === "INTERNACIONAL") {
          const pais = (j["PAÍS"] || j["PA\ufffdS"] || "").trim().toUpperCase();
          const isIntlComp = comp.includes("LIBERTADORES") || comp.includes("FIFA") || comp.includes("TEAL") || comp.includes("ROSARIO");
          if (!isIntlComp && pais === "BRASIL") return false;
        } else if (!comp.includes(activeCompeticao.toUpperCase())) {
          return false;
        }
      }

      // 3. Filtro Mando
      if (activeMando !== "todos") {
        const isMandante = j["MANDANTE / VISITANTE (SCCP)"] === "Sim" || j["TIME MANDANTE"] === "CORINTHIANS";
        const isNeutro = j["MANDANTE / VISITANTE (SCCP)"] === "Neutro";
        if (activeMando === "mandante" && !isMandante) return false;
        if (activeMando === "visitante" && (isMandante || isNeutro)) return false;
        if (activeMando === "neutro" && !isNeutro) return false;
      }

      return true;
    });

    const activeStadiumNorms = new Set(filteredJogos.map(j => normalizeStadiumName(j["ESTÁDIO"] || j["EST\ufffdDIO"])));

    Object.values(loadedLayers).forEach(layerObj => {
      if (!map.hasLayer(layerObj.leafletLayer)) return;

      layerObj.leafletLayer.eachLayer(marker => {
        const f = marker.feature;
        if (!f || !f.properties) return;
        const estNome = f.properties['ESTÁDIO'] || f.properties['EST\ufffdDIO'] || '';
        const norm = normalizeStadiumName(estNome);

        const match = activeStadiumNorms.has(norm);
        const op = layerObj.config.opacidade !== undefined ? layerObj.config.opacidade : 1;

        if (typeof marker.setOpacity === 'function') {
          marker.setOpacity(match ? op : 0.12 * op);
        } else if (typeof marker.setStyle === 'function') {
          marker.setStyle(match ? {
            opacity: 0.95 * op,
            fillOpacity: 0.85 * op
          } : {
            opacity: 0.15 * op,
            fillOpacity: 0.05 * op
          });
        }
      });
    });

    const countBadge = document.getElementById('filtered-stadium-count');
    if (countBadge) {
      countBadge.textContent = `${activeStadiumNorms.size} estádios (${filteredJogos.length} jogos)`;
    }
  }

  /* ==========================================================================
     6. ESTATÍSTICAS HISTÓRICAS DAS BRABAS
     ========================================================================== */
  function renderBrabasStats() {
    const totalJogos = rawJogos.length;
    const vitorias = rawJogos.filter(j => j["RESULTADO"] === "VITÓRIA").length;
    const empates = rawJogos.filter(j => j["RESULTADO"] === "EMPATE").length;
    const derrotas = rawJogos.filter(j => j["RESULTADO"] === "DERROTA").length;
    const golsPro = rawJogos.reduce((acc, j) => acc + (parseInt(j["GOLS SCCP"]) || 0), 0);
    const titulos = 19; // 5 Libertadores, 6 Brasileiros, 4 Paulistas, 3 Supercopas, 1 Copa BR

    const aproveitamento = totalJogos > 0 ? Math.round(((vitorias * 3 + empates) / (totalJogos * 3)) * 100) : 0;

    const stats = [
      { label: '🏆 Títulos Oficiais', value: titulos },
      { label: '⚽ Total de Jogos', value: totalJogos },
      { label: '🔥 Aproveitamento', value: `${aproveitamento}%` },
      { label: '🥅 Gols Marcados', value: golsPro },
      { label: '✅ Vitórias', value: vitorias },
      { label: '🏟️ Estádios Mapeados', value: rawEstadios.length || 128 }
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

  /* ==========================================================================
     7. INSPEÇÃO ESPACIAL DE ESTÁDIO DAS BRABAS
     ========================================================================== */
  function showEstadioDetails(estProps, jogos) {
    const attrPanel = document.getElementById('attr-panel');
    const attrToggleBtn = document.getElementById('btn-attr-toggle');
    const attrBody = document.getElementById('attr-body');
    const titleEl = document.getElementById('attr-layer-name');

    const estNome = estProps['ESTÁDIO'] || estProps['EST\ufffdDIO'] || 'Estádio';
    if (titleEl) titleEl.textContent = estNome;

    const total = jogos.length;
    const vit = jogos.filter(j => j["RESULTADO"] === "VITÓRIA").length;
    const emp = jogos.filter(j => j["RESULTADO"] === "EMPATE").length;
    const der = jogos.filter(j => j["RESULTADO"] === "DERROTA").length;
    const aproveitamento = total > 0 ? Math.round(((vit * 3 + emp) / (total * 3)) * 100) : 0;

    const cidade = estProps.CIDADE || '';
    const uf = estProps.ESTADO || estProps['ESTADO/PROVÍNCIA'] || '';
    const pais = estProps['PAÍS'] || estProps['PA\ufffdS'] || '';
    const capacidade = estProps.CAPACIDADE;

    let jogosHtml = jogos.map(j => {
      const resClass = j["RESULTADO"] === "VITÓRIA" ? "win" : (j["RESULTADO"] === "EMPATE" ? "draw" : "loss");
      const autorasText = j["AUTORAS"] ? `<div class="jogo-autoras">⚽ <em>${escapeHtml(j["AUTORAS"])}</em></div>` : '';
      const publicoText = (j["PÚBLICO TOTAL"] && j["PÚBLICO TOTAL"] !== "ND" && j["PÚBLICO TOTAL"] !== "N/A") ? 
        `<span class="jogo-tag">👥 Público: ${j["PÚBLICO TOTAL"]}</span>` : '';
      const compText = (j["COMPETIÇÃO"] || j["COMPETI\ufffd\ufffdO"]) ? `<span class="jogo-tag comp">${escapeHtml(j["COMPETIÇÃO"] || j["COMPETI\ufffd\ufffdO"])}</span>` : '';

      return `
        <div class="brabas-match-item ${resClass}">
          <div class="match-meta">
            <span class="match-date">${j["DATA"] || ""}</span>
            ${compText}
            ${publicoText}
          </div>
          <div class="match-score">
            <span class="mandante ${j["TIME MANDANTE"] === 'CORINTHIANS' ? 'corinthians' : ''}">${escapeHtml(j["TIME MANDANTE"] || "")}</span>
            <span class="score-badge ${resClass}">${j["PLACAR"] || "x"}</span>
            <span class="visitante ${j["TIME VISITANTE"] === 'CORINTHIANS' ? 'corinthians' : ''}">${escapeHtml(j["TIME VISITANTE"] || "")}</span>
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
        <div class="estadio-location">📍 ${escapeHtml(cidade)}, ${escapeHtml(uf)} - ${escapeHtml(pais)}</div>
        <div class="estadio-cap">Capacidade: ${capacidade ? Number(capacidade).toLocaleString('pt-BR') : 'N/D'} pessoas</div>
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

    attrPanel.style.display = 'flex';
    if (attrToggleBtn) attrToggleBtn.style.display = 'none';
  }

  /* ==========================================================================
     8. GERENCIAMENTO DE TEMA ROXO (Modo 🏴 / Modo 🏳️)
     ========================================================================== */
  function applyTheme(theme, syncBasemap = true) {
    currentTheme = theme;
    document.body.dataset.theme = theme;
    localStorage.setItem('atlas1910_theme', theme);

    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
      const label = toggleBtn.querySelector('.theme-label');
      if (theme === "dark") {
        if (label) label.textContent = "Modo 🏳️";
        toggleBtn.title = "Mudar para Modo 🏳️ (Roxo Claro)";
      } else {
        if (label) label.textContent = "Modo 🏴";
        toggleBtn.title = "Mudar para Modo 🏴 (Roxo Escuro)";
      }
    }

    // Alternância do ícone com os PNGs roxos da pasta oficial
    const siteLogo = document.getElementById('site-logo');
    if (siteLogo) {
      siteLogo.src = theme === "dark" ? "assets/ATLAS BRABAS 2.png" : "assets/ATLAS BRABAS.png";
    }

    // Alternância do botão de navegação com as imagens enviadas:
    // Layout preto (Modo 🏴): segunda imagem (brabas-dark.png)
    // Layout branco (Modo 🏳️): primeira imagem (brabas-light.png)
    const brabasLogo = document.getElementById('brabas-icon-img');
    if (brabasLogo) {
      brabasLogo.src = theme === "dark" ? "assets/brabas-dark.png" : "assets/brabas-light.png";
    }

    // Atualiza cores dos marcadores de círculo no mapa
    // E também atualiza ícones temáticos (dark/light) de camadas com escudo
    Object.values(loadedLayers).forEach(layerObj => {
      const cfg = layerObj.config;
      if (layerObj.leafletLayer) {
        // Atualiza ícones com variante dark/light (ex: escudo Corinthians)
        if (cfg.iconeDark && cfg.iconeLight) {
          const iconUrl = theme === 'light' ? cfg.iconeLight : cfg.iconeDark;
          const size = cfg.tamanhoIcone || [20, 20];
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
        } else {
          // Atualiza borda de marcadores circulares
          layerObj.leafletLayer.eachLayer(marker => {
            if (typeof marker.setStyle === 'function') {
              marker.setStyle({
                color: theme === 'light' ? '#4c1d95' : '#ffffff'
              });
            }
          });
        }
      }
    });

    if (syncBasemap && typeof BasemapManager !== 'undefined') {
      BasemapManager.onThemeChange(theme);
    }
  }

  /* ==========================================================================
     9. EVENTOS DA INTERFACE
     ========================================================================== */
  function setupEvents() {
    // Filtro Período
    const eraSelect = document.getElementById('filter-era');
    if (eraSelect) {
      eraSelect.onchange = (e) => {
        activeEra = e.target.value;
        applyFiltersToActiveLayers();
      };
    }

    // Filtro Competição
    const compSelect = document.getElementById('filter-comp');
    if (compSelect) {
      compSelect.onchange = (e) => {
        activeCompeticao = e.target.value;
        applyFiltersToActiveLayers();
      };
    }

    // Filtro Mando
    const mandoSelect = document.getElementById('filter-mando');
    if (mandoSelect) {
      mandoSelect.onchange = (e) => {
        activeMando = e.target.value;
        applyFiltersToActiveLayers();
      };
    }

    // Alternador de Tema
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.onclick = () => {
        const next = currentTheme === "dark" ? "light" : "dark";
        applyTheme(next, true);
      };
    }

    // Ficha de Inspeção Espacial
    const attrPanel = document.getElementById('attr-panel');
    const attrToggleBtn = document.getElementById('btn-attr-toggle');
    const attrCloseBtn = document.getElementById('attr-close-btn');

    if (attrCloseBtn) {
      attrCloseBtn.onclick = () => {
        attrPanel.style.display = 'none';
        if (attrToggleBtn) attrToggleBtn.style.display = 'inline-flex';
      };
    }
    if (attrToggleBtn) {
      attrToggleBtn.onclick = () => {
        attrPanel.style.display = 'flex';
        attrToggleBtn.style.display = 'none';
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

    // Aparece após 30 segundos do acesso à página, mesmo com o usuário totalmente parado, apenas uma vez
    if (!localStorage.getItem(COLABORE_SHOWN_KEY)) {
      const pageOpenedAt = Date.now();
      const triggerOnce = () => {
        if (localStorage.getItem(COLABORE_SHOWN_KEY)) return;
        const elapsed = Date.now() - pageOpenedAt;
        if (elapsed >= 30000) {
          openColaborePopup();
          localStorage.setItem(COLABORE_SHOWN_KEY, 'true');
        }
      };

      // Timer principal de 30 segundos
      setTimeout(triggerOnce, 30000);

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
    const mobilePanelBtn = document.getElementById('btn-mobile-panel');
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
    if (mobilePanelBtn) {
      mobilePanelBtn.onclick = () => {
        sidebar.classList.remove('mobile-hidden');
        if (backdrop) backdrop.classList.add('active');
        mobilePanelBtn.style.display = 'none';
        setTimeout(() => { if (map) map.invalidateSize(); }, 300);
      };
    }
    const closeDrawer = () => {
      sidebar.classList.add('mobile-hidden');
      if (backdrop) backdrop.classList.remove('active');
      if (mobilePanelBtn) mobilePanelBtn.style.display = 'flex';
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
