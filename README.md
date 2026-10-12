# bookmark-web

Vite + React + TypeScript 书签浏览与 CRUD 前端。从 GitHub Contents API 读取并更新 `data/all_bookmarks.json`（仓库格式：`owner/repo`）。

密钥只放在浏览器 `localStorage`，不会写入代码、不会提交。

## GitHub Pages

- **Live URL**: https://shalom-lab.github.io/bookmark-web/
- Vite `base` is set to `/bookmark-web/` (project site path).
- Deploy via GitHub Actions (`.github/workflows/deploy-pages.yml`) on push to `main`.
- In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## 快速开始

```bash
cd /workspace/bookmark-web
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## BYOK 设置（localStorage）

密钥与仓库用**扁平、带连字符**的两个键，**不是** JSON blob：

| Key | Value |
| --- | --- |
| `gh-bookmark-token` | GitHub PAT（BYOK） |
| `gh-bookmark-repo` | 单个字符串 `owner/repo`（不要拆成两个 key） |

**可 Settings 填写，也可事先写入 localStorage；启动会自动读。**

1. 打开 **/settings**（或首页「设置」）
2. 粘贴 GitHub PAT（密码框），填写仓库 `owner/repo`（单个输入框）
3. **测试连接**（可选）→ **保存**（`setItem`）
4. **清除** 会确认后 `removeItem` 两个键

启动时静默读取上述两个键到 React state，不弹窗打断：

- 已设置：Settings 显示「已保存」（token 仅掩码末 4 位）；首页可直接加载书签
- 未设置：显示「未设置」；引导到 Settings

切仓库时在 API 调用处再按 `/` 拆分 `owner` / `name`。不要把 PAT 写进仓库、`.env` 或 Actions 给浏览器用。

### PAT 权限（Scopes）

| Token 类型 | 需要的权限 |
| --- | --- |
| Fine-grained | Repository → **Contents: Read and write**；选中目标数据仓库 |
| Classic | 勾选 **`repo`**（私有仓）；仅公有仓可试 `public_repo` |

## 功能

- **卡片 UI**：分类胶囊、评分星、简介、胶囊标签
- **多字段搜索**：标题 / URL / 简介(`desc`) / 标签 / 分类；分类 tabs + 标签侧栏筛选
- **本地优先编辑**：新建/编辑先写入 localStorage 草稿（`gh-bookmark-local-draft`），显示「未推送」与「推送到远程」；**不在每次编辑时推送**
- **批量推送**：点击「推送到远程」对 `data/all_bookmarks.json` 做一次 Contents API RMW（带 `sha`）
- **删除**：确认后立即同步到远程
- **Settings 页**：密码 token、单个 owner/repo、保存/清除（确认）、已保存/未设置并掩码末 4 位；页面居中

数据文件路径（非 BYOK 键，应用内默认）：分支 `main`、路径 `data/all_bookmarks.json`。

## App slug

应用标识 / slug：`bookmark`（localStorage 键前缀 `gh-bookmark-*`）。
