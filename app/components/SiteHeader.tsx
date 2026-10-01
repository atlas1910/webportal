import Link from "next/link";
import Image from "next/image";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand-link" href="/" aria-label="ATLAS1910 - página inicial">
        <Image
          className="brand-mark"
          src="/assets/PRETO-TRANSPARENTE.png"
          alt=""
          width="39"
          height="39"
          priority
        />
        <span className="brand-word">
          <strong>ATLAS1910</strong>
          <span>Acervo cartográfico corinthiano</span>
        </span>
      </Link>
      <nav className="header-nav" aria-label="Navegação principal">
        <Link href="/acervo/">O acervo</Link>
        <a href="/as-brabas/">As Brabas</a>
      </nav>
    </header>
  );
}
