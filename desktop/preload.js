const { contextBridge, ipcRenderer } = require("electron");

// 暴露给渲染进程的安全 API
contextBridge.exposeInMainWorld("electronAPI", {
  // ── Web App (Next.js) 调用 ─────────────────────────────────────────────
  // 加载宠物（传入 /api/proxy/glb?url=... 相对路径）
  loadPet: (glbUrl) => ipcRenderer.invoke("load-pet", glbUrl),

  // 检查是否在 Electron 环境中
  isElectron: true,

  // ── 宠物窗口调用 ────────────────────────────────────────────────────────
  // 鼠标悬停在角色上 → 关闭穿透；离开 → 开启穿透
  setIgnoreMouse: (ignore) => ipcRenderer.send("set-ignore-mouse", ignore),

  // 拖动宠物窗口
  movePetWindow: (dx, dy) => ipcRenderer.send("move-pet-window", { dx, dy }),

  // 显示右键菜单
  showPetMenu: () => ipcRenderer.send("show-pet-menu"),

  // 监听主进程发来的 GLB 路径（宠物窗口使用）
  onLoadGlb: (callback) =>
    ipcRenderer.on("load-glb", (_, url) => callback(url)),

  // 监听主进程发来的动画切换指令
  onPlayAnimation: (callback) =>
    ipcRenderer.on("play-animation", (_, preset) => callback(preset)),
});
