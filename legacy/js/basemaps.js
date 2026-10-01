/**
 * ==========================================================================
 * ATLAS1910 - Módulo de Mapas Base (Basemaps)
 * Provedores resilientes de alta disponibilidade sem necessidade de chaves de API
 * ==========================================================================
 */

const BasemapManager = (function() {
  let mapInstance = null;
  let activeBasemapName = "Esri Escuro";
  let activeTileLayer = null;
  let equalEarthEnabled = false;
  let equalEarthLayer = null;
  let equalEarthHighQualityLayer = null;
  let equalEarthQualityTimer = null;
  let equalEarthCRS = null;
  let updateWorldBounds = () => {};

  const WORLD_BOUNDS = L.latLngBounds(
    [-85.0511287798066, -180],
    [85.0511287798066, 180]
  );
  const EQUAL_EARTH_BOUNDS = L.latLngBounds([-90, -180], [90, 180]);

  function createEqualEarthCRS() {
    if (equalEarthCRS) return equalEarthCRS;

    const semiMajorAxis = 6378137;
    const flattening = 1 / 298.257223563;
    const eccentricitySquared = flattening * (2 - flattening);
    const eccentricity = Math.sqrt(eccentricitySquared);
    const radians = Math.PI / 180;
    const coefficientA1 = 1.340264;
    const coefficientA2 = -0.081106;
    const coefficientA3 = 0.000893;
    const coefficientA4 = 0.003796;
    const m = Math.sqrt(3) / 2;
    const maxPsi = 1.3173627591574;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const authalicQ = latitude => {
      const sine = Math.sin(latitude);
      const denominator = 1 - eccentricitySquared * sine ** 2;
      return (1 - eccentricitySquared) * (
        sine / denominator
        - Math.log((1 - eccentricity * sine) / (1 + eccentricity * sine)) / (2 * eccentricity)
      );
    };
    const polarQ = authalicQ(Math.PI / 2);
    const authalicRadius = semiMajorAxis * Math.sqrt(polarQ / 2);
    const halfWorldWidth = authalicRadius * Math.PI / (m * coefficientA1);
    const halfWorldHeight = authalicRadius * maxPsi;
    const fullWorldWidth = halfWorldWidth * 2;
    const project = (longitude, latitude) => {
      const authalicLatitude = Math.asin(clamp(authalicQ(latitude * radians) / polarQ, -1, 1));
      const psi = Math.asin(clamp(m * Math.sin(authalicLatitude), -1, 1));
      const psiSquared = psi ** 2;
      const psiSixth = psiSquared ** 3;
      const denominator = coefficientA1 + 3 * coefficientA2 * psiSquared
        + psiSixth * (7 * coefficientA3 + 9 * coefficientA4 * psiSquared);
      return L.point(
        authalicRadius * longitude * radians * Math.cos(psi) / (m * denominator),
        authalicRadius * psi * (
          coefficientA1 + coefficientA2 * psiSquared
          + psiSixth * (coefficientA3 + coefficientA4 * psiSquared)
        )
      );
    };
    const projection = {
      bounds: L.bounds([-halfWorldWidth, -halfWorldHeight], [halfWorldWidth, halfWorldHeight]),
      project(latlng) {
        return project(latlng.lng, latlng.lat);
      },
      unproject(point) {
        const normalizedX = point.x / authalicRadius;
        const normalizedY = clamp(point.y / authalicRadius, -maxPsi, maxPsi);
        let psi = normalizedY;
        for (let iteration = 0; iteration < 12; iteration += 1) {
          const psiSquared = psi ** 2;
          const psiSixth = psiSquared ** 3;
          const value = psi * (
            coefficientA1 + coefficientA2 * psiSquared
            + psiSixth * (coefficientA3 + coefficientA4 * psiSquared)
          ) - normalizedY;
          const derivative = coefficientA1 + 3 * coefficientA2 * psiSquared
            + psiSixth * (7 * coefficientA3 + 9 * coefficientA4 * psiSquared);
          const correction = value / derivative;
          psi -= correction;
          if (Math.abs(correction) < 1e-11) break;
        }
        const longitude = m * normalizedX * (
          coefficientA1 + 3 * coefficientA2 * psi ** 2
          + psi ** 6 * (7 * coefficientA3 + 9 * coefficientA4 * psi ** 2)
        ) / Math.cos(psi) / radians;
        const authalicLatitude = Math.asin(clamp(Math.sin(psi) / m, -1, 1));
        const targetQ = polarQ * Math.sin(authalicLatitude);
        let latitude = authalicLatitude;
        for (let iteration = 0; iteration < 12; iteration += 1) {
          const sine = Math.sin(latitude);
          const denominator = 1 - eccentricitySquared * sine ** 2;
          const derivative = 2 * (1 - eccentricitySquared) * Math.cos(latitude) / denominator ** 2;
          if (Math.abs(derivative) < 1e-14) break;
          const correction = (authalicQ(latitude) - targetQ) / derivative;
          latitude -= correction;
          if (Math.abs(correction) < 1e-12) break;
        }
        return L.latLng(latitude / radians, clamp(longitude, -180, 180));
      }
    };

    equalEarthCRS = Object.create(L.CRS.Earth);
    equalEarthCRS.code = 'ESRI:54035';
    equalEarthCRS.projection = projection;
    equalEarthCRS.transformation = new L.Transformation(1 / fullWorldWidth, 0.5, -1 / fullWorldWidth, 0.5);
    equalEarthCRS.scale = zoom => 256 * Math.pow(2, zoom);
    equalEarthCRS.zoom = scale => Math.log(scale / 256) / Math.LN2;
    equalEarthCRS.infinite = false;
    return equalEarthCRS;
  }

  function calculateEqualEarthFitZoom(map) {
    const size = map.getSize();
    const bounds = createEqualEarthCRS().projection.bounds;
    const width = bounds.max.x - bounds.min.x;
    const height = bounds.max.y - bounds.min.y;
    const fitScale = Math.min(size.x / 256, size.y / (256 * height / width));
    return Number.isFinite(fitScale) && fitScale > 0 ? Math.log2(fitScale) : 0;
  }

  function calculateProjectionAreaScale(crs, latlng) {
    const semiMajorAxis = 6378137;
    const flattening = 1 / 298.257223563;
    const eccentricitySquared = flattening * (2 - flattening);
    const radians = Math.PI / 180;
    const latitude = Math.max(-85.0511287798066, Math.min(85.0511287798066, latlng.lat));
    const longitude = latlng.lng;
    const step = 1e-5;
    const west = crs.projection.project(L.latLng(latitude, longitude - step));
    const east = crs.projection.project(L.latLng(latitude, longitude + step));
    const south = crs.projection.project(L.latLng(latitude - step, longitude));
    const north = crs.projection.project(L.latLng(latitude + step, longitude));
    const longitudeScaleX = (east.x - west.x) / (2 * step * radians);
    const longitudeScaleY = (east.y - west.y) / (2 * step * radians);
    const latitudeScaleX = (north.x - south.x) / (2 * step * radians);
    const latitudeScaleY = (north.y - south.y) / (2 * step * radians);
    const sine = Math.sin(latitude * radians);
    const denominator = 1 - eccentricitySquared * sine ** 2;
    const primeVerticalRadius = semiMajorAxis / Math.sqrt(denominator);
    const meridianRadius = semiMajorAxis * (1 - eccentricitySquared) / denominator ** 1.5;
    const groundAreaPerRadian = primeVerticalRadius * Math.cos(latitude * radians) * meridianRadius;
    const projectedAreaPerRadian = Math.abs(
      longitudeScaleX * latitudeScaleY - latitudeScaleX * longitudeScaleY
    );
    return Math.sqrt(projectedAreaPerRadian / groundAreaPerRadian);
  }

  function getProjectionWorldWidth(crs) {
    const bounds = crs.projection.bounds;
    return bounds.max.x - bounds.min.x;
  }

  function adjustZoomForProjection(sourceCRS, targetCRS, center, zoom) {
    const sourceScale = calculateProjectionAreaScale(sourceCRS, center);
    const targetScale = calculateProjectionAreaScale(targetCRS, center);
    const sourceWidth = getProjectionWorldWidth(sourceCRS);
    const targetWidth = getProjectionWorldWidth(targetCRS);
    const adjustedZoom = zoom + Math.log2(
      targetWidth * sourceScale / (sourceWidth * targetScale)
    );
    return Number.isFinite(adjustedZoom) ? adjustedZoom : zoom;
  }

  function createEqualEarthLayer(quality = 'preview') {
    const EqualEarthGridLayer = L.GridLayer.extend({
      createTile(coords, done) {
        const tile = document.createElement('canvas');
        const tileSize = this.getTileSize();
        tile.width = tileSize.x;
        tile.height = tileSize.y;
        const tileClassName = basemapConfig[activeBasemapName].tileClassName;
        if (tileClassName) tile.classList.add(tileClassName);

        const crs = mapInstance.options.crs;
        const scale = crs.scale(coords.z);
        const topLeft = crs.transformation.untransform(L.point(coords.x * tileSize.x, coords.y * tileSize.y), scale);
        const bottomRight = crs.transformation.untransform(L.point((coords.x + 1) * tileSize.x, (coords.y + 1) * tileSize.y), scale);
        const basemap = basemapConfig[activeBasemapName];
        const requestSize = this.options.exportQuality === 'high' ? tileSize.x : Math.floor(tileSize.x / 2);
        const url = new URL(`${basemap.exportUrl}/export`);
        url.search = new URLSearchParams({
          bbox: [topLeft.x, bottomRight.y, bottomRight.x, topLeft.y].map(value => value.toFixed(2)).join(','),
          bboxSR: '54035',
          imageSR: '54035',
          size: `${requestSize},${requestSize}`,
          format: 'png32',
          transparent: 'false',
          f: 'image'
        }).toString();

        const image = new Image();
        image.crossOrigin = 'anonymous';
        tile._atlasImage = image;
        image.onload = () => {
          if (tile._atlasImage !== image) return;
          tile.getContext('2d').drawImage(image, 0, 0, tile.width, tile.height);
          tile._atlasImage = null;
          done(null, tile);
        };
        image.onerror = error => {
          if (tile._atlasImage !== image) return;
          tile._atlasImage = null;
          done(error, tile);
        };
        image.src = url.toString();
        return tile;
      }
    });

    const layer = new EqualEarthGridLayer({
      tileSize: 512,
      keepBuffer: 0,
      updateWhenIdle: true,
      updateWhenZooming: false,
      updateInterval: 250,
      exportQuality: quality,
      attribution: basemapConfig[activeBasemapName].attribution
    });
    layer.on('tileerror', () => { layer._atlasHasTileErrors = true; });
    layer.on('tileunload', event => {
      const image = event.tile._atlasImage;
      if (!image) return;
      image.onload = null;
      image.onerror = null;
      image.src = 'data:,';
      event.tile._atlasImage = null;
    });
    return layer;
  }

  function cancelEqualEarthHighQualityLoad() {
    clearTimeout(equalEarthQualityTimer);
    equalEarthQualityTimer = null;
    if (equalEarthHighQualityLayer && mapInstance.hasLayer(equalEarthHighQualityLayer)) {
      mapInstance.removeLayer(equalEarthHighQualityLayer);
    }
    equalEarthHighQualityLayer = null;
  }

  function scheduleEqualEarthHighQualityLoad() {
    clearTimeout(equalEarthQualityTimer);
    equalEarthQualityTimer = null;
    if (!equalEarthEnabled || !equalEarthLayer) return;

    equalEarthQualityTimer = setTimeout(() => {
      equalEarthQualityTimer = null;
      if (!equalEarthEnabled || !equalEarthLayer) return;

      const previewLayer = equalEarthLayer;
      const highQualityLayer = createEqualEarthLayer('high');
      equalEarthHighQualityLayer = highQualityLayer;
      highQualityLayer.once('load', () => {
        if (!equalEarthEnabled || equalEarthHighQualityLayer !== highQualityLayer) return;
        if (highQualityLayer._atlasHasTileErrors) {
          mapInstance.removeLayer(highQualityLayer);
          equalEarthHighQualityLayer = null;
          return;
        }
        if (mapInstance.hasLayer(previewLayer)) mapInstance.removeLayer(previewLayer);
        equalEarthLayer = highQualityLayer;
        equalEarthHighQualityLayer = null;
      });
      highQualityLayer.addTo(mapInstance);
    }, 2000);
  }

  function showEqualEarthPreviewDuringNavigation() {
    if (!equalEarthEnabled) return;
    cancelEqualEarthHighQualityLoad();
    if (!equalEarthLayer || equalEarthLayer.options.exportQuality !== 'high') return;

    mapInstance.removeLayer(equalEarthLayer);
    equalEarthLayer = createEqualEarthLayer('preview');
    equalEarthLayer.addTo(mapInstance);
  }

  function updateProjectionButton() {
    const button = document.getElementById('btn-equal-earth');
    if (!button) return;
    button.setAttribute('aria-pressed', String(equalEarthEnabled));
    button.title = equalEarthEnabled
      ? 'Voltar à projeção original do mapa'
      : 'Reprojetar o mapa para WGS 84 / Equal Earth (EPSG:8857)';
    const badge = button.querySelector('.projection-toggle-badge');
    const label = button.querySelector('.projection-toggle-label');
    if (badge) badge.textContent = equalEarthEnabled ? 'ATIVO' : 'NOVO!';
    if (label) label.textContent = equalEarthEnabled ? 'Voltar ao original' : 'Equal Earth';
  }

  function toggleEqualEarthProjection() {
    mapInstance.fire('atlas1910:beforeprojectionchange');
    cancelEqualEarthHighQualityLoad();
    const enableEqualEarth = !equalEarthEnabled;
    const center = mapInstance.getCenter();
    const zoom = mapInstance.getZoom();
    const sourceCRS = mapInstance.options.crs;
    const targetCRS = enableEqualEarth ? createEqualEarthCRS() : L.CRS.EPSG3857;
    const targetZoom = adjustZoomForProjection(sourceCRS, targetCRS, center, zoom);

    if (enableEqualEarth) {
      if (activeTileLayer && mapInstance.hasLayer(activeTileLayer)) mapInstance.removeLayer(activeTileLayer);
    } else if (equalEarthLayer && mapInstance.hasLayer(equalEarthLayer)) {
      mapInstance.removeLayer(equalEarthLayer);
    }

    mapInstance.setMaxBounds(null);
    equalEarthEnabled = enableEqualEarth;
    mapInstance.options.crs = targetCRS;
    mapInstance.setView(center, targetZoom, { animate: false });
    updateWorldBounds(enableEqualEarth ? EQUAL_EARTH_BOUNDS : WORLD_BOUNDS);

    if (enableEqualEarth) {
      equalEarthLayer = createEqualEarthLayer('preview');
      equalEarthLayer.addTo(mapInstance);
      scheduleEqualEarthHighQualityLoad();
    } else {
      equalEarthLayer = null;
      activeTileLayer.addTo(mapInstance);
    }

    updateProjectionButton();
  }

  function constrainMapToSingleWorld(map) {
    let worldBounds = WORLD_BOUNDS;
    map.options.maxBoundsViscosity = 1;
    map.options.worldCopyJump = false;
    map.setMaxBounds(worldBounds);

    const updateMinimumZoom = () => {
      const size = map.getSize();
      if (!size.x || !size.y) return;

      const zoomSnap = map.options.zoomSnap || 1;
      const fitZoom = map.options.crs.code === 'ESRI:54035'
        ? calculateEqualEarthFitZoom(map)
        : map.getBoundsZoom(worldBounds, false);
      const minimumZoom = Math.max(0, Math.floor(fitZoom / zoomSnap) * zoomSnap);
      map.setMinZoom(minimumZoom);
      if (map.getZoom() < minimumZoom) {
        map.setZoom(minimumZoom, { animate: false });
      }
    };

    updateWorldBounds = bounds => {
      worldBounds = bounds;
      map.setMaxBounds(worldBounds);
      updateMinimumZoom();
    };

    updateMinimumZoom();
    map.on('resize', updateMinimumZoom);
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => {
        map.invalidateSize({ pan: false, debounceMoveend: true });
        updateMinimumZoom();
      }).observe(map.getContainer());
    } else {
      window.addEventListener('resize', () => {
        map.invalidateSize({ pan: false, debounceMoveend: true });
        updateMinimumZoom();
      });
    }
  }

  function setupAutoCollapseMapPanels() {
    const panel = document.getElementById('map-filter-panel');
    const button = document.getElementById('btn-map-filter-toggle');
    if (panel && button) {
      L.DomEvent.disableClickPropagation(panel);
      button.addEventListener('click', event => {
        event.stopPropagation();
        const expanded = button.getAttribute('aria-expanded') !== 'true';
        panel.classList.toggle('is-collapsed', !expanded);
        button.setAttribute('aria-expanded', String(expanded));
        button.title = expanded ? 'Recolher filtros' : 'Expandir filtros';
      });
    }

    const legend = document.getElementById('jenks-legend');
    const legendButton = document.getElementById('btn-map-legend-toggle');
    if (legend && legendButton) {
      L.DomEvent.disableClickPropagation(legend);
      legendButton.addEventListener('click', event => {
        event.stopPropagation();
        const expanded = legendButton.getAttribute('aria-expanded') !== 'true';
        legend.classList.toggle('is-collapsed', !expanded);
        legendButton.setAttribute('aria-expanded', String(expanded));
        legendButton.title = `${expanded ? 'Recolher' : 'Expandir'} legenda`;
      });
    }
  }

  function setupMapNavigationControls(map) {
    const zoomSlider = document.getElementById('map-zoom-slider');
    const minLabel = document.getElementById('map-zoom-min');
    const maxLabel = document.getElementById('map-zoom-max');
    const zoomInButton = document.getElementById('btn-map-zoom-in');
    const zoomOutButton = document.getElementById('btn-map-zoom-out');
    const formatZoom = value => Number(value.toFixed(2)).toString();

    const updateZoomLimits = () => {
      if (!zoomSlider) return;
      const minZoom = map.getMinZoom();
      const configuredMax = map.getMaxZoom();
      const maxZoom = Number.isFinite(configuredMax) ? configuredMax : 19;
      zoomSlider.min = String(minZoom);
      zoomSlider.max = String(maxZoom);
      zoomSlider.step = String(map.options.zoomSnap || 1);
      zoomSlider.disabled = minZoom >= maxZoom;
      if (minLabel) minLabel.textContent = `Mín ${formatZoom(minZoom)}`;
      if (maxLabel) maxLabel.textContent = `Máx ${formatZoom(maxZoom)}`;
      updateZoomControls();
    };

    const updateZoomControls = () => {
      if (!zoomSlider) return;
      const zoom = map.getZoom();
      zoomSlider.value = String(zoom);
      zoomSlider.setAttribute('aria-valuetext', `Zoom ${formatZoom(zoom)}`);
      if (zoomInButton) zoomInButton.disabled = zoom >= map.getMaxZoom();
      if (zoomOutButton) zoomOutButton.disabled = zoom <= map.getMinZoom();
    };

    if (zoomSlider) {
      zoomSlider.addEventListener('input', () => map.setZoom(Number(zoomSlider.value)));
      map.on('zoomend', updateZoomControls);
      map.on('resize', updateZoomLimits);
      map.on('zoomlevelschange', updateZoomLimits);
    }
    if (zoomInButton) zoomInButton.addEventListener('click', () => map.zoomIn());
    if (zoomOutButton) zoomOutButton.addEventListener('click', () => map.zoomOut());

    updateZoomLimits();
    const scaleControl = L.control.scale({
      position: 'topleft',
      maxWidth: 140,
      metric: true,
      imperial: false
    }).addTo(map);
    const scaleSlot = document.getElementById('map-scale-slot');
    const scaleElement = scaleControl.getContainer();
    if (scaleSlot && scaleElement) scaleSlot.appendChild(scaleElement);
  }

  // Definição dos mapas base oficiais 100% gratuitos e de alta disponibilidade com sincronização de zoom
  function createBasemapLayers() {
    const tileOptions = {
      maxZoom: 19,
      keepBuffer: 4,
      updateWhenIdle: false,
      updateWhenZooming: false,
      noWrap: true,
      bounds: WORLD_BOUNDS
    };

    return {
      "Esri Escuro": {
        label: "Escuro",
        title: "Modo Escuro quase preto (Esri Dark Canvas)",
        backgroundColor: "#09090b",
        exportUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer',
        attribution: '&copy; Esri, DeLorme, NAVTEQ',
        layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          attribution: '&copy; Esri - Esri, DeLorme, NAVTEQ',
          ...tileOptions
        })
      },
      "Esri Claro": {
        label: "Claro",
        title: "Modo Claro (Esri Light Canvas)",
        backgroundColor: "#f2f2f2",
        exportUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer',
        attribution: '&copy; Esri, DeLorme, NAVTEQ',
        layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          attribution: '&copy; Esri - Esri, DeLorme, NAVTEQ',
          ...tileOptions
        })
      },
      "Satélite": {
        label: "Satélite",
        title: "Fotografia Aérea e Satélite (Esri World Imagery)",
        backgroundColor: "#1b1b1b",
        exportUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
        attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
          ...tileOptions
        })
      },
      "Ruas (OSM)": {
        label: "Ruas",
        title: "Vias e Mobilidade (OpenStreetMap)",
        backgroundColor: "#f2efe9",
        exportUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer',
        attribution: '&copy; Esri, HERE, Garmin, OpenStreetMap contributors',
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
    constrainMapToSingleWorld,
    setupMapNavigationControls,

    init(map, initialTheme = "dark") {
      mapInstance = map;
      basemapConfig = createBasemapLayers();

      activeBasemapName = initialTheme === "light" ? "Esri Claro" : "Esri Escuro";
      activeTileLayer = basemapConfig[activeBasemapName].layer;
      this.updateMatteColor();
      activeTileLayer.addTo(mapInstance);
      this.renderControls();
      setupAutoCollapseMapPanels();
      mapInstance.on('movestart zoomstart', showEqualEarthPreviewDuringNavigation);
      mapInstance.on('moveend zoomend resize', scheduleEqualEarthHighQualityLoad);
      const projectionButton = document.getElementById('btn-equal-earth');
      if (projectionButton) projectionButton.addEventListener('click', toggleEqualEarthProjection);
      updateProjectionButton();
    },

    switchBasemap(name) {
      if (!basemapConfig[name] || name === activeBasemapName) return;

      if (activeTileLayer && mapInstance.hasLayer(activeTileLayer)) {
        mapInstance.removeLayer(activeTileLayer);
      }

      activeTileLayer = basemapConfig[name].layer;
      activeBasemapName = name;
      if (equalEarthEnabled) {
        cancelEqualEarthHighQualityLoad();
        if (equalEarthLayer && mapInstance.hasLayer(equalEarthLayer)) mapInstance.removeLayer(equalEarthLayer);
        equalEarthLayer = createEqualEarthLayer('preview');
        equalEarthLayer.options.attribution = basemapConfig[name].attribution;
        equalEarthLayer.addTo(mapInstance);
        scheduleEqualEarthHighQualityLoad();
      } else {
        activeTileLayer.addTo(mapInstance);
      }
      this.updateMatteColor();

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
    },

    updateMatteColor() {
      const basemap = basemapConfig[activeBasemapName];
      if (!mapInstance || !basemap) return;
      mapInstance.getContainer().style.setProperty('--basemap-matte-color', basemap.backgroundColor);
    }
  };
})();
