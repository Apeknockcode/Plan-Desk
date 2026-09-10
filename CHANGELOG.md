# Changelog

## [1.4.0] - 2026-09-08

### Added

- 桌面组件 **宠物模式**（像素风 spritesheet）：`idle` / `busy` / `done` 帧动画 + 8 方向看向鼠标，点击角色展开待办列表
- 创建组件时可选择「桌面宠物」或「待办列表」
- `npm run generate:pet`：Node 脚本生成 `src/assets/pet/spritesheet.png` 与 `pet.json`（Codex 风格简化版）

## [1.3.0] - 2026-09-08

### Added

- 事项可选关联本地文件或文件夹，支持快速打开与在 Finder / 资源管理器中显示
- 关联路径失效检测，编辑时可重新选择
- macOS 菜单栏集成（按 plan 分组、数量显示、快速完成）
- 全局快速添加独立小窗（`Alt+Space` / `Alt+Shift+Space`）
- 设置页：导出/导入 JSON、开机自启
- 跨计划移动事项（编辑弹窗 + 右键菜单）

### Changed

- 桌面组件改为深色简洁风格，移除中间大数字块
- 每个计划只能创建一个桌面组件，重复创建会自动聚焦已有组件
- 拆分 `App.vue` 为 `PlanSidebar` / `TaskListPanel` / `useKeyboardShortcuts`

### Fixed

- 桌面组件创建崩溃（`setExcludedFromShownWindowsMenu`）
- 主界面 prefs 同步导致界面闪烁

### Removed

- 未使用的 `QuickAddModal.vue`（已由独立 `QuickAddApp` 小窗替代）

## [1.0.0] - 初始版本

- 计划分组与事项管理
- 桌面浮动小组件
- 系统托盘 / 菜单栏
- 数据本地 JSON 存储
