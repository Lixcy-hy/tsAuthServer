-- 阿桓工具箱 - 数据库初始化脚本
-- PostgreSQL 14+

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id         BIGSERIAL PRIMARY KEY,
    account    VARCHAR(64)   NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name       VARCHAR(128)  NOT NULL DEFAULT '',
    status     VARCHAR(16)   NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'DISABLED')),
    role       VARCHAR(16)   NOT NULL DEFAULT 'USER'
        CHECK (role IN ('USER', 'ADMIN')),
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 补充 role 列（以防之前创建过老表）
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(16) NOT NULL DEFAULT 'USER';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('USER', 'ADMIN'));

CREATE INDEX IF NOT EXISTS idx_users_account ON users (account);

-- 访问令牌表
CREATE TABLE IF NOT EXISTS access_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128)  NOT NULL,
    expires_at TIMESTAMPTZ   NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_tokens_hash
    ON access_tokens (token_hash)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_access_tokens_user
    ON access_tokens (user_id, revoked_at);

-- 地点搜索日志（可选，用于审计/分析）
CREATE TABLE IF NOT EXISTS place_search_logs (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    keyword      VARCHAR(256)  NOT NULL,
    city         VARCHAR(64),
    source       VARCHAR(32)   NOT NULL DEFAULT 'amap',
    result_count INT           NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_place_search_logs_user
    ON place_search_logs (user_id, created_at DESC);

-- ============================================================
-- Seed: 创建测试账号
-- 账号: test, 密码: 123456
-- Hash 由 bun run scripts/seed.ts test 123456 生成
-- ============================================================
INSERT INTO users (account, password_hash, name, status)
VALUES (
    'test',
    '$2a$10$efNsmaTDkMQBza2Jt1SiqORX3IEB2qjyPCZPFGITkgLwSrS5MVMGe',
    '测试账号',
    'ACTIVE'
) ON CONFLICT (account) DO NOTHING;
