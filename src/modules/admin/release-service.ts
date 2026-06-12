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
  download_urls: string[];
  enabled: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export class ReleaseError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

const RELEASE_SELECT = `
  id, platform, package_name, version_name, version_code,
  force_update, min_version_code, message, download_urls,
  enabled, notes, created_at, updated_at
`;

export const releaseService = {
  async listReleases(params: {
    platform?: string;
    packageName?: string;
    page: number;
    pageSize: number;
  }) {
    const { platform, packageName, page, pageSize } = params;
    const offset = (page - 1) * pageSize;

    // 用 EXISTS 条件动态拼接
    const filters: string[] = [];
    if (platform) filters.push(`platform = $${filters.length + 1}`);
    if (packageName) filters.push(`package_name = $${filters.length + 1}`);
    const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const listSqlText = `
      SELECT ${RELEASE_SELECT}
      FROM app_releases
      ${where}
      ORDER BY version_code DESC
      LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}
    `;
    const countSqlText = `SELECT COUNT(*)::int AS count FROM app_releases ${where}`;

    const values: (string | number | boolean | null)[] = [];
    if (platform) values.push(platform);
    if (packageName) values.push(packageName);
    values.push(pageSize, offset);

    const [items, countRows] = await Promise.all([
      sql.unsafe<AppReleaseRow[]>(listSqlText, values),
      sql.unsafe<[{ count: number }]>(
        countSqlText,
        values.slice(0, values.length - 2),
      ),
    ]);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total: countRows[0]?.count ?? 0,
        totalPages: Math.ceil((countRows[0]?.count ?? 0) / pageSize),
      },
    };
  },

  async getRelease(id: string): Promise<AppReleaseRow | null> {
    const rows = await sql<AppReleaseRow[]>`
      SELECT ${sql.unsafe(RELEASE_SELECT)} FROM app_releases WHERE id = ${id} LIMIT 1
    `;
    return rows[0] ?? null;
  },

  async createRelease(input: {
    platform: string;
    packageName: string;
    versionName: string;
    versionCode: number;
    forceUpdate?: boolean;
    minVersionCode?: number | null;
    message?: string | null;
    downloadUrls: string[];
    enabled?: boolean;
    notes?: string | null;
  }): Promise<AppReleaseRow> {
    if (!input.downloadUrls || input.downloadUrls.length === 0) {
      throw new ReleaseError(400, "downloadUrls 不能为空");
    }

    try {
      const rows = await sql<AppReleaseRow[]>`
        INSERT INTO app_releases (
          platform, package_name, version_name, version_code,
          force_update, min_version_code, message, download_urls,
          enabled, notes
        ) VALUES (
          ${input.platform}, ${input.packageName}, ${input.versionName}, ${input.versionCode},
          ${input.forceUpdate ?? false},
          ${input.minVersionCode ?? null},
          ${input.message ?? null},
          ${JSON.stringify(input.downloadUrls)}::jsonb,
          ${input.enabled ?? true},
          ${input.notes ?? null}
        )
        RETURNING ${sql.unsafe(RELEASE_SELECT)}
      `;
      return rows[0];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("uniq_app_releases_pf_pkg_vc")) {
        throw new ReleaseError(
          409,
          "该 (platform, packageName, versionCode) 已存在",
        );
      }
      throw err;
    }
  },

  async updateRelease(
    id: string,
    input: {
      versionName?: string;
      forceUpdate?: boolean;
      minVersionCode?: number | null;
      message?: string | null;
      downloadUrls?: string[];
      enabled?: boolean;
      notes?: string | null;
    },
  ): Promise<AppReleaseRow> {
    const existing = await this.getRelease(id);
    if (!existing) {
      throw new ReleaseError(404, "版本不存在");
    }

    const next = {
      version_name: input.versionName ?? existing.version_name,
      force_update: input.forceUpdate ?? existing.force_update,
      min_version_code:
        input.minVersionCode !== undefined
          ? input.minVersionCode
          : existing.min_version_code,
      message: input.message !== undefined ? input.message : existing.message,
      download_urls: input.downloadUrls ?? (existing.download_urls as string[]),
      enabled: input.enabled ?? existing.enabled,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    };

    if (next.download_urls.length === 0) {
      throw new ReleaseError(400, "downloadUrls 不能为空");
    }

    const rows = await sql<AppReleaseRow[]>`
      UPDATE app_releases
      SET version_name = ${next.version_name},
          force_update = ${next.force_update},
          min_version_code = ${next.min_version_code},
          message = ${next.message},
          download_urls = ${JSON.stringify(next.download_urls)}::jsonb,
          enabled = ${next.enabled},
          notes = ${next.notes}
      WHERE id = ${id}
      RETURNING ${sql.unsafe(RELEASE_SELECT)}
    `;
    return rows[0];
  },

  async deleteRelease(id: string): Promise<void> {
    const result = await sql`DELETE FROM app_releases WHERE id = ${id}`;
    if (result.count === 0) {
      throw new ReleaseError(404, "版本不存在");
    }
  },
};
