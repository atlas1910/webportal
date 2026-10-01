import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(projectRoot, "public");
const width = 800;
const height = 420;
const pad = 28;

async function readGeoJson(relativePath, baseDirectory = publicRoot) {
  const filePath = path.join(baseDirectory, relativePath);
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.features)) {
    throw new Error(`Expected a GeoJSON FeatureCollection in ${relativePath}`);
  }
  return parsed.features;
}

function collectCoordinates(value, result = []) {
  if (!Array.isArray(value)) return result;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    result.push([value[0], value[1]]);
    return result;
  }
  for (const item of value) collectCoordinates(item, result);
  return result;
}

function geometryCoordinates(features) {
  return features.flatMap((feature) =>
    collectCoordinates(feature.geometry?.coordinates)
  );
}

function extentFor(coordinates, fallback) {
  if (!coordinates.length) return fallback;
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  const raw = [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes)
  ];
  const dx = Math.max(raw[2] - raw[0], 0.15);
  const dy = Math.max(raw[3] - raw[1], 0.15);
  const marginX = dx * 0.08;
  const marginY = dy * 0.08;
  return [raw[0] - marginX, raw[1] - marginY, raw[2] + marginX, raw[3] + marginY];
}

function createProject(extent) {
  const [minLon, minLat, maxLon, maxLat] = extent;
  const innerWidth = width - pad * 2;
  const innerHeight = height - pad * 2;
  const aspect = innerWidth / innerHeight;
  const geographicAspect = (maxLon - minLon) / (maxLat - minLat);
  let adjustedMinLon = minLon;
  let adjustedMaxLon = maxLon;
  let adjustedMinLat = minLat;
  let adjustedMaxLat = maxLat;
  if (geographicAspect > aspect) {
    const center = (minLat + maxLat) / 2;
    const newHeight = (maxLon - minLon) / aspect;
    adjustedMinLat = center - newHeight / 2;
    adjustedMaxLat = center + newHeight / 2;
  } else {
    const center = (minLon + maxLon) / 2;
    const newWidth = (maxLat - minLat) * aspect;
    adjustedMinLon = center - newWidth / 2;
    adjustedMaxLon = center + newWidth / 2;
  }
  return ([longitude, latitude]) => [
    pad + ((longitude - adjustedMinLon) / (adjustedMaxLon - adjustedMinLon)) * innerWidth,
    height - pad - ((latitude - adjustedMinLat) / (adjustedMaxLat - adjustedMinLat)) * innerHeight
  ];
}

function svgStart(title, description) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">${title}</title><desc id="desc">${description}</desc><defs><pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width=".7"/></pattern><radialGradient id="glow"><stop stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><style>.route{fill:none;stroke:#f4f4f5;stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:8 9;animation:flow 22s linear infinite}.route:nth-of-type(3n){stroke-opacity:.55;animation-duration:31s}.point{fill:#fff;stroke:#fff;stroke-width:1;animation:pulse 3.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}.point:nth-of-type(3n){animation-delay:1.1s}@keyframes flow{to{stroke-dashoffset:-340}}@keyframes pulse{0%,100%{opacity:.52;transform:scale(.8)}50%{opacity:1;transform:scale(1.4)}}@media(prefers-reduced-motion:reduce){.route,.point{animation:none!important}}</style></defs><rect width="${width}" height="${height}" fill="#090a0e"/><rect width="${width}" height="${height}" fill="url(#grid)"/><ellipse cx="${width * 0.52}" cy="${height * 0.48}" rx="${width * 0.48}" ry="${height * 0.62}" fill="url(#glow)"/>`;
}

