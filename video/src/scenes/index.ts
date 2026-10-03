import React from "react";
import { TitleCard, TITLE_NATURAL, TITLE_SFX } from "./TitleCard";
import { OdysseyRoute, ODYSSEY_NATURAL, ODYSSEY_SFX } from "./OdysseyRoute";
import { MapBuild, MAPBUILD_NATURAL, MAPBUILD_SFX } from "./MapBuild";
import { AskAnswer, ASK_NATURAL, ASK_SFX } from "./AskAnswer";
import { VerifierGate, GATE_NATURAL, GATE_SFX } from "./VerifierGate";
import { Architecture, ARCH_NATURAL, ARCH_SFX } from "./Architecture";
import { DataModel, DATA_NATURAL, DATA_SFX } from "./DataModel";
import { RidersAndFares, FARES_NATURAL, FARES_SFX } from "./RidersAndFares";
import { ScaleNetwork, SCALE_NATURAL, SCALE_SFX } from "./ScaleNetwork";
import { Stack, STACK_NATURAL, STACK_SFX } from "./Stack";
import { EndCard, END_NATURAL, END_SFX } from "./EndCard";
import { Hook, HOOK_NATURAL, HOOK_SFX } from "./Hook";
import { Connections, CONNECTIONS_NATURAL, CONNECTIONS_SFX } from "./Connections";
import { NextStep, NEXTSTEP_NATURAL, NEXTSTEP_SFX } from "./NextStep";
import { Lessons, LESSONS_NATURAL, LESSONS_SFX } from "./Lessons";

/** SFX cue in scene-natural seconds. `until` cuts a long bed (ambience) with a short fade. */
export type Cue = { name: string; at: number; until?: number; volume?: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyScene = React.FC<any>;

export const SCENES: Record<string, { component: AnyScene; natural: number; sfx: Cue[] }> = {
  TitleCard: { component: TitleCard, natural: TITLE_NATURAL, sfx: TITLE_SFX },
  OdysseyRoute: { component: OdysseyRoute, natural: ODYSSEY_NATURAL, sfx: ODYSSEY_SFX },
  MapBuild: { component: MapBuild, natural: MAPBUILD_NATURAL, sfx: MAPBUILD_SFX },
  AskAnswer: { component: AskAnswer, natural: ASK_NATURAL, sfx: ASK_SFX },
  VerifierGate: { component: VerifierGate, natural: GATE_NATURAL, sfx: GATE_SFX },
  Architecture: { component: Architecture, natural: ARCH_NATURAL, sfx: ARCH_SFX },
  DataModel: { component: DataModel, natural: DATA_NATURAL, sfx: DATA_SFX },
  RidersAndFares: { component: RidersAndFares, natural: FARES_NATURAL, sfx: FARES_SFX },
  ScaleNetwork: { component: ScaleNetwork, natural: SCALE_NATURAL, sfx: SCALE_SFX },
  Stack: { component: Stack, natural: STACK_NATURAL, sfx: STACK_SFX },
  EndCard: { component: EndCard, natural: END_NATURAL, sfx: END_SFX },
  Hook: { component: Hook, natural: HOOK_NATURAL, sfx: HOOK_SFX },
  Connections: { component: Connections, natural: CONNECTIONS_NATURAL, sfx: CONNECTIONS_SFX },
  NextStep: { component: NextStep, natural: NEXTSTEP_NATURAL, sfx: NEXTSTEP_SFX },
  Lessons: { component: Lessons, natural: LESSONS_NATURAL, sfx: LESSONS_SFX },
};

export type SceneKey = keyof typeof SCENES;
