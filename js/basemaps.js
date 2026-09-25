/**
 * ATLAS1910 — Módulo de Mapas Base (Basemaps)
 * Gerencia camadas de fundo com autenticação CARTO API Key e provedores resilientes
 */

const BasemapManager = (function() {
  let currentKey = "cb1_2x6s_1_031c60b747aa34393292ab97";
  let activeBasemapName = "CARTO Escuro";
  let mapInstance = null;
  let activeTileLayer = null;

  // Função auxiliar para montar URL da CARTO com chave de API e subdomínios abcd
  function getCartoUrl(style, retina = true) {
    const r = retina ? '{r}' : '';
    // Formato rastertiles suporta api_key
    return `https://{s}.basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}${r}.png?api_key=${currentKey}`;
  }

  function createBasemapLayers() {
    return {
      "CARTO Escuro": L.tileLayer(getCartoUrl('dark_all'), {
        subdomains: 'abcd',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20
      }),
      "Esri Dark Canvas": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
        maxZoom: 19
      }),
      "CARTO Voyager": L.tileLayer(getCartoUrl('voyager'), {
        subdomains: 'abcd',
        attribution: '&copy; OSM, &copy; CARTO',
        maxZoom: 20
      }),
      "Satélite Esri": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        maxZoom: 19
      }),
      "CARTO Claro": L.tileLayer(getCartoUrl('light_all'), {
        subdomains: 'abcd',
        attribution: '&copy; OSM, &copy; CARTO',
        maxZoom: 20
      }),
      "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        subdomains: 'abc',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      })
    };
  }

  let basemapLayers = {};

  return {
    init(map) {
      mapInstance = map;
      basemapLayers = createBasemapLayers();

      // Ativar mapa padrão
      activeTileLayer = basemapLayers[activeBasemapName];
      activeTileLayer.addTo(mapInstance);

      this.renderControls();
    },

    setApiKey(newKey) {
      if (!newKey || newKey.trim() === '') return;
      currentKey = newKey.trim();
      
      // Recriar camadas
      const currentActive = activeBasemapName;
      if (activeTileLayer) {
        mapInstance.removeLayer(activeTileLayer);
      }
      basemapLayers = createBasemapLayers();
      activeTileLayer = basemapLayers[currentActive];
      activeTileLayer.addTo(mapInstance);

      const badge = document.getElementById('carto-badge');
      if (badge) {
        badge.textContent = 'CARTO Atualizado';
        setTimeout(() => { badge.textContent = 'CARTO Ativo'; }, 2000);
      }
    },

    switchBasemap(name) {
      if (!basemapLayers[name] || name === activeBasemapName) return;

      if (activeTileLayer) {
        mapInstance.removeLayer(activeTileLayer);
      }

      activeTileLayer = basemapLayers[name];
      activeTileLayer.addTo(mapInstance);
      activeBasemapName = name;

      // Atualiza botões
      const buttons = document.querySelectorAll('.basemap-btn');
      buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.basemap === name);
      });
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
    },

    getApiKey() {
      return currentKey;
    }
  };
})();