function makeSvg(features, title, description, extent, { points = true, lines = true } = {}) {
  const project = createProject(extentFor(geometryCoordinates(features), extent));
  const output = [svgStart(title, description)];
  output.push(`<path d="M0 ${height * 0.77}H${width}M${width * 0.2} 0V${height}M${width * 0.8} 0V${height}" fill="none" stroke="#fff" stroke-opacity=".1" stroke-width=".8"/>`);
  let pathIndex = 0;
  for (const feature of features) {
    const type = feature.geometry?.type;
    const coords = feature.geometry?.coordinates;
    if (!coords) continue;
    if (lines && (type === "LineString" || type === "MultiLineString")) {
      const linesToDraw = type === "LineString" ? [coords] : coords;
      for (const line of linesToDraw) {
        const sampled = line.filter((_, index) => index === 0 || index === line.length - 1 || index % Math.max(1, Math.ceil(line.length / 240)) === 0);
        if (sampled.length < 2) continue;
        const commands = sampled.map((point, index) => {
          const [x, y] = project(point);
          return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
        }).join(" ");
        output.push(`<path class="route" style="animation-delay:-${(pathIndex++ % 17) * 1.4}s" d="${commands}"/>`);
      }
    } else if (points && (type === "Point" || type === "MultiPoint")) {
      const pointsToDraw = type === "Point" ? [coords] : coords;
      for (const point of pointsToDraw) {
        const [x, y] = project(point);
        output.push(`<circle class="point" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${pathIndex++ % 7 === 0 ? 2.5 : 1.4}"/>`);
      }
    }
  }
  output.push(`<text x="${width - 20}" y="${height - 14}" fill="#fff" fill-opacity=".43" text-anchor="end" font-family="Arial,sans-serif" font-size="9" letter-spacing="2">ATLAS1910 · MAPA DE DADOS</text></svg>`);
  return output.join("");
}

function projectWorld([longitude, latitude]) {
  const x = pad + ((longitude + 180) / 360) * (width - pad * 2);
  const y = pad + ((90 - latitude) / 180) * (height - pad * 2);
  return [x, y];
}

function countryPath(feature) {
  const { type, coordinates } = feature.geometry || {};
  if (!coordinates) return "";
  const polygons = type === "Polygon"
    ? [coordinates]
    : type === "MultiPolygon"
      ? coordinates
      : [];
  const paths = [];

  for (const polygon of polygons) {
    const ring = polygon[0];
    if (!ring) continue;
    const step = Math.max(1, Math.ceil(ring.length / 48));
    const sampled = ring.filter((_, index) =>
      index === 0 || index === ring.length - 1 || index % step === 0
    );
    if (sampled.length < 3) continue;

    const projected = sampled.map(projectWorld);
    let twiceArea = 0;
    for (let index = 0; index < projected.length; index += 1) {
      const current = projected[index];
      const next = projected[(index + 1) % projected.length];
      twiceArea += current[0] * next[1] - next[0] * current[1];
    }
    if (Math.abs(twiceArea) < 8) continue;

    const commands = projected.map(([x, y], index) =>
      `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`
    ).join(" ");
    paths.push(`${commands} Z`);
  }

  return paths.join(" ");
}

function makeWorldMapSvg(countries, locations) {
  const output = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    "<title id=\"title\">Mapa-múndi do ATLAS1910</title>",
    "<desc id=\"desc\">Contornos reais dos países com pontos luminosos das localizações de estádios e núcleos da Fiel.</desc>",
    "<defs>",
    "<filter id=\"point-glow\" x=\"-200%\" y=\"-200%\" width=\"400%\" height=\"400%\"><feGaussianBlur stdDeviation=\"5\" result=\"blur\"/><feMerge><feMergeNode in=\"blur\"/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter>",
    "<pattern id=\"map-grid\" width=\"80\" height=\"80\" patternUnits=\"userSpaceOnUse\"><path d=\"M80 0H0V80\" fill=\"none\" stroke=\"#fff\" stroke-opacity=\".05\" stroke-width=\".7\"/></pattern>",
    "<style>.country{fill:#fff;fill-opacity:.025;stroke:#e4e4e7;stroke-opacity:.34;stroke-width:.85;stroke-linejoin:round;vector-effect:non-scaling-stroke}.map-point-halo{fill:#ef4444;opacity:.82;filter:url(#point-glow);animation:point-glow 3.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}.map-point{fill:#ffe4e6;animation:point-pulse 3.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}@keyframes point-glow{0%,100%{opacity:.32;transform:scale(.72)}50%{opacity:.88;transform:scale(1.35)}}@keyframes point-pulse{0%,100%{opacity:.58}50%{opacity:1}}@media(prefers-reduced-motion:reduce){.map-point-halo,.map-point{animation:none!important}}</style>",
    "</defs>",
    `<rect width="${width}" height="${height}" fill="#050505"/>`,
    `<rect width="${width}" height="${height}" fill="url(#map-grid)"/>`,
    `<path d="M${width / 2} ${pad}V${height - pad}M${pad} ${height / 2}H${width - pad}" fill="none" stroke="#fff" stroke-opacity=".1" stroke-width="1"/>`
  ];

  for (const feature of countries) {
    const path = countryPath(feature);
    if (path) output.push(`<path class="country" d="${path}"/>`);
  }

  let pointIndex = 0;
  for (const feature of locations) {
    const coordinates = feature.geometry?.type === "Point"
      ? [feature.geometry.coordinates]
      : [];
    for (const coordinate of coordinates) {
      const [x, y] = projectWorld(coordinate);
      const delay = -((pointIndex * 0.23) % 3.6).toFixed(2);
      output.push(`<circle class="map-point-halo" style="animation-delay:${delay}s" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5"/>`);
      output.push(`<circle class="map-point" style="animation-delay:${delay}s" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5"/>`);
      pointIndex += 1;
    }
  }

  output.push("</svg>");
  return output.join("");
}

