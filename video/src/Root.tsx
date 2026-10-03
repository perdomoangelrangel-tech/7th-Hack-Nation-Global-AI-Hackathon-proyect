import React from "react";
import { Composition, Folder } from "remotion";
import { FPS, H, W } from "./theme";
import { loadBrandFonts } from "./fonts";
import { SCENES } from "./scenes";
import { Cut, CutProps } from "./cuts/Cut";
import { CUTS, cutFrames } from "./cuts/timeline";

loadBrandFonts();

const CUT_IDS: Record<string, string> = { pitch60: "Pitch60", pitch120: "Pitch120", tech60: "Tech60", tech120: "Tech120" };
const CUT_COMPONENTS: Record<string, React.FC<CutProps>> = Object.fromEntries(
  CUTS.map((cut) => {
    const C: React.FC<CutProps> = (p) => <Cut cut={cut} {...p} />;
    C.displayName = `Cut_${cut.id}`;
    return [cut.id, C];
  }),
);

/**
 * Scenes/  → each scene at its natural length (render these at full quality).
 * Cuts/    → assembled videos with recording + audio slots (guides on = draft overlay).
 * Variants → a couple of scene variants used by the tech cut.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Cuts">
      {CUTS.map((cut) => (
        <Composition
          key={cut.id}
          id={CUT_IDS[cut.id]}
          component={CUT_COMPONENTS[cut.id]}
          durationInFrames={cutFrames(cut, FPS)}
          fps={FPS}
          width={W}
          height={H}
          defaultProps={{ guides: true, sfxVolume: 1 } as CutProps}
        />
      ))}
    </Folder>
    <Folder name="Scenes">
      {Object.entries(SCENES).map(([id, sc]) => (
        <Composition key={id} id={id} component={sc.component} durationInFrames={sc.natural * FPS} fps={FPS} width={W} height={H} />
      ))}
    </Folder>
    <Folder name="Variants">
      <Composition
        id="TitleCardTech"
        component={SCENES.TitleCard.component}
        durationInFrames={SCENES.TitleCard.natural * FPS}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ line: "Under the map." }}
      />
      <Composition
        id="ScaleNetworkTech"
        component={SCENES.ScaleNetwork.component}
        durationInFrames={SCENES.ScaleNetwork.natural * FPS}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ tech: true }}
      />
    </Folder>
  </>
);
