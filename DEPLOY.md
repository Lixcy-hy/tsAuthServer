# Docker 部署

## 方式 A：一键 Compose（推荐，最简单）

`docker-compose.yml` 已经配置好 PostgreSQL + Redis + 应用，一键起三个容器。

```bash
# 1. 复制并编辑环境变量
cp .env.docker .env
vi .env   # 改密码

# 2. 启动所有服务
bun run docker:up

# 3. 跑数据库迁移（首次部署）
bun run docker:migrate

# 4. 看日志
bun run docker:logs

# 5. 停止
bun run docker:down
```

## 方式 B：单容器 + 外部数据库

假设你 VPS 上已有 PostgreSQL 和 Redis：

```bash
# 1. 构建镜像
bun run docker:build

# 2. 准备环境变量文件
cp .env.docker .env.runtime
vi .env.runtime   # 配置 DATABASE_URL / REDIS_URL 指向你的服务

# 3. 启动容器
docker run -d \
  --name ahuan-app \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file .env.runtime \
  ahuan-toolbox-server

# 4. 跑迁移（在容器内执行一次）
docker exec ahuan-app bun run migrations/run.ts
```

## 验证

```bash
# 健康检查
curl http://localhost:8080/api/v1/health

# 登录测试
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"account":"test","password":"123456"}'
```

## VPS 部署步骤（全新服务器）

```bash
# 1. 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl enable --now docker

# 2. 上传项目（用 scp / git clone）
git clone <your-repo>
cd mocklocation/server_ts

# 3. 启动
cp .env.docker .env
vi .env   # 改密码、AMAP_KEY
bun run docker:up
bun run docker:migrate

# 4. 配置反向代理（Nginx / Caddy）
# 这里略，80/443 端口代理到 8080

# 5. 申请 HTTPS 证书（Let's Encrypt）
# certbot --nginx -d api.example.com
```

## 镜像大小

基于 `oven/bun:1.1-alpine` + 源码，**约 80MB 左右**（Bun 镜像本身就小）。

## 常用命令

```bash
# 查看运行状态
docker compose ps

# 进入应用容器调试
docker compose exec app sh

# 重新构建（代码改了之后）
bun run docker:up   # --build 已经在命令里

# 只重启 app 容器（不重建）
docker compose restart app

# 完全清理
docker compose down -v   # -v 会删卷，慎用
```
