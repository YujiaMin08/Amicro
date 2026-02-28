// ── Three.js 桌宠渲染器 ────────────────────────────────────────────────────
// 透明窗口 + GLB 加载 + 动画播放 + 鼠标穿透检测 + 拖动

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";

// ── DOM ───────────────────────────────────────────────────────────────────────
const canvas = document.getElementById("pet-canvas");
const loading = document.getElementById("loading");
const emptyState = document.getElementById("empty-state");

// ── Scene setup ───────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,           // 透明背景
  antialias: true,
  premultipliedAlpha: false,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0); // 完全透明
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  35,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1.2, 5);

// 简单光照
scene.add(new THREE.AmbientLight(0xffffff, 1.4));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
dirLight.position.set(3, 5, 3);
scene.add(dirLight);
const fillLight = new THREE.DirectionalLight(0xc8e0ff, 0.6);
fillLight.position.set(-3, 2, -2);
scene.add(fillLight);

// ── 状态 ─────────────────────────────────────────────────────────────────────
let mixer = null;
let currentModel = null;
let currentAnimations = [];
let currentAction = null;
let clock = new THREE.Clock();
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let floatOffset = 0; // 角色上下浮动偏移

// ── GLB 加载 ──────────────────────────────────────────────────────────────────
const loader = new GLTFLoader();

function loadGlb(url) {
  console.log("[renderer] 加载 GLB:", url);
  loading.classList.remove("hidden");
  emptyState.classList.add("hidden");

  // 清除旧模型
  if (currentModel) {
    scene.remove(currentModel);
    currentModel = null;
    currentAnimations = [];
    currentAction = null;
    if (mixer) { mixer.stopAllAction(); mixer = null; }
  }

  loader.load(
    url,
    (gltf) => {
      console.log("[renderer] GLB 加载成功, 动画数:", gltf.animations.length);

      const model = gltf.scene;

      // 自动居中 + 缩放
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2.2 / maxDim;
      model.scale.setScalar(scale);

      // 居中并贴近底部
      model.position.sub(center.multiplyScalar(scale));
      model.position.y -= (size.y * scale) / 2 - 0.1;

      scene.add(model);
      currentModel = model;

      // 设置动画混合器
      currentAnimations = gltf.animations ?? [];
      if (currentAnimations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        // 自动播放第一个动画（idle）
        const idleClip =
          currentAnimations.find((a) => /idle/i.test(a.name)) ??
          currentAnimations[0];
        currentAction = mixer.clipAction(idleClip);
        currentAction.play();
        console.log("[renderer] 播放动画:", idleClip.name);
      }

      loading.classList.add("hidden");
    },
    (progress) => {
      if (progress.total > 0) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        console.log(`[renderer] 加载进度: ${pct}%`);
      }
    },
    (error) => {
      console.error("[renderer] 加载失败:", error);
      loading.classList.add("hidden");
      emptyState.classList.remove("hidden");
    }
  );
}

// ── 切换动画（主进程菜单触发）────────────────────────────────────────────────
function playAnimationByName(name) {
  if (!mixer || !currentModel || currentAnimations.length === 0) return;

  // 兼容 "wave_goodbye" / "biped:agree" / "Idle" 等不同命名格式
  const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const presetToken = normalize((name.includes(":") ? name.split(":").pop() : name) ?? name);
  const clip = currentAnimations.find((c) => normalize(c.name).includes(presetToken));

  if (clip) {
    const nextAction = mixer.clipAction(clip);
    if (currentAction !== nextAction) {
      nextAction.reset().fadeIn(0.25).play();
      currentAction?.fadeOut(0.25);
      currentAction = nextAction;
    }
    console.log("[renderer] 切换动画:", clip.name);
  } else {
    console.warn("[renderer] 未找到动画:", name);
  }
}

// ── 鼠标穿透检测 ──────────────────────────────────────────────────────────────
// 读取鼠标位置的像素 alpha 值：透明区域 → 穿透；不透明 → 阻止穿透
function checkPixelAlpha(x, y) {
  try {
    const gl = renderer.getContext();
    const pixel = new Uint8Array(4);
    // WebGL 坐标 Y 轴翻转
    gl.readPixels(
      x * window.devicePixelRatio,
      renderer.domElement.height - y * window.devicePixelRatio,
      1, 1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixel
    );
    return pixel[3]; // alpha 值 0-255
  } catch {
    return 255;
  }
}

// ── 鼠标事件 ──────────────────────────────────────────────────────────────────
window.addEventListener("mousemove", (e) => {
  if (isDragging) {
    const dx = e.screenX - lastMouseX;
    const dy = e.screenY - lastMouseY;
    lastMouseX = e.screenX;
    lastMouseY = e.screenY;
    window.electronAPI?.movePetWindow(dx, dy);
    return;
  }

  // 检查像素 alpha，决定是否穿透
  const alpha = checkPixelAlpha(e.clientX, e.clientY);
  const isOverCharacter = alpha > 20;
  window.electronAPI?.setIgnoreMouse(!isOverCharacter);
});

window.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    const alpha = checkPixelAlpha(e.clientX, e.clientY);
    if (alpha > 20) {
      isDragging = true;
      lastMouseX = e.screenX;
      lastMouseY = e.screenY;
      window.electronAPI?.setIgnoreMouse(false);
    }
  }
  if (e.button === 2) {
    window.electronAPI?.showPetMenu();
  }
});

window.addEventListener("mouseup", () => {
  isDragging = false;
});

window.addEventListener("mouseleave", () => {
  isDragging = false;
  window.electronAPI?.setIgnoreMouse(true);
});

// ── Electron IPC 监听 ──────────────────────────────────────────────────────────
window.electronAPI?.onLoadGlb((url) => loadGlb(url));
window.electronAPI?.onPlayAnimation((preset) => playAnimationByName(preset));

// ── 动画循环 ──────────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // 动画混合器更新
  if (mixer) mixer.update(delta);

  // 轻微浮动动画（叠加在模型动画之上）
  if (currentModel) {
    floatOffset = Math.sin(elapsed * 1.2) * 0.04;
    currentModel.position.y += floatOffset - (Math.sin((elapsed - delta) * 1.2) * 0.04);
  }

  renderer.render(scene, camera);
}

// ── 响应窗口大小变化 ───────────────────────────────────────────────────────────
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 启动渲染
animate();
console.log("[renderer] 宠物渲染器已启动");
