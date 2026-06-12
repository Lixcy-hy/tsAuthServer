/**
 * 生成测试账号密码 hash
 * 用法：bun run scripts/seed.ts [account] [password]
 * 默认：account=test password=123456
 */
import bcrypt from "bcryptjs";

const account = process.argv[2] || "test";
const password = process.argv[3] || "123456";

const hash = await bcrypt.hash(password, 10);

console.log(`-- account: ${account}`);
console.log(`-- password: ${password}`);
console.log();
console.log("INSERT INTO users (account, password_hash, name, status)");
console.log("VALUES (");
console.log(`    '${account}',`);
console.log(`    '${hash}',`);
console.log(`    '测试账号',`);
console.log(`    'ACTIVE'`);
console.log(") ON CONFLICT (account) DO NOTHING;");
