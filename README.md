# VectorCore

一个使用 Three.js 与 MediaPipe Hands 制作的手势交互行星实验。项目始于 2026 年 2 月，作为个人作品归档保留现有视觉、参数面板与行星挑战玩法。

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

## 项目文件

- `index.html`、`script.js`、`style.css`：Web 应用。
- `main.js`、`package.json`：最小 Electron Windows 打包入口与配置。
- `THIRD_PARTY.md`：第三方代码与素材审计。
- `RELEASE_NOTES.md`：待验收后使用的 Release 文案草稿。

