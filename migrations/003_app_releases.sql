-- 003_app_releases.sql
-- App 更新检测的版本元数据表

CREATE TABLE IF NOT EXISTS app_releases (
    id                 BIGSERIAL PRIMARY KEY,
    platform           VARCHAR(16)  NOT NULL DEFAULT 'android',
    package_name       VARCHAR(128) NOT NULL,
    version_name       VARCHAR(32)  NOT NULL,
    version_code       INTEGER      NOT NULL,
    -- 是否强制更新：true 时所有老版本都会被 App 阻断
    force_update       BOOLEAN      NOT NULL DEFAULT FALSE,
    -- 最低可用版本号：低于此版本号一律返回 hasUpdate=true（强制更新）
    min_version_code   INTEGER,
    -- 给 App 展示的更新提示文案
    message            TEXT,
    -- 下载地址列表，JSON 数组字符串
    download_urls      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    -- 是否生效；下线老版本时只把 enabled=false 即可，不删数据
    enabled            BOOLEAN      NOT NULL DEFAULT TRUE,
    -- 备注，发布说明等
    notes              TEXT,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 同一 (platform, package_name) 下 version_code 不能重复
CREATE UNIQUE INDEX IF NOT EXISTS uniq_app_releases_pf_pkg_vc
    ON app_releases (platform, package_name, version_code);

-- 按平台+包名+版本号倒序，查"最新一条"用
CREATE INDEX IF NOT EXISTS idx_app_releases_pf_pkg_vc_desc
    ON app_releases (platform, package_name, version_code DESC);

-- 只查启用的版本
CREATE INDEX IF NOT EXISTS idx_app_releases_enabled
    ON app_releases (platform, package_name, enabled)
    WHERE enabled = TRUE;

-- updated_at 自动更新
CREATE OR REPLACE FUNCTION app_releases_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_releases_updated_at ON app_releases;
CREATE TRIGGER trg_app_releases_updated_at
    BEFORE UPDATE ON app_releases
    FOR EACH ROW
    EXECUTE FUNCTION app_releases_touch_updated_at();
