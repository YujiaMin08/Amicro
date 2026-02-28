# Amico

English | 中文

---

## English

Amico is an AI desktop companion platform.  
You can start from a portrait (or random character), run the full web pipeline (2D style transfer -> 3D generation -> rigging -> animation), and then load the character into a transparent desktop pet window.

### Features

- **Web Creator (Next.js)**  
  Upload or generate a character, preview results, and manage your local gallery.
- **3D Pipeline**  
  2D style image generation with Nano Banana, then 3D/rig/animation generation with Tripo3D.
- **Desktop App (Electron)**  
  Floating pet window with drag interaction, animation switching, side chat/menu windows, and quick controls.
- **Local Persistence**  
  Character gallery, chat memory, and downloaded model files are persisted locally for reuse.

### Requirements

- Node.js 18+
- npm (or pnpm/yarn if you prefer)

### Quick Start

1) Install dependencies

```bash
# Web app
npm install

# Desktop app
cd desktop && npm install && cd ..
```

2) Configure environment variables

```bash
cp .env.example .env.local
```

Fill `.env.local`:

| Variable | Description |
|---|---|
| `NANOBANANA_API_KEY` | API key for image style / multimodal features |
| `NANOBANANA_BASE_URL` | API base URL (default: `https://api.jxincm.cn`) |
| `TRIPO_API_KEY` | API key for 3D model, rigging, and animation |

3) Run

- **Web only**

```bash
npm run dev
```

Open `http://localhost:3000`.

- **Web + Desktop**

Start web first:

```bash
npm run dev
```

Then start Electron in another terminal:

```bash
cd desktop && npm start
```

Electron will probe ports `3000/3001/3002` and connect to the running web app automatically.

### Project Structure

```text
amico/
├── src/                 # Next.js app (App Router)
│   ├── app/
│   └── components/
├── desktop/             # Electron app
│   ├── main.js          # Main process (windows, IPC, local state)
│   ├── preload.js
│   ├── pet-window/      # 3D pet renderer window
│   └── loading.html
├── public/
├── .env.example
└── README.md
```

### Notes

- Never commit `.env.local` or real API keys.
- Desktop model files are stored under `~/.amico` for recovery and reuse.

### License

Private / No open-source license specified.

---

## 中文

Amico 是一个 AI 桌面伙伴平台。  
你可以从人像照片（或随机角色）出发，在网页端完成 2D 风格化 -> 3D 生成 -> 绑定骨骼 -> 动画生成，并把角色加载到透明桌面宠物窗口常驻陪伴。

### 功能

- **网页创作端（Next.js）**  
  上传或随机生成角色，预览流程结果，并在本地角色库中管理角色。
- **3D 生成流程**  
  使用 Nano Banana 进行 2D 风格化，再通过 Tripo3D 完成 3D、绑定与动画生成。
- **桌面端（Electron）**  
  提供透明悬浮宠物窗口，支持拖拽、动画切换，以及侧边聊天/菜单窗口。
- **本地持久化**  
  角色库、聊天记忆、模型文件均可本地保存，便于下次继续使用。

### 环境要求

- Node.js 18+
- npm（或 pnpm/yarn）

### 快速开始

1）安装依赖

```bash
# Web 端
npm install

# 桌面端
cd desktop && npm install && cd ..
```

2）配置环境变量

```bash
cp .env.example .env.local
```

在 `.env.local` 中填写：

| 变量 | 说明 |
|---|---|
| `NANOBANANA_API_KEY` | 图像风格化 / 多模态相关 API Key |
| `NANOBANANA_BASE_URL` | API 地址（默认 `https://api.jxincm.cn`） |
| `TRIPO_API_KEY` | 3D 模型、骨骼与动画生成 API Key |

3）运行项目

- **仅运行 Web**

```bash
npm run dev
```

浏览器访问 `http://localhost:3000`。

- **运行 Web + 桌面端**

先启动 Web：

```bash
npm run dev
```

再在另一个终端启动 Electron：

```bash
cd desktop && npm start
```

桌面端会自动探测 `3000/3001/3002` 端口并连接到可用的本地 Web 服务。

### 项目结构

```text
amico/
├── src/                 # Next.js 应用（App Router）
│   ├── app/
│   └── components/
├── desktop/             # Electron 桌面应用
│   ├── main.js          # 主进程（窗口、IPC、本地状态）
│   ├── preload.js
│   ├── pet-window/      # 3D 宠物渲染窗口
│   └── loading.html
├── public/
├── .env.example
└── README.md
```

### 注意事项

- 请勿提交 `.env.local` 或任何真实 API Key。
- 桌面端模型文件会保存在 `~/.amico`，用于恢复与复用。

### 许可

私有项目 / 暂未声明开源协议。
