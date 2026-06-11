# 阿桓工具箱 - 后端服务

基于 Hono + Bun + PostgreSQL + Redis 的后端服务，为 Android App 提供账号认证和地点搜索能力。

## 技术栈

- **Runtime**: Bun
- **Framework**: Hono
- **Database**: PostgreSQL (postgres.js)
- **Cache**: Redis (ioredis)
- **Auth**: Bearer Token (sha256 hash 存储)
- **Lint/Format**: Biome

## 快速开始

```bash
# 1. 安装依赖
bun install

# 2. 复制环境变量
cp .env.example .env
# 编辑 .env，配置 DATABASE_URL / REDIS_URL / AMAP_KEY 等

# 3. 启动 PostgreSQL 和 Redis（用 docker compose 或本地服务）

# 4. 初始化数据库
bun run db:migrate

# 5. 创建测试账号（可选，会打印 INSERT SQL）
bun run scripts/seed.ts test 123456

# 6. 启动服务
bun run dev
```

## 目录结构

```
server_ts/
├── src/
│   ├── index.ts              # 入口
│   ├── config.ts             # 配置加载
│   ├── lib/
│   │   ├── postgres.ts       # PG 连接池
│   │   ├── redis.ts          # Redis 连接
│   │   ├── response.ts       # 统一响应 {code, message, data}
│   │   ├── token.ts          # Token 生成/校验
│   │   └── amap.ts           # 高德 API 封装
│   ├── middleware/
│   │   ├── auth.ts           # Bearer Token 鉴权
│   │   └── rate-limit.ts     # 限流
│   ├── modules/
│   │   ├── auth/             # 认证模块
│   │   │   ├── routes.ts
│   │   │   └── service.ts
│   │   ├── places/           # 地点搜索
│   │   │   ├── routes.ts
│   │   │   └── service.ts
│   │   └── health/           # 健康检查
│   └── types/
│       └── env.d.ts
├── migrations/
│   ├── 001_init.sql          # 建表 SQL
│   └── run.ts                # 迁移执行器
├── scripts/
│   └── seed.ts               # 密码 hash 生成器
└── package.json
```

## API 接口

所有接口前缀：`/api/v1`

### 已接入（App 调用）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/auth/login` | 否 | 账号密码登录 |
| POST | `/auth/verify` | 否 | 验证 token |
| GET  | `/places/search` | 是 | 地点搜索 |

### 建议扩展（已实现，未被 App 调用）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET  | `/health` | 否 | 健康检查 |
| POST | `/auth/logout` | 是 | 退出登录 |
| POST | `/auth/refresh` | 是 | 刷新 token |

## 统一响应

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

- `code = 0` 表示成功
- 业务失败 HTTP 仍返回 200，App 通过 `code != 0` 判定
- 错误信息通过 `message` 展示

## 调试

```bash
# 登录
curl -X POST 'http://localhost:8080/api/v1/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"account":"test","password":"123456"}'

# 验证 token
curl -X POST 'http://localhost:8080/api/v1/auth/verify' \
  -H 'Content-Type: application/json' \
  -d '{"token":"<your-token>"}'

# 地点搜索
curl 'http://localhost:8080/api/v1/places/search?keyword=腾讯大厦&city=深圳&limit=10' \
  -H 'Authorization: Bearer <your-token>'

# 健康检查
curl 'http://localhost:8080/api/v1/health'
```

## 脚本

```bash
bun run dev          # 开发模式（热重载）
bun run start        # 生产模式
bun run db:migrate   # 执行数据库迁移
bun run typecheck    # 类型检查
bun run check        # Lint
bun run format       # 格式化
```
