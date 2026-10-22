# TRAE 1024 项目规则（project rules）

> 本文件是本仓库的**约束与索引层**，任何 AI 协作者或人类开发者在改动代码前必须先读完。
> 产品契约见 `raw/TRAE1024-程序员日互动落地页-PRD.html`（PRD v0.1）；项目介绍与技术细节见 `README.md`。
> 当 PRD、README 与代码冲突时，以**代码现状**为准，并按第 11 节同步文档、登记偏离。

最后核对版本：2026-10-23（对应提交 `adcf50b`）。

---

## 1. 技术栈硬约束

- **纯静态、零运行时依赖、零构建**：只有 `index.html` / `styles.css` / `app.js` 三个运行时文件。
- 禁止新增 `package.json`、构建工具、前端框架、Three.js / WebGL、外部 CDN、字体下载或任何第三方 JS/CSS。
- 允许的能力边界：原生 DOM、CSS 3D Transform、SVG Filter、Canvas 2D、Web Audio、Web Animations API。
- JS 风格与现有代码保持一致：单 IIFE、`'use strict'`、`var`、ES5 语法（不引入 TS/打包器）。
- 所有引用路径必须是**仓库内相对路径**，保证 `file://` 直接打开与 GitHub Pages 子路径两种方式都可用。

## 2. 文件职责边界

| 文件 | 唯一职责 | 不允许 |
| :-- | :-- | :-- |
| `index.html` | 静态骨架、内联 5 个 SVG `<filter>`、UI 控件层、加载/降级态 | 写业务脚本（只保留一个 `<script src="app.js">`） |
| `styles.css` | 全部视觉：3D 建模、三态、机位、五风格皮肤、响应式 | 承载行为逻辑 |
| `app.js` | 全部行为：状态机、键盘 DSL、Fx 粒子、Snd 音频、输入、WAAPI | 拼大段 HTML 字符串当视图 |

新能力优先归入既有模块（`state` / `Fx` / `Snd`），除非确有必要不新增文件。

## 3. 状态机与定时器

- 唯五状态：`LOADING → OPENING → TYPING → ASSEMBLING → HERO`。
- `<body>` 上的 `style-*` + `phase-*` class 是**唯一视觉通道**；禁止用 JS 直接改元素 `style.display/opacity` 来切阶段（拖拽视角等连续交互除外）。
- 演出计时只能用统一的 `later(fn, ms)` / `clearTimer()`（共享 `state.timer`），禁止用裸 `setTimeout` 串联阶段；短动画回调可用 `setTimeout`，但必须与阶段定时器无耦合。
- `strike(i)` 必须同时守卫 `phase === 'TYPING'` 与下标越界。
- HERO 字槽在 `enterHero()` 中**确定性填充**，不得依赖飞行体的 WAAPI `onfinish`（后台标签页可能不触发）。
- `visibilitychange` 恢复分支必须覆盖：OPENING 续演、TYPING 中段续敲、TYPING 末键定格段（`pointer >= SEQUENCE.length`）直接汇聚。
- 时序常量集中在 `app.js` 顶部（`T_OPENING` / `KEY_GAP` / `KEY_JITTER` / `GROUP_GAP` / `HOLD_AFTER_TYPED` / `T_ASSEMBLE`），调节奏只改常量，禁止把魔法数字散落进逻辑。

## 4. 键盘建模规则

- 键位只能通过 `app.js` 中的 `ROWS` 布局 DSL 增删，**禁止在 HTML 手写键帽**。
- 键三元组为 `[字符, 宽度U数(默认1), 角色class]`，功能区间隙用 `G`；新增宽度会自动派生 class（`2.25 → w225`、`6.25 → w625`），若引入新跨度需同步在 `styles.css` 增加对应 `.w*` 规则。
- 角色皮肤通过第三元挂 class（现状：`enter` 品牌绿、`novel` 个性紫、`space`），皮肤只写 CSS。
- 序列键由构建器自动写 `data-key` 并登记到 `keyEls`；敲击序列只允许改 `SEQUENCE` 常量一处。
- 键帽状态 class 语义冻结，不得复用或改义：
  - `next` 当前待击（呼吸引导）、`pressed` 瞬时下沉、`lit` 已击常亮（`2` 键追加 `purple`）、`tickled` 未来键微弱下沉、`lifting` 汇聚时抬离。
