-- 002_single_device.sql
-- 单设备登录：每个用户同时只允许 1 个有效（未撤销）token

-- 1. 关键约束：部分唯一索引
--    同一 user_id 下，revoked_at IS NULL 的 token 只能有 1 个
--    已被撤销的 token 不受约束，历史记录可保留
CREATE UNIQUE INDEX IF NOT EXISTS uniq_access_tokens_user_active
    ON access_tokens (user_id)
    WHERE revoked_at IS NULL;

-- 2. 一次性清理：把当前可能存在的"同用户多 token"老数据全部撤销
--    只保留每个用户最新的一条，旧的置为 revoked
UPDATE access_tokens at
SET revoked_at = NOW()
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY user_id
                   ORDER BY created_at DESC, id DESC
               ) AS rn
        FROM access_tokens
        WHERE revoked_at IS NULL
    ) t
    WHERE rn > 1
);
