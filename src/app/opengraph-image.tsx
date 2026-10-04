import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { palette3d as c } from "@/components/three/palette";
import { site } from "@/lib/site";

export const alt = `${site.name} — rare disease, connected. A DNA helix grows from a forest into an evidence graph.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Blender/Cycles hero poster (blender/build_hero.py) on the brand page wash.
export default async function Image() {
  const [poster, logo] = await Promise.all([
    readFile(join(process.cwd(), "public", "models", "nexmed-hero.png")),
    readFile(join(process.cwd(), "public", "brand", "nexmed-logo-192.png")),
  ]);
  const src = `data:image/png;base64,${poster.toString("base64")}`;
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: `linear-gradient(180deg, ${c.brandMist}, #ffffff)`, padding: "56px 40px 56px 72px" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 640 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} width={72} height={72} alt="" style={{ borderRadius: 999 }} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 44, fontWeight: 700, color: c.brandInk }}>{site.name}</span>
              <span style={{ fontSize: 22, color: c.brandDeep }}>AI atlas for rare diseases</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 44, fontSize: 76, fontWeight: 700, lineHeight: 1.02, color: c.brandInk }}>
            <span>Rare disease,</span>
            <span style={{ color: c.brandDeep }}>connected.</span>
          </div>
          <span style={{ marginTop: 28, fontSize: 28, lineHeight: 1.3, color: c.ink2 }}>The rare disease atlas where every connection shows its source.</span>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={500} height={500} alt="" />
        </div>
      </div>
    ),
    { ...size },
  );
}
