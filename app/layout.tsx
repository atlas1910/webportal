import type { Metadata, Viewport } from "next";
import { Geist, Host_Grotesk, Special_Gothic_Expanded_One } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { siteUrl } from "./site-config";

const hostGrotesk = Host_Grotesk({
  subsets: ["latin"],
  variable: "--font-host-grotesk",
  display: "swap"
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap"
});

const specialGothic = Special_Gothic_Expanded_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-special-gothic",
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ATLAS1910 | História do Corinthians em mapas",
    template: "%s | ATLAS1910"
  },
  description:
    "Explore a história do Corinthians por mapas, estádios, partidas, competições e trajetórias da Fiel desde 1910.",
  applicationName: "ATLAS1910",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ATLAS1910",
    title: "ATLAS1910 | História do Corinthians em mapas",
    description:
      "Um acervo cartográfico para explorar estádios, partidas, competições e a presença corinthiana pelo mundo.",
    url: "/",
    images: [{ url: "/opengraph-image/", alt: "ATLAS1910 - História do Corinthians em mapas" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "ATLAS1910 | História do Corinthians em mapas",
    description:
      "Explore a história espacial do Corinthians e descubra o acervo cartográfico.",
    images: ["/opengraph-image/"]
  },
  robots: { index: true, follow: true, "max-image-preview": "large" },
  verification: { google: "oSYfTQ0djI2NnaF3FBZlKP6FfPmYBijoKoUEi-QSpSE" },
  icons: { icon: "/assets/favicon.png" }
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${hostGrotesk.variable} ${geist.variable} ${specialGothic.variable}`}
    >
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
