/**
 * ==========================================================================
 * ATLAS1910 — Módulo de Mapas Base (Basemaps)
 * Provedores resilientes de alta disponibilidade sem necessidade de chaves de API
 * ==========================================================================
 */

const BasemapManager = (function() {
  let mapInstance = null;
  let activeBasemapName = "Esri Escuro";
  let activeTileLayer = null;

  // Definição dos mapas base oficiais 100% gratuitos e de alta disponibilidade com sincronização de zoom
  function createBasemapLayers() {
    const tileOptions = {
      maxZoom: 19,
      keepBuffer: 4,
      updateWhenIdle: false,
      updateWhenZooming: false,
      noWrap: false
    };

    return {
      "Esri Escuro": {
        label: "Escuro",
        title: "Modo Escuro (Esri Dark Canvas)",
        layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
          ...tileOptions
        })
      },
      "Esri Claro": {
        label: "Claro",
        title: "Modo Claro (Esri Light Canvas)",
        layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
          ...tileOptions
        })
      },
      "Satélite": {
        label: "Satélite",
        title: "Fotografia Aérea e Satélite (Esri World Imagery)",
        layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
          ...tileOptions
        })
      },
      "Ruas (OSM)": {
        label: "Ruas",
        title: "Vias e Mobilidade (OpenStreetMap)",
        layer: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          subdomains: 'abc',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          ...tileOptions
        })
      }
    };
  }

  let basemapConfig = {};

  return {
    init(map, initialTheme = "dark") {
      mapInstance = map;
      basemapConfig = createBasemapLayers();

      activeBasemapName = initialTheme === "light" ? "Esri Claro" : "Esri Escuro";
      activeTileLayer = basemapConfig[activeBasemapName].layer;
      activeTileLayer.addTo(mapInstance);

      this.renderControls();
    },

    switchBasemap(name) {
      if (!basemapConfig[name] || name === activeBasemapName) return;

      if (activeTileLayer) {
        mapInstance.removeLayer(activeTileLayer);
      }

      activeTileLayer = basemapConfig[name].layer;
      activeTileLayer.addTo(mapInstance);
      activeBasemapName = name;

      const buttons = document.querySelectorAll('.basemap-btn');
      buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.basemap === name);
      });
    },

    onThemeChange(theme) {
      if (theme === "light") {
        if (activeBasemapName === "Esri Escuro") {
          this.switchBasemap("Esri Claro");
        }
      } else {
        if (activeBasemapName === "Esri Claro") {
          this.switchBasemap("Esri Escuro");
        }
      }
    },

    renderControls() {
      // Prioriza a nova barra horizontal flutuante (#basemap-bar), com fallback para #basemap-grid
      const container = document.getElementById('basemap-bar') || document.getElementById('basemap-grid');
      if (!container) return;

      container.innerHTML = '';
      Object.entries(basemapConfig).forEach(([key, info]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `basemap-btn ${key === activeBasemapName ? 'active' : ''}`;
        btn.dataset.basemap = key;
        btn.title = info.title;
        btn.innerHTML = `<span class="basemap-btn-text">${info.label}</span>`;
        btn.onclick = () => this.switchBasemap(key);
        container.appendChild(btn);
      });
    },

    getActiveBasemap() {
      return activeBasemapName;
    }
  };
})();
