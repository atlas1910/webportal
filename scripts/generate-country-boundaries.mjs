import { gzipSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const catalogPath = join(projectRoot, "public", "js", "camadas.js");
const sourcePath = join(
  projectRoot,
  "scripts",
  "data",
  "basemap",
  "paises_limites_wof.geojson"
);
const statisticsPaths = {
  masculino: join(
    projectRoot,
    "public",
    "data",
    "estadios",
    "estadios_estatisticas_unificadas.geojson"
  ),
  brabas: join(
    projectRoot,
    "public",
    "data",
    "as_brabas",
    "as_brabas_estadios_unificadas.geojson"
  )
};

function readFeatureCollection(filePath) {
  const collection = JSON.parse(readFileSync(filePath, "utf8"));
  if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
    throw new Error(`Expected a GeoJSON FeatureCollection in ${filePath}`);
  }
  return collection;
}

function normalizeCountryName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function readCountryAliases() {
  const catalog = readFileSync(catalogPath, "utf8");
  const resolver = catalog.match(/function resolverCodigoPais\(nome\)\s*\{[\s\S]*?const aliases = \{([\s\S]*?)\};/);
  if (!resolver) {
    throw new Error(`Could not read country aliases from ${catalogPath}`);
  }

  const aliases = new Map(
    [...resolver[1].matchAll(/([A-Z0-9_]+):\s*"([A-Z]{3})"/g)]
      .map(([, name, code]) => [name, code])
  );
  if (aliases.size === 0) {
    throw new Error(`No country aliases were found in ${catalogPath}`);
  }
  return aliases;
}

const boundaries = readFeatureCollection(sourcePath);
const countryAliases = readCountryAliases();
const countryCodesByName = new Map();

for (const feature of boundaries.features) {
  const properties = feature.properties || {};
  const code = String(properties.ADM0_A3 || "").toUpperCase();
  if (!code) continue;

  for (const name of [
    properties.ADMIN,
    properties.NAME,
    properties.NAME_EN,
    properties.ISO_A2,
    code
  ]) {
    if (name) countryCodesByName.set(normalizeCountryName(name), code);
  }
}

const original = JSON.stringify(boundaries);
const originalBytes = Buffer.byteLength(original);
const originalGzipBytes = gzipSync(original).byteLength;

for (const [section, statisticsPath] of Object.entries(statisticsPaths)) {
  const statistics = readFeatureCollection(statisticsPath);
  const countryCodes = new Set();
  const unmatchedCountries = new Set();

  for (const feature of statistics.features) {
    const properties = feature.properties || {};
    const countryNameKey = Object.keys(properties).find(
      (key) => normalizeCountryName(key) === "PAIS"
    );
    const countryName = properties.PAIS
      || (countryNameKey ? properties[countryNameKey] : "")
      || properties.PAIS_FONTE
      || "";
    const explicitCode = String(properties.PAIS_ISO3 || "").toUpperCase();
    if (!countryName && !explicitCode) continue;

    const normalizedName = normalizeCountryName(countryName);
    const code = explicitCode
      || countryAliases.get(normalizedName)
      || countryCodesByName.get(normalizedName);
    if (code) countryCodes.add(code);
    else unmatchedCountries.add(String(countryName));
  }

  const selectedFeatures = boundaries.features.filter((feature) =>
    countryCodes.has(String(feature.properties?.ADM0_A3 || ""))
  );
  if (selectedFeatures.length === 0) {
    throw new Error(`No country boundaries matched the ${section} statistics.`);
  }

  const optimizedCollection = {
    ...boundaries,
    features: selectedFeatures
  };
  const output = `${JSON.stringify(optimizedCollection)}\n`;
  const outputPath = join(
    projectRoot,
    "public",
    "data",
    "basemap",
    `paises_limites_${section}.geojson`
  );
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, output, "utf8");

  if (unmatchedCountries.size > 0) {
    console.warn(
      `${section} country names without boundary codes:`,
      [...unmatchedCountries].join(", ")
    );
  }

  const optimizedBytes = Buffer.byteLength(output);
  const optimizedGzipBytes = gzipSync(output).byteLength;
  console.log(
    `Generated ${outputPath}: ${selectedFeatures.length}/${boundaries.features.length} countries; `
    + `${(100 * (1 - optimizedGzipBytes / originalGzipBytes)).toFixed(1)}% smaller over gzip `
    + `(${originalBytes} -> ${optimizedBytes} bytes raw; `
    + `${originalGzipBytes} -> ${optimizedGzipBytes} bytes gzip).`
  );
}
