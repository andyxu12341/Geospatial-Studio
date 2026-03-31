import { GeocodeItem, AreaQueryType, QueryGroup } from "./types";
import { withRetry, sleep } from "./base";
import { parseOverpassElements } from "./osmParser";

export { parseOverpassElements };

export function getQueryGroup(type: AreaQueryType): QueryGroup {
  if (type === "building" || type === "landuse" || type === "admin" || type === "all") {
    return "polygon";
  }
  return "poi";
}

export async function geocodeOSM(address: string, city?: string): Promise<GeocodeItem> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    url.searchParams.set("addressdetails", "1");
    if (city) url.searchParams.set("city", city);

    const res = await withRetry(() => fetch(url.toString(), {
      headers: { "User-Agent": "GeocodingTool/1.0" },
      signal: AbortSignal.timeout(10000)
    }));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as any[];

    if (!data || data.length === 0) {
      return { address, status: "failed", source: "osm", error: "未找到有效坐标" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = data[0] as any;
    const lvl = first.type ?? "";
    const genericLevels = ["administrative", "city", "province", "state", "country"];
    const isGeneric = genericLevels.includes(lvl);

    return {
      address,
      lng: first.lon,
      lat: first.lat,
      formattedAddress: first.display_name,
      source: "osm",
      status: "success",
      warning: isGeneric ? "已定位到区域中心" : undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    return { address, status: "failed", source: "osm", error: msg };
  }
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runOverpassQuery(query: string): Promise<any> {
  let lastError: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`[Overpass] 正在请求节点: ${endpoint}...`);
      const res = await fetch(endpoint, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "GeocodingTool/1.0 (https://github.com/your-repo)"
        },
        signal: AbortSignal.timeout(60000)
      });

      if (res.status === 429) {
        console.warn(`[Overpass] 节点 ${endpoint} 触发频率限制 (429)，尝试下一个节点...`);
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Overpass API 错误: HTTP ${res.status} ${text.slice(0, 100)}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await res.json() as any;
      if (data.remark && data.remark.includes("runtime error")) {
        throw new Error(`Overpass 运行时错误: ${data.remark}`);
      }
      return data;
    } catch (err) {
      console.warn(`[Overpass] 节点 ${endpoint} 请求失败（${err instanceof Error ? err.message : "未知错误"}），尝试下一个节点...`);
      lastError = err;
      await sleep(500);
    }
  }
  throw lastError || new Error("所有 Overpass 节点均不可用");
}

export function buildOverpassBboxQuery(bbox: [number, number, number, number], type: AreaQueryType): string {
  const [s, w, n, e] = bbox;
  const bboxStr = `${s},${w},${n},${e}`;
  const filters = getAreaTypeFilter(type);
  
  return `[out:json][timeout:60];
(
  ${filters.map(f => f.startsWith("node") ? `${f}(${bboxStr});` : `way${f}(${bboxStr});rel${f}(${bboxStr});`).join("\n  ")}
);
out body;
>;
out skel qt;`;
}

export function buildAreaOverpassQuery(areaName: string, type: AreaQueryType): string {
  const filters = getAreaTypeFilter(type);
  return `[out:json][timeout:60];
area["name"="${areaName}"]->.searchArea;
(
  ${filters.map(f => f.startsWith("node") ? `${f}(area.searchArea);` : `way${f}(area.searchArea);rel${f}(area.searchArea);`).join("\n  ")}
);
out body;
>;
out skel qt;`;
}

export function buildPolygonOverpassQuery(latLngs: [number, number][], type: AreaQueryType): string {
  const polyStr = latLngs.map(([lat, lng]) => `${lat} ${lng}`).join(" ");
  const filters = getAreaTypeFilter(type);
  return `[out:json][timeout:60];
(
  ${filters.map(f => f.startsWith("node") ? `node(poly:"${polyStr}")${f.replace("node", "")};` : `way(poly:"${polyStr}")${f};rel(poly:"${polyStr}")${f};`).join("\n  ")}
);
out body;
>;
out skel qt;`;
}

export function buildPOIBboxQuery(bbox: [number, number, number, number], type: AreaQueryType): string {
  const [s, w, n, e] = bbox;
  const bboxStr = `${s},${w},${n},${e}`;
  const filters = getPOITypeFilter(type);
  return `[out:json][timeout:60];
(
  ${filters.map(f => `node${f}(${bboxStr});way${f}(${bboxStr});`).join("\n  ")}
);
out center;`;
}

export function buildPOIPolygonQuery(latLngs: [number, number][], type: AreaQueryType): string {
  const polyStr = latLngs.map(([lat, lng]) => `${lat} ${lng}`).join(" ");
  const filters = getPOITypeFilter(type);
  return `[out:json][timeout:60];
(
  ${filters.map(f => `node(poly:"${polyStr}")${f};way(poly:"${polyStr}")${f};`).join("\n  ")}
);
out center;`;
}

export function buildPOIByKeywordQuery(keyword: string, type: AreaQueryType): string {
  const filters = getPOITypeFilter(type);
  if (type === "poi_all") {
    return `[out:json][timeout:60];
(
  node["name"~"${keyword}"];
  way["name"~"${keyword}"];
  rel["name"~"${keyword}"];
);
out center;`;
  } else {
    return `[out:json][timeout:60];
area["name"~"${keyword}"]->.searchArea;
(
  ${filters.map(f => `node${f}(area.searchArea);way${f}(area.searchArea);`).join("\n  ")}
);
out center;`;
  }
}

function getAreaTypeFilter(type: AreaQueryType): string[] {
  switch (type) {
    case "building":
      return ['["building"]'];
    case "landuse":
      return ['["landuse"]', '["leisure"]', '["amenity"]', '["natural"="water"]', '["waterway"]'];
    case "admin":
      return ['["boundary"="administrative"]["admin_level"]'];
    case "all":
    default:
      return ['["building"]', '["landuse"]', '["leisure"]', '["amenity"]', '["boundary"="administrative"]'];
  }
}

function getPOITypeFilter(type: AreaQueryType): string[] {
  switch (type) {
    case "poi_restaurant":
      return ['["amenity"~"restaurant|cafe|fast_food|bar|pub|food_court"]'];
    case "poi_medical":
      return ['["amenity"~"hospital|clinic|doctors|pharmacy|dentist"]'];
    case "poi_transport":
      return ['["amenity"~"bus_station|parking|bicycle_parking|taxi|fuel"]', '["railway"~"station|halt|tram_stop|subway_entrance"]', '["highway"="bus_stop"]'];
    case "poi_shopping":
      return ['["shop"]', '["amenity"~"marketplace|mall"]'];
    case "poi_education":
      return ['["amenity"~"school|university|college|kindergarten|library"]'];
    case "poi_sport":
      return ['["leisure"~"sports_centre|pitch|stadium|swimming_pool|golf_course"]'];
    case "poi_hotel":
      return ['["tourism"~"hotel|motel|guest_house|hostel|apartment"]'];
    case "poi_all":
    default:
      return [
        '["amenity"]', '["shop"]', '["tourism"]', '["leisure"]', '["office"]', '["craft"]'
      ];
  }
}
