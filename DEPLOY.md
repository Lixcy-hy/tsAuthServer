# Docker 部署

本仓库 `docker-compose.yml` **只打包本应用**，**不**起 PostgreSQL / Redis。
请把 `DATABASE_URL` / `REDIS_URL` 指向你已部署好的外部服务（同一台机器、云 RDS、容器里跑的其他 stack 都行）。

## 快速开始

```bash
# 1. 准备环境变量（.env 已在 .gitignore 中）
cp .env.docker .env
vi .env   # 填 DATABASE_URL / REDIS_URL / TOKEN_SECRET / AMAP_KEY

# 2. 构建并启动应用
bun run docker:up

# 3. 首次部署需要执行数据库迁移
bun run docker:migrate

# 4. 查看日志
bun run docker:logs
```

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | ✅ | `postgres://user:pass@host:5432/db?options=-c%20search_path%3Dmocklocation` |
| `REDIS_URL` | ✅ | `redis://:password@host:6379/0` |
| `TOKEN_SECRET` | ✅ | 任意长随机串，用于 token 指纹 |
| `TOKEN_EXPIRE_DAYS` | 否 | 默认 30 |
| `AMAP_KEY` | 否 | 高德 Web 服务 key，地点搜索需要 |
| `PG_SCHEMA` | 否 | 默认 `mocklocation` |
| `APP_PORT` | 否 | 容器内 8080 映射到宿主机的端口，默认 8080 |
| `PLACE_SEARCH_LIMIT_PER_MINUTE` | 否 | 默认 60 |
| `LOGIN_LIMIT_PER_MINUTE` | 否 | 默认 10 |
| `TZ` | 否 | 默认 `Asia/Shanghai` |

## 连接宿主机已有服务

如果你的 PG / Redis 跑在宿主机（不是 docker）上，把容器接入用 `host.docker.internal`：

```env
DATABASE_URL=postgres://postgres:xxx@host.docker.internal:5432/location_service?options=-c%20search_path%3Dmocklocation
REDIS_URL=redis://:xxx@host.docker.internal:6379/0
```

并在 `docker-compose.yml` 里启用 `extra_hosts: ["host.docker.internal:host-gateway"]`（已写在注释里）。

## 验证

```bash
# 健康检查
curl http://localhost:8080/api/v1/health

# 登录测试
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"account":"test","password":"123456"}'
```

## VPS 部署步骤

```bash
# 1. 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl enable --now docker

# 2. 上传项目
git clone <your-repo>
cd mocklocation/server_ts

# 3. 启动
cp .env.docker .env
vi .env   # 填写连接信息
bun run docker:up
bun run docker:migrate

# 4. 反向代理（Nginx / Caddy 代理到 8080，略）

# 5. HTTPS
# certbot --nginx -d api.example.com
```

## 常用命令

```bash
docker compose ps                       # 运行状态
docker compose logs -f app              # 看日志
docker compose restart app              # 仅重启应用
bun run docker:up                       # 代码改了重新构建并启动
docker compose down                     # 停止（外部 DB 不受影响）
```

## 镜像大小

基于 `oven/bun:1.1-alpine`，约 80MB 左右。
