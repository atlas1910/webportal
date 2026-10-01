import { NextResponse, type NextRequest } from "next/server";

const brabasSubgroups = ["estadios_brabas-", "competicoes_brabas-"];
const brabasLayerIds = new Set([
  "df67ecab0618",
  "36d4c656fee1",
  "4d1882104353",
  "4ff7aa65d52a",
  "a71c5be830df",
  "libertadores-2026"
]);

export function proxy(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const subgroup = searchParams.get("subgrupo") ?? "";
  const layer = searchParams.get("camada") ?? "";

  if (!subgroup && !layer) return;

  const isBrabas = subgroup
    ? brabasSubgroups.some((prefix) => subgroup.startsWith(prefix))
    : brabasLayerIds.has(layer);
  const destination = request.nextUrl.clone();
  destination.pathname = isBrabas ? "/as-brabas.html" : "/sccp-principal/";

  return NextResponse.redirect(destination);
}

export const config = {
  matcher: "/"
};