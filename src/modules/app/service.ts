import { sql } from "../../lib/postgres";

export interface AppReleaseRow {
  id: string;
  platform: string;
  package_name: string;
  version_name: string;
  version_code: number;
  force_update: boolean;
  min_version_code: number | null;
  message: string | null;
  download_urls: string[] | unknown; // JSONB
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  versionName: string | null;
  versionCode: number | null;
  message: string | null;
  downloadUrls: string[];
}

export const appService = {
  /**
   * 更新检测核心逻辑
   *
   * 1. 取该 (platform, packageName) 下最新一条 enabled 的版本
   * 2. clientVersionCode < latest.versionCode  → hasUpdate = true
   * 3. 如果 latest.force_update = true，所有老版本都被阻断（返回 hasUpdate = true）
   * 4. 如果 latest.min_version_code 有值且 clientVersionCode < min_version_code，也被阻断
   * 5. 以上都不满足 → hasUpdate = false
   */
  async checkUpdate(
    platform: string,
    packageName: string,
    clientVersionCode: number,
  ): Promise<UpdateCheckResult> {
    // 取该平台+包名下所有 enabled 的版本，按 version_code 倒序
    const rows = await sql<AppReleaseRow[]>`
      SELECT id, platform, package_name, version_name, version_code,
             force_update, min_version_code, message, download_urls,
             enabled, created_at, updated_at
      FROM app_releases
      WHERE platform = ${platform}
        AND package_name = ${packageName}
        AND enabled = TRUE
      ORDER BY version_code DESC
      LIMIT 1
    `;

    // 没有任何记录：视为不强制更新（表还没建/没数据时不影响 App 正常使用）
    if (rows.length === 0) {
      return {
        hasUpdate: false,
        versionName: null,
        versionCode: null,
        message: null,
        downloadUrls: [],
      };
    }

    const latest = rows[0];

    // 判断是否需要更新
    let hasUpdate = false;

    // 情况1：客户端版本低于最新版本
    if (clientVersionCode < latest.version_code) {
      hasUpdate = true;
    }

    // 情况2：最新版本启用了强制更新（所有老版本都被阻断）
    if (latest.force_update) {
      hasUpdate = true;
    }

    // 情况3：有最低版本号要求，且客户端低于该要求
    if (
      latest.min_version_code !== null &&
      clientVersionCode < latest.min_version_code
    ) {
      hasUpdate = true;
    }

    if (!hasUpdate) {
      return {
        hasUpdate: false,
        versionName: null,
        versionCode: null,
        message: null,
        downloadUrls: [],
      };
    }

    const downloadUrls = Array.isArray(latest.download_urls)
      ? latest.download_urls
      : [];

    return {
      hasUpdate: true,
      versionName: latest.version_name,
      versionCode: latest.version_code,
      message: latest.message || null,
      downloadUrls,
    };
  },
};
