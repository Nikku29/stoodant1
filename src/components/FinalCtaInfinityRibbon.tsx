import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

class LemniscateCurve extends THREE.Curve<THREE.Vector3> {
  constructor() {
    super();
  }

  override getPoint(t: number, target = new THREE.Vector3()) {
    const angle = t * Math.PI * 2;
    const sine = Math.sin(angle);
    const cosine = Math.cos(angle);
    return target.set(3.05 * sine, 1.65 * sine * cosine, 0);
  }
}

function InfinityRibbon({ success }: { success: boolean }) {
  const tilt = useRef<THREE.Group>(null);
  const spinner = useRef<THREE.Group>(null);
  const successSpinRemaining = useRef(0);
  const curve = useMemo(() => new LemniscateCurve(), []);

  useEffect(() => {
    if (success) successSpinRemaining.current = Math.PI * 2;
  }, [success]);

  const finePointer = useMemo(() => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1024px)").matches, []);

  useFrame(({ pointer }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const tiltGroup = tilt.current;
    const spinGroup = spinner.current;
    if (!tiltGroup || !spinGroup) return;

    const damping = 1 - Math.exp(-4 * delta);
    tiltGroup.rotation.x = THREE.MathUtils.lerp(tiltGroup.rotation.x, finePointer ? -pointer.y * 0.12 : 0, damping);
    tiltGroup.rotation.y = THREE.MathUtils.lerp(tiltGroup.rotation.y, finePointer ? pointer.x * 0.15 : 0, damping);

    const successStep = Math.min(successSpinRemaining.current, (Math.PI * 2 / 1.15) * delta);
    successSpinRemaining.current -= successStep;
    spinGroup.rotation.y += 0.16 * delta + successStep;
  });

  return (
    <group ref={tilt}>
      <group ref={spinner} rotation={[0.08, -0.2, -0.04]}>
        <mesh>
          <tubeGeometry args={[curve, 180, 0.18, 12, true]} />
          <meshStandardMaterial color="#F5F5F5" roughness={0.35} metalness={0.6} envMapIntensity={1.1} />
        </mesh>
      </group>
    </group>
  );
}

export default function FinalCtaInfinityRibbon({ success }: { success: boolean }) {
  return (
    <div className="cta-loop-3d" role="img" aria-label="Rotating three-dimensional infinity ribbon">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 8.2], fov: 38 }} gl={{ alpha: true, antialias: true }} onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}>
        <ambientLight intensity={0.9} color="#FFFFFF" />
        <directionalLight position={[-3, 4, 6]} intensity={1.6} color="#FFFFFF" />
        <directionalLight position={[0, 2, -6]} intensity={1.2} color="#D4D4D4" />
        <Environment resolution={64} frames={1}>
          <Lightformer intensity={2} color="#FFFFFF" position={[0, 4, 4]} scale={[8, 4, 1]} />
          <Lightformer intensity={1} color="#D4D4D4" position={[0, -2, -5]} scale={[10, 2, 1]} />
        </Environment>
        <InfinityRibbon success={success} />
      </Canvas>
    </div>
  );
}