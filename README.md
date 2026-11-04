# HELLO/WORLD — 轨道问候终端

一个会记住所有人问候的几何地球。

页面中央是一颗由多边形陆地和蓝色海洋构成的地球。一个几何小人沿着球面上的虚线不断行走；点击页面任意位置、或按下任意字母/回车键，它会跳起来说「你好世界！」。每一声问候都会写入 PostgreSQL 数据库，全球累计数字会通过 SSE 实时同步给所有正在访问的人。

## 视觉方向

不是常见的渐变卡片或极简 SaaS，而是一台「行星问候终端」：

- **新构成主义 + 数字粗野主义**：黑色画布、酸性荧光绿、钴蓝、朱红、米白纸色。
- **非对称编辑版式**：左侧竖排镂空汉字与宣言，中央巨型几何地球，右侧机械计数器与最近信号列表。
- **几何地球**：纯 SVG 手绘多边形大陆、海洋网纹、经纬线、轨道环、卫星和错版印刷式轮廓。
- **机械计数块**：荧光绿底、粗黑数字、钴蓝硬阴影，像一台来自未来的问候仪表。
- **实时共享感**：新问候会通过 SSE 推送到所有打开页面，计数、最近信号和在线人数同步更新；别人发送问候时会出现 `INCOMING` 提示。
- **细节**：胶片颗粒、滚动宣言、十字定位标记、指针涟漪、可读的屏幕阅读器状态。

## 运行

```bash
npm install
npm start
```

打开 <http://localhost:3000>。

开发时可使用：

```bash
npm run dev
```

## 数据库

应用使用 PostgreSQL（通过 [pg](https://node-postgres.com) 驱动）。表结构在首次启动时自动创建：

```sql
CREATE TABLE IF NOT EXISTS greetings (
  id         SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind       TEXT NOT NULL DEFAULT 'click'
);
```

## 环境变量

创建 `.env` 文件（不要提交到 git）：

```env
DATABASE_URL=postgresql://user:password@host:port/dbname
```

### 本地开发（直连公开数据库）

```env
DATABASE_URL=postgresql://customer_db_owner_user:EEqOgIizENcCZibGUMfJKIxKn7uAiL3miUtvxmtJfB4w59GkhrTCEhJUCqifHNfn@db-nkw7i-269-47.db.hostoflow.app:5432/customer_db
```

### HostOflow 平台部署（链接服务 "Helloworld"）

在 HostOflow 平台将数据库服务链接到该部署后，在环境变量设置里填写以下任一方式：

**方式一：单个 DATABASE_URL（推荐）**

```
DATABASE_URL=postgresql://customer_db_owner_user:EEqOgIizENcCZibGUMfJKIxKn7uAiL3miUtvxmtJfB4w59GkhrTCEhJUCqifHNfn@db-nkw7i-269-47.db.hostoflow.app:5432/customer_db
```

**方式二：按 Env variable label 逐个设置**

平台为你的服务生成的标签是 `db_nkw7i_269_47`，对应的环境变量如下：

```
DB_ENV_LABEL=db_nkw7i_269_47
DB_DB_NKW7I_269_47_HOST=db-nkw7i-269-47.db.hostoflow.app
DB_DB_NKW7I_269_47_PORT=5432
DB_DB_NKW7I_269_47_NAME=customer_db
DB_DB_NKW7I_269_47_USERNAME=customer_db_owner_user
DB_DB_NKW7I_269_47_PASSWORD=EEqOgIizENcCZibGUMfJKIxKn7uAiL3miUtvxmtJfB4w59GkhrTCEhJUCqifHNfn
```

> 也可使用内网域名 `db-nkw7i-269-47.tenant-hywang-lab` 替换 `HOST`，速度更快且无需开启公网访问。

## API

- `GET /api/stats` — 返回总数、最近 7 条信号和当前在线人数。
- `POST /api/hello` — 记录一次问候，返回最新计数。
- `GET /api/stream` — SSE 实时流：`stats`、`greeting`、`presence` 事件。
- `GET /health` — 健康检查。

## 部署提示

- 本应用无状态，可水平扩展至多个实例共享同一 PostgreSQL 数据库。
- 服务默认监听所有网络接口，可以通过 `PORT` 环境变量改端口。
- 让不同访客共享同一个计数，需要把应用部署到公网或局域网可访问的服务器，而不是只在本机打开。
- 平台若支持 `.env` 文件上传，可将数据库连接信息写入其中（见上方 `.env.example`）。

## 操作

- 点击 / 轻触页面任意非链接区域。
- 按下任意字母、数字、标点或回车键。
- 按住按键不会连续计数。
- 支持 `prefers-reduced-motion`，会降低动画幅度。
