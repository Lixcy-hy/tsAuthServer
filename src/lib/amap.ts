import { config } from "../config";

interface AmapPoi {
  id: string;
  name: string;
  address: string;
  location: string; // "lng,lat"
  pname: string;
  cityname: string;
  adname: string;
}

interface AmapResponse {
  status: string;
  infocode: string;
  count: string;
  pois: AmapPoi[];
  info: string;
}

export interface PlaceItem {
  id: string | null;
  name: string;
  address: string | null;
  longitude: number;
  latitude: number;
  coordinateType: "GCJ-02";
  province: string | null;
  city: string | null;
  district: string | null;
  source: "amap";
}

export async function searchAmap(params: {
  keyword: string;
  city?: string;
  limit: number;
}): Promise<PlaceItem[]> {
  const { keyword, city, limit } = params;

  if (!config.amapKey) {
    throw new Error("AMAP_KEY 未配置");
  }

  const url = new URL("https://restapi.amap.com/v3/place/text");
  url.searchParams.set("key", config.amapKey);
  url.searchParams.set("keywords", keyword);
  url.searchParams.set("offset", String(limit));
  url.searchParams.set("extensions", "base");
  url.searchParams.set("output", "json");
  if (city) {
    url.searchParams.set("city", city);
    url.searchParams.set("citylimit", "true");
  }

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    throw new Error(`高德 HTTP 错误: ${resp.status}`);
  }

  let data: AmapResponse;
  try {
    data = (await resp.json()) as AmapResponse;
  } catch {
    throw new Error("高德响应非 JSON");
  }

  if (data.status !== "1") {
    throw new Error(`高德 API 错误: ${data.info} (infocode: ${data.infocode})`);
  }

  if (!data.pois || data.pois.length === 0) {
    return [];
  }

  return data.pois.map((poi) => {
    const [lngStr, latStr] = poi.location.split(",");
    return {
      id: poi.id,
      name: poi.name,
      address: poi.address || null,
      longitude: Number(lngStr),
      latitude: Number(latStr),
      coordinateType: "GCJ-02",
      province: poi.pname || null,
      city: poi.cityname || null,
      district: poi.adname || null,
      source: "amap",
    };
  });
}
