# VectorCore

一个使用 Three.js 与 MediaPipe Hands 制作的手势交互行星实验。项目始于 2026 年 2 月，作为个人作品归档保留现有视觉、参数面板与行星挑战玩法。

## 当前状态

- Web 版本可作为源码归档运行。
- Electron 打包配置已准备好，但 Windows EXE **尚未完成可重复构建验收**；当前 `node_modules` 不完整，不应继续在此目录逐包修复或发布构建产物。
- 仓库尚未选择公开许可证，也尚未完成素材授权核验，因此目前不应公开发布。

## 本地运行（Web）

需要 Python。于项目根目录执行：

```powershell
python -m http.server 8080
```

然后打开 `http://localhost:8080`。也可以双击 `run_server.bat`。

## 操作与权限

- 允许摄像头后，应用使用 MediaPipe Hands 识别单手手势以控制场景。
- 摄像头被拒绝、被占用或不可用时，状态会显示 `CAMERA ERROR`，应用仍会进入主界面，可继续使用非手势界面。
- 设置面板可调整颜色、音量、光环和显示效果；行星挑战在应用内触发。

## 已知限制

- Three.js 与 MediaPipe 从 CDN 加载，运行时需要网络连接。
- “AI 配色”功能未配置 API Key，公开归档中不可用；仓库不包含 API Key。
- Electron/EXE 构建在依赖树恢复完整并通过本地启动验收前，不作为发布版本。

## 发布前必须完成

1. 依据 [THIRD_PARTY.md](THIRD_PARTY.md) 核验或替换音频与天空盒素材。
2. 选择并加入公开许可证。
3. 在干净、完整的依赖目录中执行 `npm run check`、`npm start`、`npm run dist:win`，并实际启动生成的 EXE。
4. 核对生成物不含 API Key、调试文件或未获授权素材。

## 项目文件

- `index.html`、`script.js`、`style.css`：Web 应用。
- `main.js`、`package.json`：最小 Electron Windows 打包入口与配置。
- `THIRD_PARTY.md`：第三方代码与素材审计。
- `RELEASE_NOTES.md`：待验收后使用的 Release 文案草稿。

