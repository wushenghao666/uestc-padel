# UESTC Padel

一个面向手机端的 Padel / 板式网球 Americano 活动计分 PWA。

## 当前功能

- 球员无需登录即可创建活动、报名、维护报名信息和录入比分。
- 管理员登录后可以编辑、结束和删除活动。
- 当前支持 4 人轮转赛，默认生成：
  - AB vs CD
  - AC vs BD
  - AD vs BC
- 支持抢分和局制计分；局制在排行统计中按 4 倍分数计算。
- 活动开始后仍可维护球员和场次，活动结束后数据锁定。
- 活动内排行按胜场数、净胜得分、总得分排序，完全相同时并列。
- 总排行榜显示每个球员的活动次数、总得分、总积分，并支持切换排序。
- 支持 PWA 安装、静态资源离线缓存和 Cloudflare D1 共享数据。

## 本地预览

静态页面可以直接用浏览器打开 `index.html`，但共享数据 API 需要 Cloudflare Pages Functions 和 D1。

如只想预览界面，可以在项目目录启动静态服务：

```bash
python -m http.server 4174 --bind 127.0.0.1
```

然后访问：

```text
http://127.0.0.1:4174/index.html
```

本地静态预览无法连接 `/api/state` 时，会回退到浏览器 `localStorage`。

## 线上架构

```text
Cloudflare Pages 静态资源
  -> Pages Functions: /api/state, /api/admin/login
  -> Cloudflare D1: app_state
```

共享数据以一个 JSON 状态对象存储在 D1 中，并通过版本号避免多设备同时覆盖。页面会每 3 秒轮询一次远程状态，让其他手机接近实时看到比分变化。

## 部署

Cloudflare Pages 和 D1 的设置见 [DEPLOY.md](./DEPLOY.md)。
