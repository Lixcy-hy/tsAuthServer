import { type PlaceItem, searchAmap } from "../../lib/amap";
import { sql } from "../../lib/postgres";

const VALID_COORD_TYPES = new Set(["WGS-84", "GCJ-02", "BD-09"]);

export class PlaceError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

function isValidCoordType(t: string): t is "WGS-84" | "GCJ-02" | "BD-09" {
  return VALID_COORD_TYPES.has(t);
}

function filterAndClean(items: PlaceItem[]): PlaceItem[] {
  return items.filter((it) => {
    if (!isValidCoordType(it.coordinateType)) return false;
    if (Number.isNaN(it.longitude) || Number.isNaN(it.latitude)) return false;
    if (it.longitude < -180 || it.longitude > 180) return false;
    if (it.latitude < -90 || it.latitude > 90) return false;
    return true;
  });
}

function sortItems(
  items: PlaceItem[],
  keyword: string,
  city?: string,
): PlaceItem[] {
  const lowerKeyword = keyword.toLowerCase();
  return [...items].sort((a, b) => {
    // 1. 城市完全匹配优先
    if (city) {
      const aCityMatch = a.city === city ? 1 : 0;
      const bCityMatch = b.city === city ? 1 : 0;
      if (aCityMatch !== bCityMatch) return bCityMatch - aCityMatch;
    }
    // 2. 名称完全匹配优先
    const aExact = a.name.toLowerCase() === lowerKeyword ? 1 : 0;
    const bExact = b.name.toLowerCase() === lowerKeyword ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    // 3. 名称包含关键词优先
    const aInclude = a.name.toLowerCase().includes(lowerKeyword) ? 1 : 0;
    const bInclude = b.name.toLowerCase().includes(lowerKeyword) ? 1 : 0;
    if (aInclude !== bInclude) return bInclude - aInclude;
    // 4. 地址更完整的优先
    return (b.address?.length || 0) - (a.address?.length || 0);
  });
}

export const placesService = {
  async search(params: {
    keyword: string;
    city?: string;
    limit: number;
    userId: string;
  }): Promise<PlaceItem[]> {
    const { keyword, city, limit, userId } = params;

    const trimmed = keyword?.trim();
    if (!trimmed) {
      throw new PlaceError(400, "keyword 不能为空");
    }
    if (limit < 1 || limit > 20) {
      throw new PlaceError(400, "limit 必须在 1~20 之间");
    }

    let items: PlaceItem[];
    try {
      items = await searchAmap({ keyword: trimmed, city, limit });
    } catch (err) {
      console.error("[places] amap error:", err);
      throw new PlaceError(502, "上游地图服务异常");
    }

    items = filterAndClean(items);
    items = sortItems(items, trimmed, city);

    // 记录日志（失败不影响主流程）
    sql`
      INSERT INTO place_search_logs (user_id, keyword, city, source, result_count)
      VALUES (${userId}, ${trimmed}, ${city || null}, 'amap', ${items.length})
    `.catch((err) => console.error("[places] log error:", err));

    return items;
  },
};
