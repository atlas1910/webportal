/**
 * ==========================================================================
 * ATLAS1910 — Acervo Cartográfico do Corinthians
 * Núcleo da Aplicação (Leaflet, Camadas do QGIS, Proteção de Dados e Temas)
 * Tipografia Oficial: Montserrat
 * ==========================================================================
 */

(function() {
  'use strict';

  let map;
  const loadedLayers = {}; // id -> { leafletLayer, data, count, config, themeId }
  let currentSelectedFeatureProps = null;
  let currentTheme = "dark"; // "dark" (Luz Noturna) ou "light" (Modo Normal)

  /* ==========================================================================
     1. INICIALIZAÇÃO
     ========================================================================== */
  async function init() {
    // 1. Carregar tema preferido salvo (ou padrão dark)
    const savedTheme = localStorage.getItem('atlas1910_theme') || "dark";
    applyTheme(savedTheme, false);

    // 2. Criar mapa Leaflet otimizado — desabilitando animações que causam descompasso
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
    }).setView([-23.5505, -46.6333], 9);

    // 3. Inicializar Mapas Base sincronizados com o tema atual
    BasemapManager.init(map, currentTheme);

    // 4. Ativar Mecanismos de Proteção contra Download e Cópia
    setupProtection();

    // 5. Carregar todas as camadas definidas no CATALOGO_TEMAS
    await loadAllCatalogLayers();

    // 6. Renderizar Lista de Temáticas na Barra Lateral
    renderThemesUI();

    // 7. Atualizar Estatísticas
    updateStats();

    // 8. Configurar Ouvintes de Eventos da Interface
    setupUIEvents();
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
  async function loadAllCatalogLayers() {
    if (typeof CATALOGO_TEMAS === 'undefined') {
      console.error("CATALOGO_TEMAS não definido em js/camadas.js");
      return;
    }

    for (const tema of CATALOGO_TEMAS) {
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
            const leafletLayer = buildLeafletLayer(geojson, camada, tema.cor);
            
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

  function buildLeafletLayer(geojson, layerConfig, themeColor) {
    const color = layerConfig.cor || themeColor || '#ffffff';
    const shape = layerConfig.forma || 'circulo';
    const opacity = layerConfig.opacidade !== undefined ? layerConfig.opacidade : 1;

    return L.geoJSON(geojson, {
      pointToLayer: function(feature, latlng) {
        // Seleção de ícone com suporte a variantes claro/escuro
        let iconPath = (feature.properties && (feature.properties.icone || feature.properties.icon || feature.properties.imagem_marcador)) || layerConfig.icone;
        if (layerConfig.iconeDark && layerConfig.iconeLight) {
          iconPath = currentTheme === 'light' ? layerConfig.iconeLight : layerConfig.iconeDark;
        }

        if (iconPath) {
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
            radius: 7,
            fillOpacity: 0,
            color: color,
            weight: 2.5,
            opacity: opacity
          });
        }
        // Círculo preenchido padrão
        return L.circleMarker(latlng, {
          radius: 7,
          fillColor: color,
          color: '#000000',
          weight: 1.5,
          fillOpacity: 0.9 * opacity,
          opacity: opacity
        });
      },
      style: function() {
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
        layer.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          showFeatureAttributes(layerConfig.nome, feature.properties);
        });
      }
    });
  }

  /* ==========================================================================
     4. RENDERIZAÇÃO DA BARRA LATERAL (TEMAS & CAMADAS)
     ========================================================================== */
  function renderThemesUI() {
    const container = document.getElementById('theme-list');
    if (!container) return;

    container.innerHTML = '';
    let totalActive = 0;

    CATALOGO_TEMAS.forEach(tema => {
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
  }

  /* ==========================================================================
     5. FICHA DE ATRIBUTOS FLUTUANTE (INSPEÇÃO ESPACIAL)
     ========================================================================== */
  function showFeatureAttributes(layerName, props) {
    const panel = document.getElementById('attr-panel');
    const toggleBtn = document.getElementById('btn-attr-toggle');
    const titleEl = document.getElementById('attr-layer-name');
    const searchInput = document.getElementById('attr-search-input');

    if (!panel) return;

    currentSelectedFeatureProps = props || {};
    titleEl.textContent = layerName || 'Feição Cartográfica';
    if (searchInput) searchInput.value = '';

    renderAttributesList(currentSelectedFeatureProps, '');
    
    // Abre a ficha e oculta o botão flutuante de reabertura
    panel.style.display = 'flex';
    if (toggleBtn) toggleBtn.style.display = 'none';
  }

  function renderAttributesList(props, filterText) {
    const bodyEl = document.getElementById('attr-body');
    if (!bodyEl) return;

    // Ignora colunas técnicas internas do QGIS/KML se existirem
    const ignoredKeys = new Set(['altitudeMo', 'tessellate', 'extrude', 'visibility', 'drawOrder', 'icon', 'fid', 'id']);
    
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

    const html = filtered.map(([key, val]) => {
      const cleanKey = key.replace(/_/g, ' ');
      const cleanVal = formatAttributeValue(val);
      return `
        <div class="attr-row">
          <span class="attr-key">${escapeHtml(cleanKey)}</span>
          <span class="attr-val">${cleanVal}</span>
        </div>
      `;
    }).join('');

    bodyEl.innerHTML = html;
  }

  function formatAttributeValue(val) {
    if (val === null || val === undefined) return '';
    let str = String(val);
    str = str.replace(/<br\s*\/?>/gi, '\n');
    str = str.replace(/<\/?[^>]+(>|$)/g, '');
    return escapeHtml(str).replace(/\n/g, '<br>');
  }

  /* ==========================================================================
     6. ESTATÍSTICAS DO ACERVO
     ========================================================================== */
  function updateStats() {
    const container = document.getElementById('stats-grid');
    if (!container) return;

    const layerKeys = Object.keys(loadedLayers);
    let totalFeatures = 0;

    layerKeys.forEach(k => {
      totalFeatures += loadedLayers[k].count || 0;
    });

    const activeThemes = CATALOGO_TEMAS.filter(t => t.camadas && t.camadas.length > 0).length;

    const stats = [
      { label: 'Camadas do Acervo', value: layerKeys.length },
      { label: 'Feições Cartográficas', value: totalFeatures.toLocaleString('pt-BR') },
      { label: 'Temáticas Disponíveis', value: activeThemes },
      { label: 'Foco Geográfico', value: 'SP, Brasil & Mundo' }
    ];

    container.innerHTML = stats.map(s => `
      <div class="stat-card">
        <div class="label">${s.label}</div>
        <div class="value">${s.value}</div>
      </div>
    `).join('');
  }

  /* ==========================================================================
     7. GERENCIAMENTO DE TEMA (MODO 🏴 / MODO 🏳️)
     ========================================================================== */
  function updateThemedIcons(theme) {
    Object.values(loadedLayers).forEach(layerObj => {
      const cfg = layerObj.config;
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

    // Atualiza texto do botão de tema
    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
      const labelSpan = toggleBtn.querySelector('.theme-label');
      if (theme === "dark") {
        if (labelSpan) labelSpan.textContent = "Modo 🏳️";
        toggleBtn.title = "Mudar para Modo 🏳️ (Claro)";
      } else {
        if (labelSpan) labelSpan.textContent = "Modo 🏴";
        toggleBtn.title = "Mudar para Modo 🏴 (Escuro)";
      }
    }

    // Atualiza logotipo: dark usa PRETO-TRANSPARENTE.png, light usa BRANCO-TRANSPARENTE.png
    const logoImg = document.getElementById('site-logo');
    if (logoImg) {
      logoImg.src = theme === "dark" ? "assets/PRETO-TRANSPARENTE.png" : "assets/BRANCO-TRANSPARENTE.png";
    }

    // Atualiza logo das Brabas de acordo com o modo visual:
    // Layout preto (Modo 🏴): segunda imagem (brabas-dark.png)
    // Layout branco (Modo 🏳️): primeira imagem (brabas-light.png)
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
    const mobilePanelBtn = document.getElementById('btn-mobile-panel');
    const mobileCloseBtn = document.getElementById('btn-mobile-close');
    const backdrop       = document.getElementById('drawer-backdrop');

    // Desktop — recolher painel de camadas
    if (collapseBtn) {
      collapseBtn.addEventListener('click', function() {
        sidebar.classList.add('collapsed');
        if (expandBtn) expandBtn.classList.add('visible');
        setTimeout(() => { if (map) map.invalidateSize(); }, 320);
      });
    }

    // Desktop — expandir painel de camadas
    if (expandBtn) {
      expandBtn.addEventListener('click', function() {
        sidebar.classList.remove('collapsed');
        expandBtn.classList.remove('visible');
        setTimeout(() => { if (map) map.invalidateSize(); }, 320);
      });
    }

    // Mobile — abrir gaveta de camadas
    function openMobileDrawer() {
      sidebar.classList.remove('mobile-hidden');
      if (backdrop) backdrop.classList.add('active');
      if (mobilePanelBtn) mobilePanelBtn.style.display = 'none';
    }

    // Mobile — fechar gaveta de camadas
    function closeMobileDrawer() {
      sidebar.classList.add('mobile-hidden');
      if (backdrop) backdrop.classList.remove('active');
      if (mobilePanelBtn) mobilePanelBtn.style.display = 'flex';
      setTimeout(() => { if (map) map.invalidateSize(); }, 300);
    }

    if (mobilePanelBtn) {
      mobilePanelBtn.addEventListener('click', openMobileDrawer);
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
        if (mobilePanelBtn) mobilePanelBtn.style.display = 'none';
      } else {
        if (sidebar.classList.contains('mobile-hidden')) {
          if (mobilePanelBtn) mobilePanelBtn.style.display = 'flex';
        } else {
          if (mobilePanelBtn) mobilePanelBtn.style.display = 'none';
        }
      }
      if (map) map.invalidateSize();
    });
  }

  /* ==========================================================================
     9. OUVINTES DE EVENTOS DA INTERFACE
     ========================================================================== */
  function setupUIEvents() {
    const themeListEl = document.getElementById('theme-list');

    // Botão Modo 🏴 / Modo 🏳️
    const themeToggleBtn = document.getElementById('btn-theme-toggle');
    if (themeToggleBtn) {
      themeToggleBtn.onclick = toggleTheme;
    }

    // Controles de recolher/expandir sidebar e mobile drawer
    setupSidebarControls();

    // Ligar / Desligar Camadas
    themeListEl.addEventListener('change', function(e) {
      if (e.target.dataset.layerId) {
        const id = e.target.dataset.layerId;
        const layerInfo = loadedLayers[id];
        if (layerInfo) {
          if (e.target.checked) {
            layerInfo.leafletLayer.addTo(map);
          } else {
            map.removeLayer(layerInfo.leafletLayer);
          }
        }

        // Atualiza badge de contagem
        let totalActive = 0;
        Object.values(loadedLayers).forEach(l => {
          if (map.hasLayer(l.leafletLayer)) totalActive++;
        });
        const activeBadge = document.getElementById('active-layer-count');
        if (activeBadge) activeBadge.textContent = `${totalActive} ativas`;
      }
    });

    // Controle de Opacidade
    themeListEl.addEventListener('input', function(e) {
      if (e.target.dataset.layerId && e.target.type === 'range') {
        const id = e.target.dataset.layerId;
        const layerInfo = loadedLayers[id];
        if (layerInfo) {
          const val = e.target.value / 100;
          layerInfo.leafletLayer.eachLayer(l => {
            if (typeof l.setOpacity === 'function') {
              l.setOpacity(val);
            } else if (l.setStyle) {
              if (layerInfo.config.tipo === 'ponto') {
                l.setStyle({ fillOpacity: val * 0.9, opacity: val });
              } else {
                l.setStyle({ opacity: val, fillOpacity: val * 0.25 });
              }
            }
          });
          const label = e.target.previousElementSibling;
          if (label) label.textContent = `${e.target.value}%`;
        }
      }
    });

    // Zoom para Camada
    themeListEl.addEventListener('click', function(e) {
      const zoomBtn = e.target.closest('.zoom-btn');
      if (zoomBtn) {
        const id = zoomBtn.dataset.layerId;
        const layerInfo = loadedLayers[id];
        if (layerInfo && layerInfo.leafletLayer && layerInfo.leafletLayer.getBounds) {
          try {
            const bounds = layerInfo.leafletLayer.getBounds();
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
            }
          } catch (err) {
            console.warn("Erro ao ajustar zoom:", err);
          }
        }
      }
    });

    // Painel de Atributos (Inspeção Espacial)
    const attrPanel = document.getElementById('attr-panel');
    const attrToggleBtn = document.getElementById('btn-attr-toggle');
    const attrCloseBtn = document.getElementById('attr-close-btn');

    // Minimizar / Fechar ficha
    if (attrCloseBtn) {
      attrCloseBtn.onclick = () => {
        attrPanel.style.display = 'none';
        if (attrToggleBtn) attrToggleBtn.style.display = 'inline-flex';
      };
    }

    // Reabrir ficha minimizada pelo botão flutuante
    if (attrToggleBtn) {
      attrToggleBtn.onclick = () => {
        attrPanel.style.display = 'flex';
        attrToggleBtn.style.display = 'none';
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

    // Aparece só depois de 1 minuto (60.000 ms) que a pessoa estiver no site e aparece só uma vez
    if (!localStorage.getItem(COLABORE_SHOWN_KEY)) {
      setTimeout(() => {
        if (!localStorage.getItem(COLABORE_SHOWN_KEY)) {
          openColaborePopup();
          localStorage.setItem(COLABORE_SHOWN_KEY, 'true');
        }
      }, 60000);
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
