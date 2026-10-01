import { ImageResponse } from "next/og";

export const alt = "ATLAS1910 - História do Corinthians em mapas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          alignItems: "center",
          overflow: "hidden",
          backgroundColor: "#050505",
          color: "#f4f4f5",
          fontFamily: "Arial",
          padding: "76px"
        }}
      >
        <svg
          width="850"
          height="660"
          viewBox="0 0 850 660"
          style={{ position: "absolute", right: "-80px", top: "-20px", opacity: 0.3 }}
        >
          <g fill="none" stroke="#f4f4f5" strokeWidth="1.4">
            <path d="M430 65 513 114 557 169 531 231 596 271 564 332 614 382 587 437 647 488 605 550 691 603" />
            <path d="M365 126 430 65 390 195 455 246 403 292 478 337 430 397 502 441 458 512 532 567" />
            <path d="M275 202 365 126 390 195 329 254 403 292 349 358 430 397 371 462 458 512" />
            <path d="M531 231 455 246 478 337 564 332 502 441 587 437 532 567 605 550" />
            <path d="M231 322 329 254 349 358 271 413 371 462 304 520 458 512" />
            <path d="M165 132H690M122 258H744M115 390H720M188 524H688" strokeOpacity=".4" />
          </g>
          <g fill="#fff">
            <circle cx="275" cy="202" r="5" />
            <circle cx="403" cy="292" r="5" />
            <circle cx="564" cy="332" r="5" />
            <circle cx="371" cy="462" r="5" />
            <circle cx="605" cy="550" r="5" />
          </g>
        </svg>
        <div
          style={{
            display: "flex",
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, #050505 0%, rgba(5,5,5,.95) 43%, rgba(5,5,5,.35) 100%)"
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", position: "relative", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, color: "#c9c9cf", fontSize: 18, letterSpacing: 7 }}>
            <span style={{ width: 40, height: 2, backgroundColor: "#f4f4f5" }} />
            ACERVO CARTOGRÁFICO · DESDE 1910
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 68, fontWeight: 700, letterSpacing: 0, lineHeight: 1.03 }}>
            <span>O Corinthians visto</span>
            <span>em mapa e sob uma</span>
            <span style={{ color: "#a9a9b1" }}>perspectiva espacial.</span>
          </div>
          <div style={{ display: "flex", color: "#c8c8ce", fontSize: 24 }}>
            Estádios · partidas · competições · presença da Fiel
          </div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 20, fontWeight: 700, letterSpacing: 5 }}>
            ATLAS1910
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
