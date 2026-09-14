# macOS 安装与常见问题

## 下载哪个安装包？

Release 中的 **Universal DMG** 同时支持 **Apple 芯片（M 系列）** 与 **Intel Mac**，一般只需下载这一份。

若你自行打包：

| 命令 | 适用设备 |
|------|----------|
| `npm run dist:mac` | Universal（推荐发布） |
| `npm run dist:mac:arm64` | 仅 Apple 芯片 |
| `npm run dist:mac:intel` | 仅 Intel Mac |

在 **Intel Mac** 上安装只有 arm64 的旧构建会无法启动，请改用最新 Universal DMG 或 Intel 专用包。

## 提示「PlanDesk 已损坏，无法打开」

对话框里若出现 **「Chrome（或 Safari）于 … 下载了此文件」**，通常**不是**安装包损坏，而是 macOS **Gatekeeper** 拦截从未公证/未签名的应用，并给文件加了 **隔离（quarantine）** 属性。**不要**直接点「移到废纸篓」。

任选下面一种方式即可首次打开：

### 方法一：终端清除隔离属性（推荐）

将 PlanDesk 拖入「应用程序」文件夹后，在「终端」执行（路径按实际安装位置修改）：

```bash
xattr -cr /Applications/PlanDesk.app
```

然后像平时一样双击打开 PlanDesk。

若应用不在默认路径，把命令里的路径改成你的 `.app` 位置，例如：

```bash
xattr -cr ~/Downloads/PlanDesk.app
```

### 方法二：右键打开

在 Finder 中 **右键 PlanDesk.app → 打开**，在弹窗中再次确认「打开」（不要用双击首次启动）。

### 方法三：系统设置

打开 **系统设置 → 隐私与安全性**，在页面底部找到 PlanDesk 被拦截的说明，点击 **仍要打开**。

---

配置 Apple 开发者签名与公证后，新用户通常不再遇到上述提示；仓库 Release 工作流已预留相关 Secrets，供维护者使用。

## 安装步骤（DMG）

1. 打开 Release 中的 `.dmg`。
2. 将 **PlanDesk** 拖到 **应用程序**。
3. 若出现「已损坏」等提示，按上文处理后再启动。
4. 关闭主窗口不会退出应用，可从 Dock 或菜单栏图标再次打开（详见 [README → macOS 使用说明](../README.md#macos-使用说明)）。
