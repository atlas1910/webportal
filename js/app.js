/**
 * ==========================================================================
 * ATLAS1910 — Acervo Cartográfico do Corinthians
 * Núcleo da Aplicação (Leaflet, Camadas do QGIS, Proteção de Dados e Temas)
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

    // 2. Criar mapa Leaflet centralizado na Grande SP
    map = L.map('map', {
      zoomControl: true,
      attributionControl: true
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

    // 9. Restaurar Fonte Salva se houver
    const savedFont = localStorage.getItem('atlas1910_font');
    if (savedFont) {
      applyFont(savedFont);
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
        // Círculo preenchido
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
     5. FICHA DE ATRIBUTOS FLUTUANTE
     ========================================================================== */
  function showFeatureAttributes(layerName, props) {
    const panel = document.getElementById('attr-panel');
    const titleEl = document.getElementById('attr-layer-name');
    const searchInput = document.getElementById('attr-search-input');

    if (!panel) return;

    currentSelectedFeatureProps = props || {};
    titleEl.textContent = layerName || 'Feição Cartográfica';
    if (searchInput) searchInput.value = '';

    renderAttributesList(currentSelectedFeatureProps, '');
    panel.style.display = 'flex';
  }

  function renderAttributesList(props, filterText) {
    const bodyEl = document.getElementById('attr-body');
    if (!bodyEl) return;

    const entries = Object.entries(props || {});
    if (entries.length === 0) {
      bodyEl.innerHTML = '<div class="attr-hint">Nenhum atributo registrado para esta feição.</div>';
      return;
    }

    const filtered = entries.filter(([k, v]) => {
      if (!filterText) return true;
      const q = filterText.toLowerCase();
      return String(k).toLowerCase().includes(q) || String(v).toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      bodyEl.innerHTML = '<div class="attr-hint">Nenhum atributo corresponde ao filtro.</div>';
      return;
    }

    const html = filtered.map(([key, val]) => {
      const cleanKey = key.replace(/_/g, ' ');
      return `
        <div class="attr-row">
          <span class="attr-key">${escapeHtml(cleanKey)}</span>
          <span class="attr-val">${escapeHtml(String(val))}</span>
        </div>
      `;
    }).join('');

    bodyEl.innerHTML = html;
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

    const stats = [
      { label: 'Camadas do Acervo', value: layerKeys.length },
      { label: 'Feições Cartográficas', value: totalFeatures.toLocaleString('pt-BR') },
      { label: 'Temáticas Disponíveis', value: (typeof CATALOGO_TEMAS !== 'undefined' ? CATALOGO_TEMAS.length : 3) },
      { label: 'Foco Geográfico', value: 'SP & Brasil' }
    ];

    container.innerHTML = stats.map(s => `
      <div class="stat-card">
        <div class="label">${s.label}</div>
        <div class="value">${s.value}</div>
      </div>
    `).join('');
  }

  /* ==========================================================================
     7. GERENCIAMENTO DE TEMA (LUZ NOTURNA VS MODO NORMAL)
     ========================================================================== */
  function applyTheme(theme, syncBasemap = true) {
    currentTheme = theme;
    document.body.dataset.theme = theme;
    localStorage.setItem('atlas1910_theme', theme);

    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
      const iconSpan = toggleBtn.querySelector('.theme-icon');
      const labelSpan = toggleBtn.querySelector('.theme-label');
      if (theme === "dark") {
        iconSpan.textContent = "☀️";
        labelSpan.textContent = "Modo Normal";
        toggleBtn.title = "Mudar para Modo Normal (Claro / Fundo Branco)";
      } else {
        iconSpan.textContent = "🌙";
        labelSpan.textContent = "Luz Noturna";
        toggleBtn.title = "Mudar para Luz Noturna (Escuro / Quase Todo Negro)";
      }
    }

    if (syncBasemap && typeof BasemapManager !== 'undefined') {
      BasemapManager.onThemeChange(theme);
    }
  }

  function toggleTheme() {
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme, true);
  }

  /* ==========================================================================
     8. PERSONALIZAÇÃO DE TIPOGRAFIA
     ========================================================================== */
  function applyFont(fontKey) {
    document.body.dataset.font = fontKey;
    localStorage.setItem('atlas1910_font', fontKey);
    const fontSelect = document.getElementById('font-family-select');
    if (fontSelect) fontSelect.value = fontKey;
  }

  /* ==========================================================================
     9. OUVINTES DE EVENTOS DA INTERFACE
     ========================================================================== */
  function setupUIEvents() {
    const themeListEl = document.getElementById('theme-list');

    // Botão Luz Noturna / Modo Normal
    const themeToggleBtn = document.getElementById('btn-theme-toggle');
    if (themeToggleBtn) {
      themeToggleBtn.onclick = toggleTheme;
    }

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

    // Modal de Configurações
    const settingsModal = document.getElementById('modal-settings');
    document.getElementById('btn-open-settings').onclick = () => settingsModal.classList.add('active');

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.onclick = () => settingsModal.classList.remove('active');
    });

    document.getElementById('font-family-select').onchange = (e) => {
      applyFont(e.target.value);
    };

    // Painel de Atributos
    document.getElementById('attr-close-btn').onclick = () => {
      document.getElementById('attr-panel').style.display = 'none';
    };

    document.getElementById('attr-search-input').oninput = (e) => {
      if (currentSelectedFeatureProps) {
        renderAttributesList(currentSelectedFeatureProps, e.target.value);
      }
    };
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
