import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>ATLAS1910 - Acervo Cartográfico do Corinthians</span>
      <span>
        <Link href="/acervo/">Sobre o acervo</Link>
        {" · "}
        <Link href="/sccp-principal/" prefetch={false}>Abrir o mapa</Link>
      </span>
    </footer>
  );
}
