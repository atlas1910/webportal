/**
 * ==========================================================================
 * ATLAS1910 — Módulo de Mapas Base (Basemaps)
 * Provedores resilientes de alta disponibilidade sem necessidade de login ou chaves expostas
 * ==========================================================================
 */

const BasemapManager = (function() {
  let mapInstance = null;
  let activeBasemapName = "Esri Escuro";
  let activeTileLayer = null;

  function createBasemapLayers() {
    return {
      "Esri Escuro": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
        maxZoom: 19
      }),
      "CARTO Escuro": L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20
      }),
      "Esri Claro": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
        maxZoom: 19
      }),
      "CARTO Claro": L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        attribution: '&copy; OSM, &copy; CARTO',
        maxZoom: 20
      }),
      "Satélite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        maxZoom: 19
      }),
      "Ruas (OSM)": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        subdomains: 'abc',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      })
    };
  }

  let basemapLayers = {};

  return {
    init(map, initialTheme = "dark") {
      mapInstance = map;
      basemapLayers = createBasemapLayers();

      activeBasemapName = initialTheme === "light" ? "Esri Claro" : "Esri Escuro";
      activeTileLayer = basemapLayers[activeBasemapName];
      activeTileLayer.addTo(mapInstance);

      this.renderControls();
    },

    switchBasemap(name) {
      if (!basemapLayers[name] || name === activeBasemapName) return;

      if (activeTileLayer) {
        mapInstance.removeLayer(activeTileLayer);
      }

      activeTileLayer = basemapLayers[name];
      activeTileLayer.addTo(mapInstance);
      activeBasemapName = name;

      const buttons = document.querySelectorAll('.basemap-btn');
      buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.basemap === name);
      });
    },

    onThemeChange(theme) {
      if (theme === "light") {
        if (activeBasemapName === "Esri Escuro" || activeBasemapName === "CARTO Escuro") {
          this.switchBasemap("Esri Claro");
        }
      } else {
        if (activeBasemapName === "Esri Claro" || activeBasemapName === "CARTO Claro") {
          this.switchBasemap("Esri Escuro");
        }
      }
    },

    renderControls() {
      const container = document.getElementById('basemap-grid');
      if (!container) return;

      container.innerHTML = '';
      Object.keys(basemapLayers).forEach(name => {
        const btn = document.createElement('button');
        btn.className = `basemap-btn ${name === activeBasemapName ? 'active' : ''}`;
        btn.dataset.basemap = name;
        btn.textContent = name;
        btn.onclick = () => this.switchBasemap(name);
        container.appendChild(btn);
      });
    },

    getActiveBasemap() {
      return activeBasemapName;
    }
  };
})();