function selectMapLocations(features, limit = Infinity) {
  const seen = new Set();
  const unique = features.filter((feature) => {
    if (feature.geometry?.type !== "Point") return false;
    const [longitude, latitude] = feature.geometry.coordinates;
    const key = `${longitude.toFixed(1)},${latitude.toFixed(1)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const step = Math.max(1, Math.ceil(unique.length / limit));
  return unique.filter((_, index) => index % step === 0);
}

async function writeWorldMapPreview(countries, locations) {
  const target = path.join(publicRoot, "previews", "world-atlas.svg");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, makeWorldMapSvg(countries, locations), "utf8");
  console.log(`Generated ${path.relative(projectRoot, target)} from ${countries.length} countries and ${locations.length} locations`);
}

async function writePreview(fileName, features, title, description, extent, options) {
  if (!features.length) throw new Error(`No features found for ${fileName}`);
  const target = path.join(publicRoot, "previews", fileName);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, makeSvg(features, title, description, extent, options), "utf8");
  console.log(`Generated ${path.relative(projectRoot, target)} from ${features.length} features`);
}

const southAmerica = [-82, -57, -29, 14];
const worldCountries = await readGeoJson(
  "basemap/paises_limites_wof.geojson",
  path.join(projectRoot, "scripts", "data")
);
const stadiums = await readGeoJson("data/estadios/estadios_estatisticas_unificadas.geojson");
const brabas = await readGeoJson("data/as_brabas/as_brabas_estadios_unificadas.geojson");
const supporters = await readGeoJson("data/torcidas/fiel_pelo_mundo.geojson");
const competition = await readGeoJson("data/competicoes/libertadores-2026.geojson");
const routeNames = [
  "arena-da-baixada.geojson",
  "vila-belmiro.geojson",
  "arena-conda.geojson",
  "barradao.geojson",
  "mirassol.geojson",
  "engenhao.geojson",
  "arena-fonte-nova.geojson",
  "braganca-paulista.geojson",
  "couto-pereira.geojson",
  "arena-mrv.geojson",
  "beira-rio.geojson",
  "mangueirao.geojson",
  "sao-januario.geojson"
];
const routes = [];
for (const routeName of routeNames) {
  routes.push(...await readGeoJson(`data/deslocamentos/brasileirao-2026/${routeName}`));
}

await writePreview(
  "estadios.svg",
  stadiums,
  "Estádios e locais do acervo",
  "Prévia em preto e branco derivada das localizações da camada combinada de estádios masculinos.",
  southAmerica
);
await writePreview(
  "deslocamentos.svg",
  routes,
  "Rotas de deslocamento",
  "Prévia monocromática derivada das geometrias de rota do subgrupo Campeonato Brasileiro 2026.",
  southAmerica,
  { points: false }
);
await writeWorldMapPreview(worldCountries, [
  ...selectMapLocations(supporters),
  ...selectMapLocations(stadiums, 70)
]);
await writePreview(
  "torcidas.svg",
  supporters,
  "Fiel Pelo Mundo",
  "Prévia em preto e branco dos pontos do conjunto Fiel Pelo Mundo.",
  [-180, -70, 180, 78]
);
await writePreview(
  "brabas-libertadores.svg",
  competition,
  "Libertadores Feminina 2026",
  "Prévia em preto e branco das localizações de equipes da camada Libertadores 2026.",
  southAmerica
);
await writePreview(
  "brabas-estadios.svg",
  brabas,
  "Estádios das Brabas",
  "Prévia em preto e branco derivada das localizações da camada combinada de estádios das Brabas.",
  southAmerica
);
