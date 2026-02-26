"use client";

import { useRef, Suspense, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  ContactShadows,
  Float,
  useGLTF,
  useAnimations,
} from "@react-three/drei";
import * as THREE from "three";

// ─── 占位角色 ────────────────────────────────────────────────────────────────
function PlaceholderCharacter() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y =
        -0.5 + Math.sin(state.clock.elapsedTime * 1.5) * 0.05;
    }
  });
  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
      <group ref={groupRef} position={[0, -0.5, 0]}>
        <mesh position={[0, 0.6, 0]}>
          <capsuleGeometry args={[0.55, 0.4, 16, 32]} />
          <meshStandardMaterial color="#ffe8d6" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.55, 32, 32]} />
          <meshStandardMaterial color="#ffe8d6" roughness={0.6} />
        </mesh>
        <mesh position={[-0.18, 1.58, 0.44]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#3d3329" />
        </mesh>
        <mesh position={[0.18, 1.58, 0.44]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#3d3329" />
        </mesh>
        <mesh position={[0, 1.38, 0.48]} rotation={[0.3, 0, 0]}>
          <torusGeometry args={[0.08, 0.015, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#e0846b" />
        </mesh>
        <mesh position={[-0.4, 1.9, 0]} rotation={[0, 0, -0.3]}>
          <capsuleGeometry args={[0.1, 0.2, 8, 16]} />
          <meshStandardMaterial color="#ffd4b0" />
        </mesh>
        <mesh position={[0.4, 1.9, 0]} rotation={[0, 0, 0.3]}>
          <capsuleGeometry args={[0.1, 0.2, 8, 16]} />
          <meshStandardMaterial color="#ffd4b0" />
        </mesh>
        <mesh position={[-0.55, 0.5, 0]} rotation={[0, 0, 0.5]}>
          <capsuleGeometry args={[0.1, 0.3, 8, 16]} />
          <meshStandardMaterial color="#ffe8d6" />
        </mesh>
        <mesh position={[0.55, 0.5, 0]} rotation={[0, 0, -0.5]}>
          <capsuleGeometry args={[0.1, 0.3, 8, 16]} />
          <meshStandardMaterial color="#ffe8d6" />
        </mesh>
      </group>
    </Float>
  );
}

// ─── 真实 GLB 模型（含动画播放 + 可选骨骼显示）──────────────────────────────
function RealModel({ url, showSkeleton }: { url: string; showSkeleton?: boolean }) {
  const { scene, animations } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const { actions, names } = useAnimations(animations, groupRef);

  // 自动居中 + 缩放
  useEffect(() => {
    if (!groupRef.current) return;
    const box = new THREE.Box3().setFromObject(groupRef.current);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 2.5 / maxDim;
      groupRef.current.scale.setScalar(scale);
      const center = new THREE.Vector3();
      box.setFromObject(groupRef.current).getCenter(center);
      groupRef.current.position.sub(center);
    }
    console.log("[ModelViewer] 动画:", names);
  }, [scene, animations, names]);

  // 自动播放第一个动画
  useEffect(() => {
    if (names.length === 0) return;
    const idleName = names.find((n) => /idle/i.test(n)) ?? names[0];
    const action = actions[idleName];
    if (action) action.reset().fadeIn(0.3).play();
    return () => { action?.fadeOut(0.3); };
  }, [actions, names]);

  // SkeletonHelper 骨骼线框（仅骨骼确认步骤开启）
  const skeletonHelper = useMemo(() => {
    if (!showSkeleton) return null;
    const helper = new THREE.SkeletonHelper(scene);
    return helper;
  }, [showSkeleton, scene]);

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
      {skeletonHelper && <primitive object={skeletonHelper} />}
    </group>
  );
}

// ─── 主组件 ─────────────────────────────────────────────────────────────────
interface ModelViewerProps {
  className?: string;
  modelUrl?: string | null;
  showSkeleton?: boolean;
}

export default function ModelViewer({ className = "", modelUrl, showSkeleton }: ModelViewerProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        camera={{ position: [0, 1.5, 4.5], fov: 38 }}
        style={{ background: "transparent" }}
        gl={{
          powerPreference: "default",
          antialias: false,        // 关闭抗锯齿节省 GPU
          depth: true,
          stencil: false,
          alpha: true,
        }}
      >
        {/* 简单光照 — 不使用 Environment HDR，避免 GPU 超载 */}
        <ambientLight intensity={1.2} />
        <directionalLight position={[4, 6, 4]} intensity={1.5} />
        <directionalLight position={[-4, 2, -2]} intensity={0.6} color="#c8e0ff" />
        <pointLight position={[0, 4, 0]} intensity={0.8} color="#fff5e0" />

        <Suspense fallback={null}>
          {modelUrl ? (
            <RealModel key={modelUrl} url={modelUrl} showSkeleton={showSkeleton} />
          ) : (
            <PlaceholderCharacter />
          )}
        </Suspense>

        <ContactShadows
          position={[0, -1.4, 0]}
          opacity={0.35}
          scale={5}
          blur={2}
          far={3}
        />

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={2.5}
          maxDistance={8}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2}
          autoRotate
          autoRotateSpeed={1.2}
        />
      </Canvas>
    </div>
  );
}
