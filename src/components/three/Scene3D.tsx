"use client";
/**
 * Shared R3F canvas for Nexmed 3D: transparent (sits on the light page), brand lighting with a procedural
 * environment (Lightformers, no HDR download), DPR capped at 1.75, and it stops rendering when off-screen
 * or when the tab is hidden. Import it lazily (`next/dynamic`, `ssr: false`) — three.js stays out of the
 * first-load bundle.
 */
import { Canvas, useThree, type CanvasProps } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { palette3d } from "./palette";

export interface Scene3DProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  camera?: CanvasProps["camera"];
  /** Point the camera looks at (default origin). */
  target?: [number, number, number];
  dpr?: [number, number];
  /** Brand lights + environment; turn off to light the scene yourself. */
  lights?: boolean;
  /** Force-pause (e.g. an agent that is hidden). */
  paused?: boolean;
  /** Accessible label; omit for decorative scenes (aria-hidden). */
  label?: string;
  onClick?: () => void;
}

function LookAt({ target }: { target: [number, number, number] }) {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
  }, [camera, target]);
  return null;
}

export function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <hemisphereLight args={[palette3d.pearl, palette3d.ground, 0.55]} />
      <directionalLight position={[-3, 5, 4]} intensity={1.9} color={palette3d.keyLight} />
      <directionalLight position={[4, 1.5, 3]} intensity={0.55} color={palette3d.fillLight} />
      <directionalLight position={[1, 4, -4]} intensity={1.1} color={palette3d.rimLight} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={1.6} position={[-3, 3, 4]} scale={[6, 3, 1]} color={palette3d.keyLight} />
        <Lightformer form="rect" intensity={0.8} position={[4, 1, 2]} scale={[4, 4, 1]} color={palette3d.fillLight} />
        <Lightformer form="ring" intensity={1.2} position={[0, 4, -4]} scale={3} color={palette3d.rimLight} />
        <Lightformer form="rect" intensity={0.5} position={[0, -3, 0]} rotation-x={Math.PI / 2} scale={[8, 8, 1]} color={palette3d.brandSoft} />
      </Environment>
    </>
  );
}

function useOnScreen<T extends Element>() {
  const ref = useRef<T>(null);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let inView = true;
    const update = () => setOnScreen(inView && document.visibilityState === "visible");
    const io = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update(); }, { rootMargin: "160px" });
    io.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);
  return [ref, onScreen] as const;
}

export function Scene3D({ children, className, style, camera = { position: [0, 0.4, 5], fov: 34 }, target = [0, 0, 0], dpr = [1, 1.75], lights = true, paused, label, onClick }: Scene3DProps) {
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const running = onScreen && !paused;
  return (
    <div ref={ref} className={className} style={style} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} onClick={onClick}>
      <Canvas
        flat /* no tone mapping: brand blues render true to the CSS tokens */
        frameloop={running ? "always" : "never"}
        dpr={dpr}
        camera={camera}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        onCreated={({ gl }) => { gl.localClippingEnabled = true; }}
        style={{ background: "transparent" }}
      >
        <LookAt target={target} />
        {lights && <SceneLights />}
        {children}
      </Canvas>
    </div>
  );
}

export default Scene3D;