- 改配列或外观后，必须对照 `raw/TRAE-Keyboard.jpg`（75% 配列、右上旋钮、绿 Enter、F 行紫色个性键）核对。

## 5. 五风格系统：新增第六风格的同步清单

五风格 = 同一份 DOM 几何的三层重映射（SVG filter + Canvas Fx + CSS 皮肤）。新增风格必须**同时**改完以下位置，缺一会出现半套风格：

1. `app.js` 的 `STYLES` 数组：`{ id, no, cn, en, desc }`；
2. `index.html`：新增 `<filter id="f-{id}">`；
3. `styles.css`：`body.style-{id} #camera{filter:url(#f-{id}) …}`，滤镜**只能挂在 `#camera`**，禁止挂到 body 或任何 UI 元素；
4. `styles.css`：`body.style-{id}` 背景与 `#grain` 纹理叠层；
5. `app.js` 的 `Fx`：`PAL.{id}` 调色板、`drawDot()` 画法分支，必要时处理 `mk()` 的尺寸/概率与 `rain()`；
6. 风格卡分段由 JS 自动生成，但 `setStyle()` 中 `STYLE xx / 05` 的总数 `05` 目前是硬编码，改风格数量必须同步修改（切换卡 pill 与初始化文案）；
7. 若新风格是浅底或异色体系，必须按水墨风范式补品牌色转译皮肤：`.key.lit` / `.key.lit.purple` / `.key.enter` / `.key.novel` / `.slot(.purple)` / `#hero-title` / `.btn-*` / `#topbar`；浅底下控件层仍默认深色，只反色必要元素。

行为约束：

- `setStyle()` 中「切到不同风格且 `state.started` 为真 → `replay()`」是刻意产品行为（见第 12 节），初始化 `setStyle(0)` 与重复选择当前风格不得触发重播；改动此逻辑必须同步 README 操作表。
- 切换风格不得重建 DOM、不得引入异步资源加载。

## 6. 输入与快捷键

- `Tab` 是重播键：在全局 `keydown` 最前分支处理，**始终 `preventDefault()`** 拦截焦点跳转；`e.repeat` 时只拦截不重播。
- **不要恢复 `R` 重播**：`R` 是 `T R A E …` 序列的第二键，重播绑定在它上面会与接力输入冲突。
- 数字键 `1–5` 仅在 `OPENING / ASSEMBLING / HERO` 切换风格；`TYPING` 阶段必须吞掉数字键为序列输入让位。
- 序列仲裁三分支固定：当前目标键 → 立即敲下推进；序列未来键 → `tickled` 200ms；无关键 → 忽略；`e.repeat` 一律丢弃。
- 静音开关 `M`，持久化 key 为 `localStorage['trae1024-muted']`，不得改名（回访依赖它）。
- 所有外链（官网、社区）必须 `target="_blank" rel="noopener"`。

## 7. 音频

- **不允许添加任何音频文件**，全部声音由 Web Audio 实时合成（`Snd` 模块）。
- 新音效一律接入带 `DynamicsCompressor` 的 `bus()` 总线，禁止直连 `destination`。
- AudioContext 遵循自动播放策略：首次 `pointerdown/keydown` 才 `unlock()`；解锁前演出必须无声照常进行。
- 音频初始化/播放失败不得影响视觉演出与控件可用性。

## 8. 视觉与品牌

- 颜色一律走 `:root` CSS 变量；品牌锚点：绿 `#10B981`（`--em`）、紫 `#A855F7`（`--pu`）、琥珀 `#F0B23E`（`--am`）。
- UI 控件层（顶栏、风格卡、控件、提示）恒为深色品牌 UI，风格化滤镜永远不触及该层。
- 图标用内联 SVG（stroke 风格，stroke-width 1.5–2），禁止引入 emoji 或图标字体。
- 任何新动画必须在 `body.motion-reduce` 下有兜底；reduced-motion 命中时加载后直达 HERO、关闭滤镜与粒子循环。
- 水墨风的品牌色转译范式（绿→石绿、紫→朱砂、浅底反色）是跨风格品牌识别样板，新画风须提供等价锚点，字形可辨识是下限。

