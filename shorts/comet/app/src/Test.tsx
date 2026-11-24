import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, getInputProps, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { World } from "./videos/comet/world";
const In: React.FC = () => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const mode = (getInputProps() as { mode?: string }).mode ?? "box";
  const world = useMemo(() => (mode !== "box" ? new World() : null), [mode]);
  if (world && mode === "update") world.update(1, 20, camera as THREE.PerspectiveCamera, scene);
  return (<>
    <ambientLight intensity={1} />
    <mesh position={(camera as THREE.PerspectiveCamera).position.clone().add(new THREE.Vector3(0, 0, -6).applyQuaternion(camera.quaternion))} rotation={[0.4, f * 0.05, 0]}><boxGeometry args={[2, 2, 2]} /><meshBasicMaterial color="red" /></mesh>
    {world ? <primitive object={world.root} /> : null}
  </>);
};
export const TestBox: React.FC = () => (
  <AbsoluteFill style={{ background: "#88aaff" }}>
    <ThreeCanvas width={1080} height={1920} camera={{ fov: 40, position: [0, 0, 6] }}><In /></ThreeCanvas>
  </AbsoluteFill>
);
