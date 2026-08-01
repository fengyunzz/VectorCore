# 第三方代码与素材审计

本文件记录当前项目内可识别的外部依赖与发布风险。它不是授权证明；标为“待核验”的素材不得在未确认来源和许可前随公开仓库或 Release 分发。

## 运行时依赖

| 项目 | 当前引用方式 | 说明 |
| --- | --- | --- |
| Three.js r128 | cdnjs、jsDelivr | 场景渲染与后处理。来源链接在 `index.html`。 |
| MediaPipe Hands、Camera Utils | jsDelivr | 摄像头与手势识别。来源链接在 `index.html`。 |
| Electron 43.2.0 | npm 开发依赖 | 仅用于 Windows 桌面壳与打包。 |
| electron-builder 26.15.3 | npm 开发依赖 | 仅用于构建 portable EXE。 |

## 署名已保留的界面片段

| 来源 | 文件 | 当前署名 |
| --- | --- | --- |
| Uiverse.io / andrew-manzyk | `index.html`、`style.css` | Loader 注释。 |
| Uiverse.io / vinodjangid07 | `style.css` | 控件注释。 |

公开发布前应找到具体组件页面，核对许可与署名要求，并把链接补入本表。

## 待核验素材（阻断公开分发）

| 文件或目录 | 用途 | 状态 |
| --- | --- | --- |
| `audio/us_menu_bgm_ethereal_loop_01.mp3` | 背景音乐 | 来源与公开分发许可未知。 |
| `audio/sfx_ui_*` | 界面音效 | 来源与公开分发许可未知。 |
| `assets/textures/skybox/*.png` | 场景天空盒 | 来源与公开分发许可未知。 |

处理方式只能二选一：补上可公开的来源与许可记录，或在发布前替换/移除这些文件及对应引用。