## 9. 性能、响应式与降级

- 断点固定 820px / 430px：新增固定定位 UI 必须在两档下自检不遮挡主角键位、HERO 字形与主 CTA；移动端底部留白用 `env(safe-area-inset-bottom)`。
- Canvas DPR 钳制 ≤ 2；粒子密度公式（屏面积自适应、上限 110）调整需在移动端验证帧率。
- `will-change` 只挂真正做 3D/动画的元素，禁止泛化。
- Canvas 2D 上下文获取失败必须落到 `#fallback` 卡片（品牌字 + 两个出口 + 重试），任何新启动依赖都要提供等价降级，不允许白屏。
- 支持范围：最近两个大版本 Chrome / Edge / Safari / Firefox，不支持 IE。

## 10. 部署

- `.github/workflows/static.yml` 在 push `main` 时把仓库根目录整体发布到 GitHub Pages（无构建步骤），也支持 Actions 手动触发。
- Pages 运行在 Linux 大小写敏感文件系统：引用路径大小写必须与真实文件完全一致。
- 不得假设任何服务端能力；`raw/` 会随仓库整体发布，禁止向其中放入涉密或超大文件。

## 11. 文档同步规则

改动以下内容时，必须在同一次变更中更新 `README.md`：

- 状态机阶段、时长或时序常量；
- 快捷键 / 手势 / 点击行为（操作一览表）；
- 新增/删除文件或目录、部署方式；
- 风格数量、风格切换语义。

刻意与 PRD 不一致的决策，登记到 README 的「与 PRD 的实现取舍」一节并写明理由。文档内链接一律使用相对路径，禁止写本机绝对路径。

## 12. 当前相对 PRD v0.1 的已知偏离（代码现状为准）

1. 开场后切换到**不同风格会 `replay()` 从头重演**（PRD 原要求切换不中断、不重置序列）；
2. 重播键是 **Tab** 而非 PRD 定义的 `R`（避免与序列第二键冲突）；
3. 末键敲下后停留 **2600ms**（`HOLD_AFTER_TYPED`）再汇聚，PRD 仅写「保持一拍」。

## 13. 协作与提交

- 提交信息遵循 Conventional Commits（`feat:` / `fix:` / `docs:` / `chore:`），描述可用中文。
- 未经用户明确要求，不执行 `git commit` / `git push`。
- 不主动新建 Markdown 文档；`raw/` 内 PRD 是外部输入物，不回写修改。

---

## 关键代码索引

| 关注点 | 位置 |
| :-- | :-- |
| 时序常量、序列、状态 | `app.js` 顶部 `SEQUENCE` / `T_*` / `KEY_*` / `HOLD_AFTER_TYPED` / `state` |
| 五风格元数据 | `app.js` 的 `STYLES` |
| 键盘布局 DSL | `app.js` 的 `ROWS` / `SUBS` / `buildKeyboard()` |
| 演出编排 | `app.js` 的 `enterOpening / startTyping / strike / enterAssembling / enterHero / replay` |
| 粒子引擎 | `app.js` 的 `Fx`（`PAL` / `drawDot` / `rain` / `setMode`） |
| 合成音效 | `app.js` 的 `Snd`（`click / whoosh / chime / toggle`） |
| 全局输入仲裁 | `app.js` 的 `document.addEventListener('keydown', …)` |
| 后台挂起恢复 | `app.js` 的 `visibilitychange` |
| 启动/降级 | `app.js` 的 `boot()` |
| 五风格 SVG 滤镜 | `index.html` 顶部 `<defs>`（`f-pixel / f-lowpoly / f-toon / f-oil / f-ink`） |
| 场景机位分镜 | `styles.css` 中 `body.phase-* #board-wrap` |
| 键帽结构与三态 | `styles.css` 中 `#board / .key / .cap / .face` 与 `.next/.pressed/.lit/.tickled` |
| 水墨色彩转译 | `styles.css` 中 `body.style-ink …` 区块 |
| Pages 部署 | `.github/workflows/static.yml` |
