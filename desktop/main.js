const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  Tray,
  Menu,
  nativeImage,
  dialog,
  shell,
} = require("electron");
const path = require("path");
const https = require("https");
const http = require("http");
const fs = require("fs");
const os = require("os");

// ── 常量 ─────────────────────────────────────────────────────────────────────
// 自动检测 Next.js 端口（3000 优先，3001 备用）
const WEB_APP_PORTS = [3000, 3001, 3002];
let WEB_APP_URL = "http://localhost:3000";
const PET_WIDTH = 320;
const PET_HEIGHT = 520;
const AMICO_DIR = path.join(os.homedir(), ".amico");

// 确保数据目录存在
if (!fs.existsSync(AMICO_DIR)) fs.mkdirSync(AMICO_DIR, { recursive: true });

// ── 全局窗口引用 ──────────────────────────────────────────────────────────────
let mainWindow = null;
let petWindow = null;
let tray = null;
let currentGlbPath = null;

// ── 检测 Next.js 实际端口 ────────────────────────────────────────────────────
function detectNextJsPort() {
  return new Promise((resolve) => {
    let checked = 0;
    for (const port of WEB_APP_PORTS) {
      http.get(`http://localhost:${port}`, (res) => {
        if (res.statusCode < 500) {
          resolve(port);
        }
      }).on("error", () => {
        checked++;
        if (checked === WEB_APP_PORTS.length) resolve(3000); // 默认 3000
      });
    }
  });
}

// ── 主窗口（Next.js Web App）────────────────────────────────────────────────
async function createMainWindow() {
  // 检测可用端口
  const port = await detectNextJsPort();
  WEB_APP_URL = `http://localhost:${port}`;
  console.log("[main] 使用 Web App URL:", WEB_APP_URL);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    title: "Amico Creator",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#fdf6ee",
  });

  mainWindow.loadURL(WEB_APP_URL).catch(() => {
    // Next.js 未启动时显示提示页
    mainWindow.loadFile(path.join(__dirname, "loading.html"));
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ── 宠物窗口（透明 + 始终置顶）────────────────────────────────────────────────
function createPetWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  petWindow = new BrowserWindow({
    width: PET_WIDTH,
    height: PET_HEIGHT,
    x: width - PET_WIDTH - 24,
    y: height - PET_HEIGHT - 24,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    // macOS: 'panel' 类型让窗口浮在所有 Space 和全屏应用上
    type: process.platform === "darwin" ? "panel" : "normal",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // 允许加载本地文件
      webSecurity: false,
    },
  });

  // 默认启用鼠标穿透（鼠标在透明区域时点击穿透到桌面）
  petWindow.setIgnoreMouseEvents(true, { forward: true });

  petWindow.loadFile(path.join(__dirname, "pet-window", "index.html"));

  petWindow.on("closed", () => { petWindow = null; });
}

// ── 系统托盘 ─────────────────────────────────────────────────────────────────
function createTray() {
  // 使用空白图标（生产版本应替换为真实图标）
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Amico Creator",
      click: () => {
        if (mainWindow) mainWindow.focus();
        else createMainWindow();
      },
    },
    {
      label: petWindow?.isVisible() ? "Hide Pet" : "Show Pet",
      click: () => {
        if (!petWindow) return;
        if (petWindow.isVisible()) petWindow.hide();
        else petWindow.show();
      },
    },
    { type: "separator" },
    {
      label: "Quit Amico",
      click: () => app.quit(),
    },
  ]);

  tray.setToolTip("Amico Desktop Companion");
  tray.setContextMenu(contextMenu);
}

// ── 下载 GLB 到本地 ──────────────────────────────────────────────────────────
function downloadGlb(url) {
  return new Promise((resolve, reject) => {
    const destPath = path.join(AMICO_DIR, "current_pet.glb");
    const file = fs.createWriteStream(destPath);

    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        console.log("[main] GLB saved to:", destPath);
        resolve(destPath);
      });
    }).on("error", (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// ── IPC 处理 ──────────────────────────────────────────────────────────────────

// Web App → 主进程：加载宠物（传入相对 URL 或绝对 URL）
ipcMain.handle("load-pet", async (event, relativeUrl) => {
  console.log("[main] load-pet:", relativeUrl);

  // 构建完整 URL
  const fullUrl = relativeUrl.startsWith("http")
    ? relativeUrl
    : `${WEB_APP_URL}${relativeUrl}`;

  try {
    // 下载 GLB 到本地
    const localPath = await downloadGlb(fullUrl);
    currentGlbPath = localPath;

    // 确保宠物窗口存在
    if (!petWindow || petWindow.isDestroyed()) createPetWindow();

    // 等待窗口加载完成后再发送 GLB 路径
    if (petWindow.webContents.isLoading()) {
      petWindow.webContents.once("did-finish-load", () => {
        petWindow.webContents.send("load-glb", `file://${localPath}`);
        petWindow.show();
      });
    } else {
      petWindow.webContents.send("load-glb", `file://${localPath}`);
      petWindow.show();
    }

    return { success: true };
  } catch (err) {
    console.error("[main] load-pet error:", err);
    return { success: false, error: err.message };
  }
});

// 宠物窗口 → 主进程：切换鼠标穿透（鼠标悬停在角色上时关闭穿透）
ipcMain.on("set-ignore-mouse", (event, ignore) => {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

// 宠物窗口 → 主进程：拖动窗口
ipcMain.on("move-pet-window", (event, { dx, dy }) => {
  if (!petWindow || petWindow.isDestroyed()) return;
  const [x, y] = petWindow.getPosition();
  petWindow.setPosition(x + dx, y + dy);
});

// 宠物窗口 → 主进程：右键菜单
ipcMain.on("show-pet-menu", (event) => {
  const menu = Menu.buildFromTemplate([
    { label: "Change Animation", submenu: [
        { label: "Idle",   click: () => petWindow?.webContents.send("play-animation", "idle") },
        { label: "Wave",   click: () => petWindow?.webContents.send("play-animation", "wave_goodbye") },
        { label: "Dance",  click: () => petWindow?.webContents.send("play-animation", "dance_01") },
        { label: "Cheer",  click: () => petWindow?.webContents.send("play-animation", "cheer") },
        { label: "Clap",   click: () => petWindow?.webContents.send("play-animation", "clap") },
    ]},
    { type: "separator" },
    { label: "Open Creator", click: () => {
        if (mainWindow) mainWindow.focus();
        else createMainWindow();
    }},
    { label: "Hide Pet", click: () => petWindow?.hide() },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
  menu.popup({ window: petWindow });
});

// ── 应用生命周期 ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createMainWindow();
  createPetWindow();
  // createTray(); // 托盘图标（需要图标文件，暂时注释）

  // 尝试恢复上次的宠物
  const savedGlb = path.join(AMICO_DIR, "current_pet.glb");
  if (fs.existsSync(savedGlb)) {
    petWindow.webContents.once("did-finish-load", () => {
      petWindow.webContents.send("load-glb", `file://${savedGlb}`);
    });
  }

  app.on("activate", () => {
    if (!mainWindow) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  // macOS: 保持应用运行（通过托盘访问）
  if (process.platform !== "darwin") app.quit();
});

// 阻止创建额外窗口
app.on("web-contents-created", (event, contents) => {
  contents.on("new-window", (event) => event.preventDefault());
});
