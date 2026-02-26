# Amico

AI 桌面伙伴：用一张照片或随机形象，在网页里完成 2D 转 3D、绑定骨骼与动画，并可在桌面端以透明小窗形式常驻陪伴。

## 功能概览

- **创作者流程（Web）**  
  上传照片或使用随机形象 → 2D 黏土风格图（Nano Banana）→ 3D 模型 + 骨骼 + 动画（Tripo3D）→ 预览并保存到本地角色库。
- **桌面端（Electron）**  
  主窗口加载本地 Next.js 创作者页面；独立宠物窗口展示 3D 角色，支持拖拽、切换动画、右键菜单（打开创作者、隐藏、退出等）。
- **角色库**  
  在创作者中可查看与管理已保存角色，并选择加载到桌面宠物窗口。

## 环境要求

- Node.js（建议 18+）
- npm / pnpm / yarn

## 快速开始

### 1. 安装依赖

```bash
# 根目录（Next.js 网页）
npm install

# 桌面端
cd desktop && npm install && cd ..
```

### 2. 配置环境变量

复制环境变量示例并填写 API Key（不要提交 `.env.local`）：

```bash
cp .env.example .env.local
```

在 `.env.local` 中配置：

| 变量 | 说明 |
|------|------|
| `NANOBANANA_API_KEY` | 聚鑫 API，用于 2D 黏土风格图（Nano Banana） |
| `NANOBANANA_BASE_URL` | 聚鑫 API 地址，默认 `https://api.jxincm.cn` |
| `TRIPO_API_KEY` | Tripo3D API，用于 3D 模型、骨骼与动画 |

### 3. 运行方式

**仅 Web（创作者）：**

```bash
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

**桌面端（创作者 + 宠物窗口）：**

先在一个终端启动 Web：

```bash
npm run dev
```

再在另一个终端启动 Electron：

```bash
cd desktop && npm start
```

桌面端会自动检测 3000/3001/3002 端口并加载本地 Next.js 页面；若未启动 Web，会显示加载提示页。

## 项目结构

```
amico/
├── src/                 # Next.js 应用（App Router）
│   ├── app/
│   └── components/      # 落地页、创建流程、画廊等
├── desktop/             # Electron 桌面应用
│   ├── main.js          # 主进程：主窗口、宠物窗口、托盘、IPC
│   ├── preload.js
│   ├── pet-window/      # 3D 宠物窗口
│   └── loading.html     # Next 未启动时的提示页
├── .env.example         # 环境变量示例
└── README.md
```

## 注意事项

- 请勿将 `.env.local` 或任何真实 API Key 提交到仓库；`.gitignore` 已忽略 `.env*`。
- 桌面宠物使用的 GLB 会下载到 `~/.amico/current_pet.glb`，用于下次启动时恢复。

## License

Private / 未指定开源协议。
