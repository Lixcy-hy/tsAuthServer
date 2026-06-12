# ============================================
# Stage 1: 构建前端（如果以后加前端构建步骤）
# ============================================
# 暂时没有前端构建，先用 base 阶段即可

# ============================================
# Stage 2: 运行时
# ============================================
FROM oven/bun:1.3-alpine AS runtime

# 元数据
LABEL maintainer="lixcy <lixcy@example.com>"
LABEL description="阿桓工具箱后端服务"

# 设置工作目录
WORKDIR /app

# 先拷贝依赖清单（利用 Docker 缓存）
COPY package.json bun.lock* ./

# 安装生产依赖
# --production 跳过 devDependencies
RUN bun install --production --frozen-lockfile

# 拷贝源码
COPY . .

# 公开端口
EXPOSE 8080

# 健康检查（每 30 秒访问 /api/v1/health）
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun run -e 'fetch("http://localhost:8080/api/v1/health").then(r => r.ok ? process.exit(0) : process.exit(1))' || exit 1

# 启动命令
CMD ["bun", "run", "src/index.ts"]
