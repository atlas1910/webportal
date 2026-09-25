/**
 * ==========================================================================
 * ATLAS1910 — AS BRABAS (Futebol Feminino do Corinthians)
 * Módulo Especializado de Mapeamento, Estatísticas e Inspeção Histórica
 * ==========================================================================
 */

(function() {
  'use strict';

  let map;
  let currentTheme = "dark";
  let rawJogos = [];
  let rawEstadios = [];
  let currentMarkersLayer = null;
  let activeEra = "todas";
  let activeCompeticao = "todas";
  let activeMando = "todos";

  /* ==========================================================================
     1. INICIALIZAÇÃO
     ========================================================================== */
  async function init() {
    const savedTheme = localStorage.getItem('atlas1910_theme') || "dark";
    applyTheme(savedTheme, false);

    // Mapa otimizado com sincronização total de zoom
    map = L.map('map', {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
      zoomAnimation: true,
      markerZoomAnimation: true,
      fadeAnimation: true,
      wheelPxPerZoomLevel: 120,
      wheelDebounceTime: 25
    }).setView([-23.5505, -46.6333], 8);

    BasemapManager.init(map, currentTheme);

    setupProtection();
    await loadBrabasData();
    renderBrabasStats();
    applyFiltersAndRender();
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
      console.warn("Aviso ao carregar dados das Brabas:", err);
    }
  }

  /* ==========================================================================
     3. RENDERIZAÇÃO DOS ESTÁDIOS NO MAPA COM SINCRONIA
     ========================================================================== */
  function applyFiltersAndRender() {
    if (currentMarkersLayer) {
      map.removeLayer(currentMarkersLayer);
    }

    // Filtrar jogos
    const filteredJogos = rawJogos.filter(j => {
      // Filtro Era
      if (activeEra === "ate_2016" && j.ERA !== "Até 2016") return false;
      if (activeEra === "depois_2016" && j.ERA !== "Depois da reativação") return false;

      // Filtro Competição
      if (activeCompeticao !== "todas") {
        const comp = (j["COMPETIÇÃO"] || "").toUpperCase();
        if (!comp.includes(activeCompeticao.toUpperCase())) return false;
      }

      // Filtro Mando
      if (activeMando !== "todos") {
        const mando = (j["MANDANTE / VISITANTE (SCCP)"] || "").toLowerCase();
        if (activeMando === "mandante" && !mando.includes("mandante")) return false;
        if (activeMando === "visitante" && !mando.includes("visitante")) return false;
        if (activeMando === "neutro" && !mando.includes("neutro")) return false;
      }

      return true;
    });

    // Mapear estádios dos jogos filtrados
    const estadiosMap = {};
    filteredJogos.forEach(j => {
      const estNome = (j["ESTÁDIO"] || "").trim().toUpperCase();
      if (!estNome || estNome === "DESCONHECIDO") return;
      if (!estadiosMap[estNome]) {
        estadiosMap[estNome] = {
          nome: j["ESTÁDIO"],
          cidade: j["CIDADE"],
          uf: j["ESTADO/PROVÍNCIA"],
          pais: j["PAÍS"],
          capacidade: j["CAPACIDADE"],
          lat: parseFloat(j["LATITUDE"]),
          lng: parseFloat(j["LONGITUDE"]),
          jogos: []
        };
      }
      estadiosMap[estNome].jogos.push(j);
    });

    const markers = [];
    Object.values(estadiosMap).forEach(est => {
      if (isNaN(est.lat) || isNaN(est.lng)) return;

      const totalJogos = est.jogos.length;
      const vitorias = est.jogos.filter(j => j["RESULTADO"] === "VITÓRIA").length;
      const empates = est.jogos.filter(j => j["RESULTADO"] === "EMPATE").length;
      const derrotas = est.jogos.filter(j => j["RESULTADO"] === "DERROTA").length;
      const aproveitamento = totalJogos > 0 ? Math.round(((vitorias * 3 + empates) / (totalJogos * 3)) * 100) : 0;

      // Raio proporcional ao número de jogos (mínimo 6, máximo 18)
      const radius = Math.min(Math.max(6 + Math.log2(totalJogos + 1) * 2.5, 6), 18);
      
      // Cor de acordo com o mando predominante ou destaque
      const isFazendinhaOrArena = est.nome.includes("PARQUE SÃO JORGE") || est.nome.includes("NEO QUÍMICA") || est.nome.includes("ROCHDALÃO");
      const fillColor = isFazendinhaOrArena ? "#9f7aea" : "#c8aa6e";

      const marker = L.circleMarker([est.lat, est.lng], {
        radius: radius,
        fillColor: fillColor,
        color: "#ffffff",
        weight: 1.5,
        opacity: 0.95,
        fillOpacity: 0.85
      });

      marker.on('click', e => {
        L.DomEvent.stopPropagation(e);
        showEstadioDetails(est, totalJogos, vitorias, empates, derrotas, aproveitamento);
      });

      markers.push(marker);
    });

    currentMarkersLayer = L.featureGroup(markers);
    currentMarkersLayer.addTo(map);

    // Atualizar badges
    const countBadge = document.getElementById('filtered-stadium-count');
    if (countBadge) {
      countBadge.textContent = `${markers.length} estádios (${filteredJogos.length} jogos)`;
    }
  }

  /* ==========================================================================
     4. ESTATÍSTICAS DAS BRABAS
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
      { label: '🏟️ Estádios Mapeados', value: rawEstadios.length }
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
     5. INSPEÇÃO ESPACIAL DE ESTÁDIO DAS BRABAS
     ========================================================================== */
  function showEstadioDetails(est, total, vit, emp, der, aproveitamento) {
    const attrPanel = document.getElementById('attr-panel');
    const attrToggleBtn = document.getElementById('btn-attr-toggle');
    const attrBody = document.getElementById('attr-body');
    const titleEl = document.getElementById('attr-layer-name');

    if (titleEl) titleEl.textContent = est.nome;

    let jogosHtml = est.jogos.map(j => {
      const resClass = j["RESULTADO"] === "VITÓRIA" ? "win" : (j["RESULTADO"] === "EMPATE" ? "draw" : "loss");
      const autorasText = j["AUTORAS"] ? `<div class="jogo-autoras">⚽ <em>${escapeHtml(j["AUTORAS"])}</em></div>` : '';
      const publicoText = (j["PÚBLICO TOTAL"] && j["PÚBLICO TOTAL"] !== "ND" && j["PÚBLICO TOTAL"] !== "N/A") ? 
        `<span class="jogo-tag">👥 Público: ${j["PÚBLICO TOTAL"]}</span>` : '';
      const compText = j["COMPETIÇÃO"] ? `<span class="jogo-tag comp">${escapeHtml(j["COMPETIÇÃO"])}</span>` : '';

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

    attrBody.innerHTML = `
      <div class="estadio-summary-card">
        <div class="estadio-location">📍 ${escapeHtml(est.cidade || "")}, ${escapeHtml(est.uf || "")} - ${escapeHtml(est.pais || "")}</div>
        <div class="estadio-cap">Capacidade: ${est.capacidade ? Number(est.capacidade).toLocaleString('pt-BR') : 'N/D'} pessoas</div>
        <div class="estadio-metrics-bar">
          <div class="metric"><span class="m-val">${total}</span> <span class="m-lbl">jogos</span></div>
          <div class="metric win"><span class="m-val">${vit}</span> <span class="m-lbl">vitórias</span></div>
          <div class="metric draw"><span class="m-val">${emp}</span> <span class="m-lbl">empates</span></div>
          <div class="metric loss"><span class="m-val">${der}</span> <span class="m-lbl">derrotas</span></div>
          <div class="metric"><span class="m-val">${aproveitamento}%</span> <span class="m-lbl">aprov.</span></div>
        </div>
      </div>
      <div class="matches-list-title">Histórico de Partidas (${est.jogos.length}):</div>
      <div class="brabas-matches-container">
        ${jogosHtml}
      </div>
    `;

    attrPanel.style.display = 'flex';
    if (attrToggleBtn) attrToggleBtn.style.display = 'none';
  }

  /* ==========================================================================
     6. EVENTOS DA INTERFACE & FILTROS
     ========================================================================== */
  function setupEvents() {
    // Filtro Era
    const eraSelect = document.getElementById('filter-era');
    if (eraSelect) {
      eraSelect.onchange = (e) => {
        activeEra = e.target.value;
        applyFiltersAndRender();
      };
    }

    // Filtro Competição
    const compSelect = document.getElementById('filter-comp');
    if (compSelect) {
      compSelect.onchange = (e) => {
        activeCompeticao = e.target.value;
        applyFiltersAndRender();
      };
    }

    // Filtro Mando
    const mandoSelect = document.getElementById('filter-mando');
    if (mandoSelect) {
      mandoSelect.onchange = (e) => {
        activeMando = e.target.value;
        applyFiltersAndRender();
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

    // Inspeção Espacial
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
    const colaboreBtn = document.getElementById('btn-colabore-toggle');
    const colaborePanel = document.getElementById('colabore-panel');
    const colaboreClose = document.getElementById('colabore-close-btn');
    const copyBtn = document.getElementById('btn-copy-pix');
    const copyStatus = document.getElementById('copy-status');

    if (colaboreBtn && colaborePanel) {
      colaboreBtn.onclick = () => {
        colaborePanel.style.display = colaborePanel.style.display === 'none' ? 'flex' : 'none';
      };
    }
    if (colaboreClose && colaborePanel) {
      colaboreClose.onclick = () => {
        colaborePanel.style.display = 'none';
      };
    }
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText("1910atlas@gmail.com").then(() => {
          if (copyStatus) {
            copyStatus.style.display = 'block';
            setTimeout(() => { copyStatus.style.display = 'none'; }, 3000);
          }
        }).catch(err => {
          console.warn("Falha ao copiar:", err);
        });
      };
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

  /* ==========================================================================
     7. TEMA VISUAL (Modo 🏴 / Modo 🏳️)
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
        toggleBtn.title = "Mudar para Modo 🏳️ (Claro)";
      } else {
        if (label) label.textContent = "Modo 🏴";
        toggleBtn.title = "Mudar para Modo 🏴 (Escuro)";
      }
    }

    // Imagem do logotipo das Brabas: light usa primeira imagem (roxa escura), dark usa segunda (branca)
    const brabasLogo = document.getElementById('brabas-icon-img');
    if (brabasLogo) {
      brabasLogo.src = theme === "dark" ? "assets/brabas-dark.png" : "assets/brabas-light.png";
    }
    const floatingLogo = document.getElementById('floating-brabas-img');
    if (floatingLogo) {
      floatingLogo.src = theme === "dark" ? "assets/brabas-dark.png" : "assets/brabas-light.png";
    }

    if (syncBasemap && typeof BasemapManager !== 'undefined') {
      BasemapManager.onThemeChange(theme);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  window.addEventListener('DOMContentLoaded', init);
})();
