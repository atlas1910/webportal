import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(projectRoot, "legacy", "data");
const publicRoot = path.join(projectRoot, "public", "data");
const publishedFiles = [
  "partidas/corinthians_masculino.geojson",
  "estadios/estadios_estatisticas_unificadas.geojson",
  "as_brabas/as_brabas_jogos.geojson",
  "as_brabas/as_brabas_estadios_unificadas.geojson",
  "as_brabas/brabas_bootstrap.json"
];

for (const relativePath of publishedFiles) {
  const sourcePath = path.join(sourceRoot, relativePath);
  const targetPath = path.join(publicRoot, relativePath);
  await fs.access(sourcePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

console.log(`Published ${publishedFiles.length} generated datasets to public/data`);
