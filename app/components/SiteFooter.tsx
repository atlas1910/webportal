import Link from "next/link";
import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>ATLAS1910 - Acervo Cartográfico do Corinthians</span>
      <span>
        <Link href="/acervo/">Sobre o acervo</Link>
        {" · "}
        <Link href="/sccp-principal/" prefetch={false}>Abrir o mapa</Link>
      </span>
      <nav className="atlas-social-links" aria-label="Redes sociais do ATLAS1910">
        <a
          className="atlas-social-link"
          href="https://www.instagram.com/atlas_1910/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram do ATLAS1910"
        >
          <Image src="/assets/icones/redes-sociais/instagram.svg" alt="" width={18} height={18} />
          <span>Instagram</span>
        </a>
        <a
          className="atlas-social-link"
          href="https://x.com/Atlas_1910"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="ATLAS1910 no X"
        >
          <Image src="/assets/icones/redes-sociais/x.svg" alt="" width={18} height={18} />
          <span>X</span>
        </a>
      </nav>
    </footer>
  );
}
