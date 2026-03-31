// ============================================================
// Geocoding Utility — Pure Frontend, Zero Backend
// Supports: Gaode (Amap) · Baidu · OpenStreetMap (Nominatim)
// ============================================================

import { gcj02towgs84, bd09towgs84, wgs84togcj02, transformBbox } from "./coordTransform";
import simplify from "@turf/simplify";
import { polygon } from "@turf/helpers";

export type MapSource = "gaode" | "baidu" | "osm";

export type AreaQueryType =
  | "all"         // 所有面域
  | "building"    // 建筑轮廓
  | "landuse"     // 城市功能区
  | "admin"       // 行政边界
  // POI 点位
  | "poi_restaurant"
  | "poi_medical"
  | "poi_transport"
  | "poi_shopping"
  | "poi_education"
  | "poi_sport"
  | "poi_hotel"
  | "poi_all";

export type QueryGroup = "polygon" | "poi";

export function getQueryGroup(type: AreaQueryType): QueryGroup {
  if (type.startsWith("poi_")) return "poi";
  return "polygon";
}

export type AreaQueryMode = "semantic" | "rectangle" | "polygon";

export const AREA_TYPE_LABELS: Record<AreaQueryType, string> = {
  all: "🌐 所有面域",
  building: "🏢 建筑轮廓",
  landuse: "🗺️ 城市功能区",
  admin: "🏛️ 行政边界",
  poi_restaurant: "🍜 餐饮美食",
  poi_medical: "🏥 医疗设施",
  poi_transport: "🚌 交通设施",
  poi_shopping: "🛒 商业购物",
  poi_education: "🎓 教育设施",
  poi_sport: "⚽ 体育健身",
  poi_hotel: "🏨 住宿服务",
  poi_all: "📍 所有 POI",
};

export const AREA_TYPE_DESCRIPTIONS: Record<AreaQueryType, string> = {
  all: "同时提取建筑、城市功能区、行政边界等多种面域",
  building: "查询建筑物轮廓（如单体建筑、大型场馆）",
  landuse: "查询住宅区、商业区、公园绿地、工业用地等城市功能区",
  admin: "查询行政区划边界（省/市/区/街道）",
  poi_restaurant: "查询餐厅、咖啡馆、小吃店等餐饮场所",
  poi_medical: "查询医院、诊所、药店等医疗设施",
  poi_transport: "查询停车场、公交站、码头等交通设施",
  poi_shopping: "查询商场、超市、便利店等商业购物场所",
  poi_education: "查询学校、大学、幼儿园等教育设施",
  poi_sport: "查询体育场、运动中心、篮球场等体育设施",
  poi_hotel: "查询酒店、旅馆、民宿等住宿服务",
  poi_all: "查询所有类型的 POI 点位",
};

export interface GeocodingConfig {
  source: MapSource;
  gaodeKey?: string;
  baiduKey?: string;
  areaQueryType?: AreaQueryType;
  regionFilter?: string;
}

export interface GeocodeItem {
  address: string;
  lng?: string;
  lat?: string;
  formattedAddress?: string;
  source?: MapSource;
  status: "success" | "failed";
  error?: string;
  category?: string;
  warning?: string; // Non-fatal warning (e.g. "定位到区域中心")
  polygon?: number[][][]; // For area query results: [[[lng, lat], [lng, lat], ...]]
  candidates?: GeocodeCandidate[]; // Multiple candidates for user to choose
}

export interface GeocodeCandidate {
  lng: string;
  lat: string;
  formattedAddress: string;
  province?: string;
  city?: string;
  district?: string;
  level?: string; // POI/street/building/city/district/province
}

export interface AreaResult {
  name: string;
  type: AreaQueryType;
  osmId: number;
  osmType: string;
  tags: Record<string, string>;
  categoryName: string;
  color: string;
  polygon: number[][][];
  center?: { lat: number; lng: number };
}

export interface POIResult {
  name: string;
  type: AreaQueryType;
  osmId?: number;
  osmType?: string;
  lat: number;
  lng: number;
  categoryName: string;
  color: string;
  tags: Record<string, string>;
  address?: string;
  source: "osm" | "gaode" | "baidu";
}

export const LANDUSE_STANDARD_MAP: Record<string, { name: string; color: string }> = {
  farmland: { name: "01 耕地", color: "#F5F8DC" },
  orchard: { name: "02 园地", color: "#BFE9AA" },
  vineyard: { name: "02 园地", color: "#BFE9AA" },
  wood: { name: "0301 乔木林地", color: "#68B167" },
  forest: { name: "03 林地", color: "#68B167" },
  grassland: { name: "0401 天然牧草地", color: "#83C238" },
  meadow: { name: "04 草地", color: "#83C238" },
  residential: { name: "0701 城镇住宅用地", color: "#FFFF2D" },
  apartments: { name: "0702 城镇住宅用地（公寓）", color: "#FFE600" },
  dormitory: { name: "0704 城镇住宅用地（宿舍）", color: "#FFEB3B" },
  house: { name: "0705 城镇住宅用地（住宅）", color: "#FFF176" },
  detached: { name: "0703 城镇住宅用地（独立住宅）", color: "#FFD700" },
  bungalow: { name: "0708 城镇住宅用地（平房）", color: "#FFF9C4" },
  terrace: { name: "0706 城镇住宅用地（排屋）", color: "#FFEE58" },
  semidetached_house: { name: "0707 城镇住宅用地（半独立住宅）", color: "#FFF59D" },
  static_caravan: { name: "0709 城镇住宅用地（移动房屋）", color: "#FFFDE7" },
  farm: { name: "01 耕地（农场建筑）", color: "#F5F8DC" },
  farmland: { name: "01 耕地", color: "#F5F8DC" },
  allotments: { name: "01 耕地（分配地）", color: "#F5F8DC" },
  farmyard: { name: "01 耕地（农家庭院）", color: "#F5F8DC" },
  greenhouse: { name: "01 耕地（温室）", color: "#E8F5E9" },
  orchard: { name: "02 园地（果园）", color: "#BFE9AA" },
  vineyard: { name: "02 园地（葡萄园）", color: "#BFE9AA" },
  plant_nursery: { name: "02 园地（苗圃）", color: "#BFE9AA" },
  wood: { name: "0301 乔木林地", color: "#68B167" },
  forest: { name: "03 林地", color: "#68B167" },
  nature_reserve: { name: "03 林地（自然保护区）", color: "#68B167" },
  grassland: { name: "0401 天然牧草地", color: "#83C238" },
  meadow: { name: "04 草地", color: "#83C238" },
  grass: { name: "14 绿地与开敞空间用地", color: "#00FF00" },
  scrub: { name: "04 草地（灌木丛）", color: "#83C238" },
  heath: { name: "04 草地（荒地）", color: "#83C238" },
  administrative: { name: "0801 机关团体用地", color: "#EB46DA" },
  public_building: { name: "0801 机关团体用地", color: "#EB46DA" },
  police: { name: "0801 机关团体用地（警察）", color: "#EB46DA" },
  fire_station: { name: "0801 机关团体用地（消防）", color: "#EB46DA" },
  post_office: { name: "0801 机关团体用地（邮局）", color: "#EB46DA" },
  townhall: { name: "0801 机关团体用地（市政厅）", color: "#EB46DA" },
  courthouse: { name: "0801 机关团体用地（法院）", color: "#EB46DA" },
  research_institute: { name: "0802 科研用地", color: "#F0005C" },
  library: { name: "0803 文化用地", color: "#FF7F00" },
  theatre: { name: "0803 文化用地", color: "#FF7F00" },
  museum: { name: "0803 文化用地", color: "#FF7F00" },
  cinema: { name: "0803 文化用地（电影院）", color: "#FF7F00" },
  school: { name: "0804 教育用地", color: "#FF85C9" },
  university: { name: "0804 教育用地", color: "#FF85C9" },
  college: { name: "0804 教育用地", color: "#FF85C9" },
  kindergarten: { name: "0804 教育用地", color: "#FF85C9" },
  pitch: { name: "0805 体育用地", color: "#00A57C" },
  sports_centre: { name: "0805 体育用地", color: "#00A57C" },
  stadium: { name: "0805 体育用地", color: "#00A57C" },
  swimming_pool: { name: "0805 体育用地（游泳池）", color: "#00A57C" },
  hospital: { name: "0806 医疗卫生用地", color: "#FF7F7E" },
  clinic: { name: "0806 医疗卫生用地", color: "#FF7F7E" },
  doctors: { name: "0806 医疗卫生用地", color: "#FF7F7E" },
  pharmacy: { name: "0806 医疗卫生用地", color: "#FF7F7E" },
  social_facility: { name: "0807 社会福利用地", color: "#FF9F7F" },
  nursing_home: { name: "0807 社会福利用地", color: "#FF9F7F" },
  place_of_worship: { name: "1503 宗教用地", color: "#CC0066" },
  religious: { name: "1503 宗教用地", color: "#CC0066" },
  institutional: { name: "08 公共管理与公共服务用地", color: "#EB46DA" },
  retail: { name: "0901 商业用地", color: "#FF0000" },
  mall: { name: "0901 商业用地", color: "#FF0000" },
  supermarket: { name: "0901 商业用地（超市）", color: "#FF0000" },
  market: { name: "0901 商业用地（市场）", color: "#FF0000" },
  commercial: { name: "0901 商业用地", color: "#FF0000" },
  restaurant: { name: "0901 商业用地（餐饮）", color: "#E53935" },
  cafe: { name: "0901 商业用地（餐饮）", color: "#E53935" },
  fast_food: { name: "0901 商业用地（餐饮）", color: "#E53935" },
  bank: { name: "0902 商务金融用地", color: "#C00000" },
  office: { name: "0902 商务金融用地", color: "#C00000" },
  hotel: { name: "0904 其他商业服务业用地", color: "#91372A" },
  industrial: { name: "1001 工业用地", color: "#BB9674" },
  quarry: { name: "1002 采矿用地", color: "#9E6C54" },
  depot: { name: "1101 物流仓储用地", color: "#8761D3" },
  warehouse: { name: "1101 物流仓储用地", color: "#8761D3" },
  railway: { name: "1201 铁路用地", color: "#595959" },
  train_station: { name: "1201 铁路用地", color: "#595959" },
  highway: { name: "1202 公路用地", color: "#ADADAD" },
  airport: { name: "1203 机场用地", color: "#B7B7B7" },
  parking: { name: "1208 交通场站用地", color: "#D9D9D9" },
  bus_station: { name: "1208 交通场站用地", color: "#D9D9D9" },
  garage: { name: "1208 交通场站用地（车库）", color: "#BDBDBD" },
  garages: { name: "1208 交通场站用地（车库群）", color: "#9E9E9E" },
  shed: { name: "1208 交通场站用地（棚屋）", color: "#E0E0E0" },
  carport: { name: "1208 交通场站用地（车棚）", color: "#EEEEEE" },
  park: { name: "1401 公园绿地", color: "#00FF00" },
  garden: { name: "1401 公园绿地", color: "#00FF00" },
  playground: { name: "1401 公园绿地（游乐场）", color: "#00FF00" },
  golf_course: { name: "0805 体育用地（高尔夫）", color: "#00A57C" },
  greenfield: { name: "1401 公园绿地（待开发）", color: "#E8F5E9" },
  recreation_ground: { name: "1401 公园绿地（娱乐）", color: "#00FF00" },
  village_green: { name: "1401 公园绿地（村庄绿地）", color: "#00FF00" },
  square: { name: "1403 广场用地", color: "#ACFFCF" },
  military: { name: "1501 军事设施用地", color: "#859156" },
  prison: { name: "1501 军事设施用地（监狱）", color: "#859156" },
  cemetery: { name: "1506 殡葬用地", color: "#4F7E3E" },
  grave_yard: { name: "1506 殡葬用地", color: "#4F7E3E" },
  landfill: { name: "1507 垃圾处理用地", color: "#795548" },
  water: { name: "1701 河流水面", color: "#338EC0" },
  river: { name: "1701 河流水面", color: "#338EC0" },
  stream: { name: "1701 河流水面", color: "#338EC0" },
  salt_pond: { name: "1701 河流水面（盐池）", color: "#338EC0" },
  canal: { name: "1705 沟渠", color: "#9ABCE2" },
  drain: { name: "1705 沟渠", color: "#9ABCE2" },
  ditch: { name: "1705 沟渠", color: "#9ABCE2" },
  aerodrome: { name: "1203 机场用地", color: "#B7B7B7" },
  runway: { name: "1203 机场用地", color: "#B7B7B7" },
  terminal: { name: "1203 机场用地", color: "#B7B7B7" },
  station: { name: "1201 铁路用地", color: "#595959" },
  halt: { name: "1201 铁路用地", color: "#595959" },
  tram_stop: { name: "1208 交通场站用地", color: "#D9D9D9" },
  subway_entrance: { name: "1208 交通场站用地", color: "#D9D9D9" },
  construction: { name: "其他用地（在建）", color: "#E0E0E0" },
  service: { name: "其他用地（服务设施）", color: "#F5F5F5" },
  roof: { name: "其他用地（顶棚）", color: "#FAFAFA" },
  default: { name: "其他用地（未匹配分类）", color: "#E0E0E0" },
};

export const POI_COLORS: Record<AreaQueryType, string> = {
  all: "#9B59B6",
  building: "#A9A9A9",
  landuse: "#00BFFF",
  admin: "#595959",
  poi_restaurant: "#E74C3C",
  poi_medical: "#FF6B6B",
  poi_transport: "#F39C12",
  poi_shopping: "#27AE60",
  poi_education: "#3498DB",
  poi_sport: "#1ABC9C",
  poi_hotel: "#8E44AD",
  poi_all: "#9B59B6",
};

const BUILDING_NAME_MAP: Record<string, string> = {
  yes: "未分类/未标注",
  apartments: "公寓建筑",
  dormitory: "宿舍建筑",
  detached: "独立住宅",
  house: "独户住宅",
  bungalow: "平房住宅",
  terrace: "排屋住宅",
  semidetached_house: "半独立住宅",
  static_caravan: "移动房屋",
  residential: "住宅建筑",
  commercial: "商业建筑",
  retail: "商业建筑（零售）",
  office: "办公建筑",
  industrial: "工业建筑",
  warehouse: "仓储建筑",
  garage: "车库/车棚",
  garages: "车库群",
  shed: "棚屋",
  carport: "车棚",
  roof: "顶棚结构",
  service: "服务性建筑",
  school: "学校建筑",
  university: "大学建筑",
  hospital: "医院建筑",
  clinic: "诊所建筑",
  hotel: "酒店建筑",
  mosque: "清真寺",
  church: "教堂",
  temple: "寺庙",
  synagogue: "犹太教堂",
  public: "公共建筑",
  government: "政府建筑",
  train_station: "火车站建筑",
  airport: "机场建筑",
  stadium: "体育场建筑",
  supermarket: "超市建筑",
  cinema: "电影院",
};

export function getStandardizedTags(tags: Record<string, string>, queryType: AreaQueryType): { categoryName: string; color: string } {
  if (queryType === "building") {
    const bType = tags.building;
    if (!bType || bType === "yes" || bType === "no") {
      return { categoryName: "未分类/未标注", color: "#A9A9A9" };
    }
    const displayName = BUILDING_NAME_MAP[bType] || bType;
    const mapped = LANDUSE_STANDARD_MAP[bType];
    return {
      categoryName: displayName,
      color: mapped?.color || "#A9A9A9",
    };
  }

  if (queryType === "landuse") {
    const specificTag =
      tags.amenity || tags.leisure || tags.shop || tags.military ||
      tags.building || tags.railway || tags.highway || tags.natural ||
      tags.waterway || tags.aeroway;
    const baseLanduse = tags.landuse || tags.natural || tags.waterway || "";

    const mapped = LANDUSE_STANDARD_MAP[specificTag] ||
                   LANDUSE_STANDARD_MAP[baseLanduse] ||
                   LANDUSE_STANDARD_MAP.default;

    return { categoryName: mapped.name, color: mapped.color };
  }

  if (queryType === "all") {
    const specificTag =
      tags.amenity || tags.leisure || tags.shop || tags.military ||
      tags.landuse || tags.natural || tags.waterway || tags.building ||
      tags.railway || tags.aeroway;

    const mapped = LANDUSE_STANDARD_MAP[specificTag] || LANDUSE_STANDARD_MAP.default;
    return { categoryName: mapped.name, color: mapped.color };
  }

  if (queryType === "admin") {
    return { categoryName: "行政边界", color: "#595959" };
  }

  if (queryType.startsWith("poi_")) {
    const POI_LABELS: Record<AreaQueryType, string> = {
      all: "所有 POI",
      building: "建筑",
      landuse: "城市功能区",
      admin: "行政边界",
    poi_restaurant: "餐饮美食",
    poi_medical: "医疗设施",
    poi_transport: "交通设施",
    poi_shopping: "商业购物",
    poi_education: "教育设施",
    poi_sport: "体育健身",
    poi_hotel: "住宿服务",
    poi_all: "所有 POI",
    };
    return {
      categoryName: POI_LABELS[queryType],
      color: POI_COLORS[queryType],
    };
  }

  return { categoryName: "其他用地（未匹配分类）", color: "#E0E0E0" };
}

export interface BatchProgress {
  completed: number;
  total: number;
  latestResult?: GeocodeItem;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ── Request cache (localStorage + TTL) ──
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_VERSION = "v2"; // increment to invalidate old pre-transform cache

{
  const staleKeys = Object.keys(localStorage).filter(k => k.startsWith("gc:") && !k.startsWith(`gc:${CACHE_VERSION}:`));
  if (staleKeys.length > 0) {
    staleKeys.forEach(k => localStorage.removeItem(k));
    console.log(`[CacheFlush] 清除 ${staleKeys.length} 条旧缓存（坐标已洗白，重新查询以获取正确坐标）`);
  }
}

function cacheGet(address: string, source: MapSource, regionFilter?: string): GeocodeItem | null {
  try {
    const key = `gc:${CACHE_VERSION}:${source}:${address}:${regionFilter ?? ""}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const { item, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return item;
  } catch {
    return null;
  }
}

function cacheSet(address: string, source: MapSource, item: GeocodeItem, regionFilter?: string) {
  if (item.status === "success") {
    try {
      const key = `gc:${CACHE_VERSION}:${source}:${address}:${regionFilter ?? ""}`;
      localStorage.setItem(key, JSON.stringify({ item, ts: Date.now() }));
    } catch { /* storage full — ignore */ }
  }
}

export function clearGeocodingCache() {
  try {
    const prefix = "gc:";
    const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

// ── In-flight deduplication ──
const inflight = new Map<string, Promise<GeocodeItem>>();

const DELAY_MS: Record<MapSource, number> = {
  gaode: 340,
  baidu: 340,
  osm: 1100,
};

// JSONP helper (for Baidu which blocks CORS)
let _jsonpCounter = 0;
function jsonp<T>(url: string, timeout = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cbName = `__geo_${Date.now()}_${_jsonpCounter++}`;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; cleanup(); reject(new Error("JSONP 请求超时")); }
    }, timeout);

    function cleanup() {
      clearTimeout(timer);
      delete (window as unknown as Record<string, unknown>)[cbName];
      const el = document.getElementById(cbName);
      if (el) el.remove();
    }

    (window as unknown as Record<string, unknown>)[cbName] = (data: T) => {
      if (!settled) { settled = true; cleanup(); resolve(data); }
    };

    const script = document.createElement("script");
    script.id = cbName;
    const sep = url.includes("?") ? "&" : "?";
    script.src = `${url}${sep}callback=${cbName}`;
    script.onerror = () => { if (!settled) { settled = true; cleanup(); reject(new Error("JSONP 脚本加载失败")); } };
    document.head.appendChild(script);
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries - 1) {
        await sleep(800 * (attempt + 1));
      }
    }
  }
  throw lastErr;
}



// ─────────────────────────────────────────────────────────────────
// Search-First Geocoding Engine (V3)
// Core principle: ALWAYS start with POI text search.
// Only fall back to geocoding API when POI returns nothing.
// AMap's own ranking is authoritative — trust the first result.
// ─────────────────────────────────────────────────────────────────

async function searchGaodePOI(
  keyword: string,
  apiKey: string,
  city?: string,
): Promise<Array<{ name: string; location: string; address: string; type: string }>> {
  const url = new URL("https://restapi.amap.com/v3/place/text");
  url.searchParams.set("keywords", keyword);
  url.searchParams.set("key", apiKey);
  if (city) url.searchParams.set("city", city);
  url.searchParams.set("offset", "5");
  url.searchParams.set("page", "1");
  url.searchParams.set("extensions", "all");
  url.searchParams.set("output", "json");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as {
    status: string; info: string; infocode: string; count: string;
    pois?: Array<{ name: string; location: string; address: string; type: string }>;
  };

  if (data.status !== "1" || !data.pois?.length) return [];

  return data.pois
    .filter(p => p.location)
    .map(p => ({
      name: p.name,
      location: p.location,
      address: p.address ?? "",
      type: p.type ?? "",
    }));
}

// Gaode (Amap) — Search-first geocoding engine
// Strategy: POI search always first (AMap's ranking is authoritative for landmarks).
// Geocoding API is only a fallback when POI search returns nothing.
async function geocodeGaode(address: string, apiKey: string, city?: string): Promise<GeocodeItem> {
  try {
    const pois = await searchGaodePOI(address, apiKey, city);

    if (pois.length > 0) {
      const best = pois[0];
      const [gcjLng, gcjLat] = best.location.split(",").map(Number);
      const [wgsLng, wgsLat] = gcj02towgs84(gcjLng, gcjLat);
      const formattedAddress = best.address && best.address !== "[]"
        ? `${best.name} (${best.address})`
        : best.name;

      return {
        address,
        lng: wgsLng.toFixed(6),
        lat: wgsLat.toFixed(6),
        formattedAddress,
        source: "gaode" as const,
        status: "success" as const,
      };
    }

    const geoResult = await geocodeGaodeFallback(address, apiKey, city);
    if (geoResult) return geoResult;

    return { address, status: "failed", source: "gaode", error: "未找到有效坐标" };

  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    return { address, status: "failed", source: "gaode", error: msg };
  }
}

/**
 * Step 2 fallback: call the geocoding (address parsing) API.
 * Used only when POI search returns no specific results.
 */
async function geocodeGaodeFallback(address: string, apiKey: string, city?: string): Promise<GeocodeItem | null> {
  let url = `https://restapi.amap.com/v3/geocode/geo?key=${encodeURIComponent(apiKey)}&address=${encodeURIComponent(address)}&output=json`;
  if (city) url += `&city=${encodeURIComponent(city)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const data = await res.json() as {
    status: string; info: string;
    geocodes?: Array<{
      location: string;
      formatted_address: string;
      province: string;
      city: string;
      district?: string;
      level?: string;
    }>;
  };
  if (data.status !== "1" || !data.geocodes?.length) return null;

  const first = data.geocodes.find(g => g.location);
  if (!first) return null;

  const [gcjLng, gcjLat] = first.location.split(",").map(Number);
  const [wgsLng, wgsLat] = gcj02towgs84(gcjLng, gcjLat);
  const lvl = first.level ?? "";
  const genericLevels = ["city", "province", "country"];
  const isGeneric = genericLevels.includes(lvl);

  return {
    address,
    lng: wgsLng.toFixed(6),
    lat: wgsLat.toFixed(6),
    formattedAddress: first.formatted_address,
    source: "gaode" as const,
    status: "success" as const,
    warning: isGeneric ? "已定位到区域中心" : undefined,
  };
}

// Baidu
async function geocodeBaidu(address: string, apiKey: string, region?: string): Promise<GeocodeItem> {
  type BaiduResp = { status: number; result?: { location: { lng: number; lat: number }; level: string } };
  let url = `https://api.map.baidu.com/geocoding/v3/?address=${encodeURIComponent(address)}&output=json&ak=${encodeURIComponent(apiKey)}&ret_coordtype=gcj02ll`;
  if (region) url += `&city=${encodeURIComponent(region)}`;
  const data = await jsonp<BaiduResp>(url);
  if (data.status !== 0 || !data.result?.location) {
    return { address, status: "failed", source: "baidu", error: `百度API返回错误码 ${data.status}` };
  }
  const { lng: gcjLng, lat: gcjLat } = data.result.location;
  const [lng, lat] = gcj02towgs84(gcjLng, gcjLat);
  return {
    address,
    lng: lng.toFixed(6),
    lat: lat.toFixed(6),
    formattedAddress: address,
    source: "baidu",
    status: "success",
  };
}

// OpenStreetMap Nominatim
async function geocodeOSM(address: string, region?: string): Promise<GeocodeItem> {
  const query = region ? `${address} ${region}` : address;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`;
  const res = await fetch(url, {
    mode: "cors",
    headers: {
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;
  if (!data.length) {
    return { address, status: "failed", source: "osm", error: "Nominatim 未找到结果" };
  }
  return {
    address,
    lng: parseFloat(data[0].lon).toFixed(6),
    lat: parseFloat(data[0].lat).toFixed(6),
    formattedAddress: data[0].display_name,
    source: "osm",
    status: "success",
  };
}

/** Normalize raw error messages into user-friendly Chinese text */
function friendlyError(raw: string): string {
  if (/timeout|超时/i.test(raw)) return "匹配失败: 请求超时";
  if (/network|fetch|ERR_/i.test(raw)) return "匹配失败: 网络异常";
  if (/HTTP\s*[45]\d{2}/i.test(raw)) return "匹配失败: 服务端错误";
  if (/key|密钥|invalid/i.test(raw)) return "匹配失败: API Key无效";
  if (/JSONP/i.test(raw)) return "匹配失败: 跨域请求失败";
  if (raw.startsWith("匹配失败")) return raw;
  if (raw === "已取消") return raw;
  return "匹配失败: 未找到有效坐标";
}

async function geocodeOne(address: string, config: GeocodingConfig): Promise<GeocodeItem> {
  const cacheKey = `${config.source}:${address}:${config.gaodeKey ?? config.baiduKey ?? ""}:${config.regionFilter ?? ""}`;
  if (inflight.has(cacheKey)) {
    return inflight.get(cacheKey)!;
  }
  const cached = cacheGet(address, config.source, config.regionFilter);
  if (cached) return cached;
  const promise = withRetry(async () => {
    switch (config.source) {
      case "gaode":
        if (!config.gaodeKey) throw new Error("缺少高德 API Key");
        return geocodeGaode(address, config.gaodeKey, config.regionFilter);
      case "baidu":
        if (!config.baiduKey) throw new Error("缺少百度 API Key");
        return geocodeBaidu(address, config.baiduKey, config.regionFilter);
      case "osm":
        return geocodeOSM(address, config.regionFilter);
    }
  });
  inflight.set(cacheKey, promise);
  try {
    const result = await promise;
    cacheSet(address, config.source, result, config.regionFilter);
    return result;
  } finally {
    inflight.delete(cacheKey);
  }
}

export async function geocodeBatch(
  addresses: string[],
  config: GeocodingConfig,
  onProgress: (progress: BatchProgress) => void,
  signal?: AbortSignal,
  addressToCategory?: Map<string, string>,
): Promise<GeocodeItem[]> {
  const results: GeocodeItem[] = [];
  const total = addresses.length;
  const delay = DELAY_MS[config.source];

  // Nominatim requires at least 1s between requests; add initial delay to avoid burst
  if (config.source === "osm" && !signal?.aborted) {
    await sleep(delay);
  }

  for (const address of addresses) {
      if (signal?.aborted) {
        results.push({ address, status: "failed", error: "已取消" });
        continue;
      }

      let item: GeocodeItem;
      try {
        item = await geocodeOne(address, config);
        // Attach category if provided
        if (addressToCategory?.has(address)) {
          item.category = addressToCategory.get(address);
        }
        // Ensure even successful-path errors are friendly
        if (item.status === "failed" && item.error) {
          item.error = friendlyError(item.error);
        }
      } catch (err) {
        const raw = err instanceof Error ? err.message : "未知错误";
        item = {
          address,
          status: "failed",
          source: config.source,
          error: friendlyError(raw),
        };
      }

      results.push(item);
      onProgress({ completed: results.length, total, latestResult: item });

      if (results.length < total && !signal?.aborted) {
        await sleep(delay);
      }
    }

  return results;
}

// ── Overpass API for area/polygon queries ──

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
];

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  nodes?: number[];
  members?: Array<{ type: "node" | "way"; ref: number; role: string }>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

interface NominatimPlace {
  lat: string;
  lon: string;
  osm_id?: string;
  osm_type?: string;
  boundingbox?: [string, string, string, string];
  display_name: string;
}

export interface NominatimResult {
  lat: string;
  lon: string;
  osm_id?: string;
  osm_type?: string;
  osm_id_num?: number;
  boundingbox?: [string, string, string, string];
  display_name: string;
}

export async function searchNominatim(keyword: string, signal?: AbortSignal): Promise<NominatimResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(keyword)}&format=json&limit=1&addressdetails=1`;
  const res = await fetch(url, {
    mode: "cors",
    headers: {
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    signal: signal || AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = await res.json() as NominatimPlace[];
  if (data.length === 0) return null;
  const first = data[0];
  return {
    lat: first.lat,
    lon: first.lon,
    osm_id: first.osm_id,
    osm_type: first.osm_type,
    osm_id_num: first.osm_id ? parseInt(first.osm_id, 10) : undefined,
    boundingbox: first.boundingbox,
    display_name: first.display_name,
  };
}

export function osmToAreaId(osmType: string, osmId: string): string {
  const id = parseInt(osmId, 10);
  if (osmType === "R") return String(3600000000 + id);
  if (osmType === "W") return String(2400000000 + id);
  if (osmType === "N") return String(1200000000 + id);
  return String(id);
}

function expandBbox(bbox: [string, string, string, string], factor = 0.05): [number, number, number, number] {
  const [s, n, w, e] = bbox.map(Number);
  const latRange = n - s;
  const lonRange = e - w;
  return [
    s - latRange * factor,
    w - lonRange * factor,
    n + latRange * factor,
    e + lonRange * factor,
  ];
}

function buildOverpassBboxQuery(bbox: [number, number, number, number], areaType: AreaQueryType): string {
  const [south, west, north, east] = bbox;
  const filter = getAreaTypeFilter(areaType);
  const limit = areaType === "building" ? 500 : 200;
  return `[out:json][timeout:25];(${filter.replace(/AREA_PLACEHOLDER/g, `${south},${west},${north},${east}`)});out ${limit} geom qt;`;
}

function buildAreaOverpassQuery(areaId: string, areaType: AreaQueryType): string {
  const filter = getAreaTypeFilter(areaType, `area(${areaId})`);
  const limit = areaType === "building" ? 500 : 200;
  return `[out:json][timeout:25];(${filter});out ${limit} geom qt;`;
}

function getAreaTypeFilter(type: AreaQueryType, areaRef = "AREA_PLACEHOLDER"): string {
  switch (type) {
    case "all":
      return [
        `nwr["building"](${areaRef});`,
        `nwr["landuse"~"residential|commercial|retail|industrial|grass|farmland|forest|meadow|orchard|vineyard|cemetery|construction|allotments|farmyard|greenfield|landfill|plant_nursery|recreation_ground|religious|salt_pond|village_green"](${areaRef});`,
        `nwr["leisure"~"park|nature_reserve|pitch|playground|garden|golf_course|stadium|swimming_pool"](${areaRef});`,
        `nwr["amenity"~"university|hospital|school|college|kindergarten|place_of_worship|social_facility|public_building|townhall|library|museum|theatre|cinema|police|fire_station|post_office|courthouse|prison|market|clinic|doctors|pharmacy|nursing_home"](${areaRef});`,
        `nwr["natural"~"wood|water|scrub|heath"](${areaRef});`,
        `nwr["aeroway"~"aerodrome|runway|terminal|apron"](${areaRef});`,
        `nwr["railway"~"station|halt|tram_stop|subway_entrance"](${areaRef});`,
        `nwr["waterway"~"river|stream|canal|drain|ditch"](${areaRef});`,
        `nwr["highway"~"services|rest_area"](${areaRef});`,
      ].join("");
    case "building":
      return `nwr["building"](${areaRef});`;
    case "landuse":
      return [
        `nwr["landuse"~"residential|commercial|retail|industrial|grass|farmland|forest|meadow|orchard|vineyard|cemetery|construction|allotments|farmyard|greenfield|landfill|plant_nursery|recreation_ground|religious|salt_pond|village_green"](${areaRef});`,
        `nwr["leisure"~"park|nature_reserve|pitch|playground|garden|golf_course|stadium|swimming_pool"](${areaRef});`,
        `nwr["amenity"~"university|hospital|school|college|kindergarten|place_of_worship|social_facility|public_building|townhall|library|museum|theatre|cinema|police|fire_station|post_office|courthouse|prison|market|clinic|doctors|pharmacy|nursing_home"](${areaRef});`,
        `nwr["natural"~"wood|water|scrub|heath"](${areaRef});`,
        `nwr["aeroway"~"aerodrome|runway|terminal|apron"](${areaRef});`,
        `nwr["railway"~"station|halt|tram_stop|subway_entrance"](${areaRef});`,
        `nwr["waterway"~"river|stream|canal|drain|ditch"](${areaRef});`,
        `nwr["highway"~"services|rest_area"](${areaRef});`,
      ].join("");
    case "admin":
      return [
        `relation["boundary"="administrative"]["admin_level"="2"](${areaRef});`,
        `relation["boundary"="administrative"]["admin_level"="4"](${areaRef});`,
        `relation["boundary"="administrative"]["admin_level"="6"](${areaRef});`,
        `relation["boundary"="administrative"]["admin_level"="8"](${areaRef});`,
        `way["boundary"="administrative"]["admin_level"="2"](${areaRef});`,
        `way["boundary"="administrative"]["admin_level"="4"](${areaRef});`,
        `way["boundary"="administrative"]["admin_level"="6"](${areaRef});`,
        `way["boundary"="administrative"]["admin_level"="8"](${areaRef});`,
      ].join("");
  }
}

function getPOITypeFilter(type: AreaQueryType): string {
  switch (type) {
    case "poi_restaurant":
      return `node["amenity"~"restaurant|cafe|fast_food"](AREA_PLACEHOLDER);`;
    case "poi_medical":
      return `node["amenity"~"hospital|clinic|doctors|pharmacy"](AREA_PLACEHOLDER);`;
    case "poi_transport":
      return `node["amenity"~"parking|bus_station|ferry_terminal|taxi"](AREA_PLACEHOLDER);`;
    case "poi_shopping":
      return `node["shop"](AREA_PLACEHOLDER);`;
    case "poi_education":
      return `node["amenity"~"school|university|kindergarten|college"](AREA_PLACEHOLDER);`;
    case "poi_sport":
      return `node["leisure"~"pitch|sports_centre|fitness_centre"](AREA_PLACEHOLDER);`;
    case "poi_hotel":
      return `node["tourism"="hotel"](AREA_PLACEHOLDER);`;
    case "poi_all":
      return [
        `node["amenity"](AREA_PLACEHOLDER);`,
        `node["shop"](AREA_PLACEHOLDER);`,
        `node["leisure"](AREA_PLACEHOLDER);`,
        `node["tourism"](AREA_PLACEHOLDER);`,
      ].join("");
    default:
      return `node["name"](AREA_PLACEHOLDER);`;
  }
}

function buildPOIBboxQuery(bbox: [number, number, number, number], poiType: AreaQueryType): string {
  const [south, west, north, east] = bbox;
  const filter = getPOITypeFilter(poiType);
  return `[out:json][timeout:25];(${filter.replace(/AREA_PLACEHOLDER/g, `${south},${west},${north},${east}`)});out body 1000;`;
}

function buildPOIPolygonQuery(latlngs: [number, number][], poiType: AreaQueryType): string {
  const polyStr = latlngs.map(([lat, lng]) => `${lat} ${lng}`).join(" ");
  const filter = getPOITypeFilter(poiType);
  return `[out:json][timeout:25];(${filter.replace(/AREA_PLACEHOLDER/g, `poly:"${polyStr}"`)});out body 1000;`;
}

function buildPOIAreaQuery(areaId: string, poiType: AreaQueryType): string {
  const filter = getPOITypeFilter(poiType);
  return `[out:json][timeout:25];(${filter.replace(/AREA_PLACEHOLDER/g, `area(${areaId})`)});out body 1000;`;
}

function buildBboxOverpassQuery(bbox: [number, number, number, number], type: AreaQueryType): string {
  const [south, west, north, east] = bbox;
  // Overpass bbox format: (south,west,north,east)
  const bboxStr = `${south},${west},${north},${east}`;
  const filter = getAreaTypeFilter(type, bboxStr);
  return `[out:json][timeout:30];(${filter});out geom 500;`;
}

function buildPolygonOverpassQuery(latlngs: [number, number][], type: AreaQueryType): string {
  // Overpass poly format: space-separated "lat lon lat lon ..."
  const polyStr = latlngs.map(([lat, lng]) => `${lat} ${lng}`).join(" ");
  const polyRef = `poly:"${polyStr}"`;
  const filter = getAreaTypeFilter(type, polyRef);
  return `[out:json][timeout:30];(${filter});out geom 500;`;
}

// getAreaPolyFilter removed — unified into getAreaTypeFilter with areaRef param

function stitchWayCoords(element: OverpassElement, allElements: OverpassElement[]): number[][] {
  if (!element.nodes || element.nodes.length < 2) return [];
  const nodeMap = new Map<number, { lat: number; lon: number }>();
  for (const el of allElements) {
    if (el.type === "node" && el.lat !== undefined && el.lon !== undefined) {
      nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
    }
  }
  const coords: number[][] = [];
  for (const nodeId of element.nodes) {
    const node = nodeMap.get(nodeId);
    if (node) coords.push([node.lon, node.lat]);
  }
  return coords;
}

function parseRelationGeometry(element: OverpassElement, allElements: OverpassElement[]): number[][][] {
  const outerWays: OverpassElement[] = [];
  const innerWays: OverpassElement[] = [];
  for (const member of element.members || []) {
    if (member.type !== "way") continue;
    const way = allElements.find(el => el.type === "way" && el.id === member.ref);
    if (!way) continue;
    if (member.role === "outer") outerWays.push(way);
    else innerWays.push(way);
  }
  const rings: number[][][] = [];
  for (const way of outerWays) {
    if (way.geometry && way.geometry.length > 0) {
      rings.push(way.geometry.map(g => [g.lon, g.lat]));
    } else {
      const coords = stitchWayCoords(way, allElements);
      if (coords.length >= 3) rings.push(coords);
    }
  }
  if (rings.length === 0 && element.geometry) {
    rings.push(element.geometry.map(g => [g.lon, g.lat]));
  }
  return rings;
}

function parseOverpassGeometry(element: OverpassElement, allElements?: OverpassElement[]): number[][] {
  if (element.type === "relation") {
    if (!allElements || !element.members) {
      if (element.geometry && element.geometry.length > 0) {
        return element.geometry.map(g => [g.lon, g.lat]);
      }
      return [];
    }
    const rings = parseRelationGeometry(element, allElements);
    return rings.length > 0 ? rings[0] : [];
  }
  if (element.geometry && element.geometry.length > 0) {
    return element.geometry.map(g => [g.lon, g.lat]);
  }
  if (allElements && element.nodes && element.nodes.length > 0) {
    return stitchWayCoords(element, allElements);
  }
  return [];
}

export async function queryOSMArea(
  mode: AreaQueryMode,
  areaType: AreaQueryType,
  params: {
    keyword?: string;
    bbox?: [number, number, number, number];
    polygonLatLngs?: [number, number][];
  },
  signal?: AbortSignal,
): Promise<AreaResult[]> {
  let query: string;

  if (mode === "semantic") {
    if (!params.keyword) throw new Error("请输入关键词");
    const place = await searchNominatim(params.keyword, signal);
    if (!place) {
      throw new Error(`未找到「${params.keyword}」的位置信息，请尝试更具体的名称`);
    }
    if (place.osm_type && place.osm_id) {
      const areaId = osmToAreaId(place.osm_type, place.osm_id);
      query = buildAreaOverpassQuery(areaId, areaType);
    } else if (place.boundingbox) {
      const bbox = expandBbox(place.boundingbox);
      query = buildOverpassBboxQuery(bbox, areaType);
    } else {
      throw new Error(`无法获取「${params.keyword}」的查询范围，请尝试更具体的名称`);
    }
  } else if (mode === "rectangle") {
    if (!params.bbox) throw new Error("缺少边界框参数");
    query = buildBboxOverpassQuery(params.bbox, areaType);
  } else {
    if (!params.polygonLatLngs || params.polygonLatLngs.length < 3) throw new Error("缺少多边形顶点数据");
    query = buildPolygonOverpassQuery(params.polygonLatLngs, areaType);
  }

  const data = await runOverpassQuery(query, signal);
  const results: AreaResult[] = [];
  const allElements = data.elements;

  for (const el of allElements) {
    if (!el.tags?.name) continue;

    let polygons: number[][][];
    if (el.type === "relation") {
      polygons = parseRelationGeometry(el, allElements);
    } else {
      const coords = parseOverpassGeometry(el, allElements);
      if (coords.length < 3) continue;
      polygons = [coords];
    }

    if (polygons.length === 0 || polygons[0].length < 3) continue;

    const tags = el.tags || {};
    const raw =
      tags.landuse ||
      tags.leisure ||
      tags.amenity ||
      tags.building ||
      tags.boundary ||
      "";
    if (raw === "no") continue;

    const { categoryName, color } = getStandardizedTags(tags, areaType);
    const center = elementCenter(polygons[0]);
    results.push({
      name: el.tags.name,
      type: areaType,
      osmId: el.id,
      osmType: el.type,
      tags,
      categoryName,
      color,
      polygon: polygons,
      center,
    });
  }

  return results;
}

async function runOverpassQuery(query: string, signal?: AbortSignal): Promise<OverpassResponse> {
  let lastErr: Error | null = null;
  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const endpoint = OVERPASS_ENDPOINTS[i];
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Geospatial-Studio/1.0 (https://github.com/andyxu12341/Geospatial-Studio)",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: signal || AbortSignal.timeout(60000),
      });
      if (res.status === 400) {
        const text = await res.text().catch(() => "");
        throw new Error(`Overpass 查询语法错误（HTTP 400）: ${text.slice(0, 200)}`);
      }
      if (res.status === 429) {
        lastErr = new Error("Overpass API 请求过于频繁，请稍后再试（HTTP 429）");
        if (i < OVERPASS_ENDPOINTS.length - 1) continue;
        throw lastErr;
      }
      if (!res.ok) throw new Error(`Overpass API 错误: HTTP ${res.status}`);
      return await res.json() as OverpassResponse;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (i < OVERPASS_ENDPOINTS.length - 1) {
        console.warn(`[Overpass] 节点 ${endpoint} 请求失败（${lastErr.message}），尝试下一个节点...`);
      }
    }
  }
  throw lastErr || new Error("Overpass 查询失败");
}

export async function queryOSMPOI(
  mode: AreaQueryMode,
  poiType: AreaQueryType,
  params: {
    keyword?: string;
    bbox?: [number, number, number, number];
    polygonLatLngs?: [number, number][];
  },
  signal?: AbortSignal,
): Promise<POIResult[]> {
  let query: string;

  if (mode === "semantic") {
    if (!params.keyword) throw new Error("请输入关键词");
    const place = await searchNominatim(params.keyword, signal);
    if (!place) throw new Error(`未找到「${params.keyword}」的位置信息，请尝试更具体的名称`);
    if (place.osm_type && place.osm_id) {
      const areaId = osmToAreaId(place.osm_type, place.osm_id);
      query = buildPOIAreaQuery(areaId, poiType);
    } else if (place.boundingbox) {
      const bbox = expandBbox(place.boundingbox, 0.02);
      query = buildPOIBboxQuery(bbox, poiType);
    } else {
      throw new Error(`无法获取「${params.keyword}」的查询范围`);
    }
  } else if (mode === "rectangle") {
    if (!params.bbox) throw new Error("缺少边界框参数");
    query = buildPOIBboxQuery(params.bbox, poiType);
  } else {
    if (!params.polygonLatLngs || params.polygonLatLngs.length < 3) throw new Error("缺少多边形顶点数据");
    query = buildPOIPolygonQuery(params.polygonLatLngs, poiType);
  }

  const data = await runOverpassQuery(query, signal);
  const { categoryName, color } = getStandardizedTags({}, poiType);

  const results: POIResult[] = [];
  for (const el of data.elements) {
    if (el.type !== "node") continue;
    if (el.lat === undefined || el.lon === undefined) continue;
    const name = el.tags?.name || el.tags?.["name:zh"] || el.tags?.ref || `OSM Node ${el.id}`;
    results.push({
      name,
      type: poiType,
      osmId: el.id,
      osmType: "node",
      lat: el.lat,
      lng: el.lon,
      categoryName,
      color,
      tags: el.tags || {},
      source: "osm",
    });
  }
  return results;
}

export async function queryGaodePOI(
  keyword: string,
  poiType: AreaQueryType,
  apiKey: string,
  bbox?: [number, number, number, number],
  polygonLatLngs?: [number, number][],
): Promise<POIResult[]> {
  const { categoryName, color } = getStandardizedTags({}, poiType);
  const POITYPE_MAP: Record<AreaQueryType, string> = {
    poi_restaurant: "050000",
    poi_medical: "090000",
    poi_transport: "150000",
    poi_shopping: "060000",
    poi_education: "140000",
    poi_sport: "080000",
    poi_hotel: "100000",
    poi_all: "010000|020000|030000|040000|050000|060000|070000|080000|090000|100000|110000|120000|130000|140000|150000|160000|170000|180000|190000|200000",
    all: "010000|020000|030000|040000|050000|060000|070000|080000|090000|100000|110000|120000|130000|140000|150000|160000|170000|180000|190000|200000",
    building: "120000",
    landuse: "190000",
    admin: "190100",
  };
  const typeCode = POITYPE_MAP[poiType] || "";

  const isPolygonSearch = !!(polygonLatLngs && polygonLatLngs.length >= 3);
  const isRectSearch = !!bbox;
  const url = new URL(
    (isPolygonSearch || isRectSearch)
      ? "https://restapi.amap.com/v3/place/polygon"
      : "https://restapi.amap.com/v3/place/text"
  );

  if (keyword) url.searchParams.set("keywords", keyword);
  if (typeCode) url.searchParams.set("types", typeCode);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("offset", "50");
  url.searchParams.set("page", "1");
  url.searchParams.set("output", "json");
  url.searchParams.set("extensions", "all");

  if (isPolygonSearch) {
    // Gaode polygon format: lon,lat|lon,lat... (must be GCJ-02)
    // Max 24 vertices, so we need to simplify if it's too complex
    const ring = polygonLatLngs!.map(([lat, lng]) => [lng, lat]);
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      ring.push([...ring[0]]);
    }
    const poly = polygon([ring]);
    let simplified = poly;
    let tolerance = 0.0001;
    while (simplified.geometry.coordinates[0].length > 24 && tolerance < 1) {
      simplified = simplify(poly, { tolerance, highQuality: true });
      tolerance *= 2;
    }
    
    const gcjPoints = simplified.geometry.coordinates[0].map(([lng, lat]) => {
      const [gcjLng, gcjLat] = wgs84togcj02(lng, lat);
      return `${gcjLng.toFixed(6)},${gcjLat.toFixed(6)}`;
    });
    // Ensure closed polygon (Gaode requirement: "首尾坐标对需相同")
    if (gcjPoints.length > 0 && gcjPoints[0] !== gcjPoints[gcjPoints.length - 1]) {
      gcjPoints.push(gcjPoints[0]);
    }
    url.searchParams.set("polygon", gcjPoints.join("|"));
  } else if (isRectSearch) {
    const [gcjSouth, gcjWest, gcjNorth, gcjEast] = transformBbox(bbox!, wgs84togcj02);
    // Gaode rectangle: top-left, bottom-right (lon,lat|lon,lat)
    const rect = `${gcjWest.toFixed(6)},${gcjNorth.toFixed(6)}|${gcjEast.toFixed(6)},${gcjSouth.toFixed(6)}`;
    url.searchParams.set("polygon", rect);
  }

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`高德 POI 查询失败: HTTP ${res.status}`);
  const data = await res.json() as {
    status: string;
    info: string;
    infocode: string;
    count: string;
    pois?: Array<{
      name: string;
      location: string;
      address?: string;
      type?: string;
    }>;
  };

  if (data.status !== "1") {
    throw new Error(`高德 POI 查询失败: ${data.info} (${data.infocode})`);
  }
  if (!data.pois?.length) {
    throw new Error(`高德 POI 未找到结果（${data.count || 0} 条），请尝试其他关键词或扩大搜索范围`);
  }

  return data.pois
    .filter(p => p.location)
    .map(p => {
      const [gcjLng, gcjLat] = p.location.split(",").map(Number);
      const [lng, lat] = gcj02towgs84(gcjLng, gcjLat);
      
      // Extract the most specific type from Gaode's type string (e.g., "餐饮服务;中餐厅;特色/地方风味餐厅")
      let specificType = categoryName;
      if (poiType === "poi_all" && p.type) {
        const typeParts = p.type.split(";");
        specificType = typeParts[typeParts.length - 1] || categoryName;
      }

      return {
        name: p.name,
        type: poiType,
        lat,
        lng,
        categoryName: specificType,
        color,
        tags: {
          address: p.address || "",
          type: p.type || "",
        },
        address: p.address,
        source: "gaode" as const,
      };
    });
}

export async function queryBaiduPOI(
  keyword: string,
  poiType: AreaQueryType,
  apiKey: string,
): Promise<POIResult[]> {
  const { categoryName, color } = getStandardizedTags({}, poiType);
  const POITYPE_MAP: Record<AreaQueryType, string> = {
    poi_restaurant: "餐饮",
    poi_medical: "医疗",
    poi_transport: "交通设施",
    poi_shopping: "购物",
    poi_education: "教育培训",
    poi_sport: "运动健身",
    poi_hotel: "酒店",
    poi_all: "",
    all: "",
    building: "",
    landuse: "",
    admin: "",
  };
  const typeCode = POITYPE_MAP[poiType] || "";

  const url = new URL("https://api.map.baidu.com/place/v3/search");
  url.searchParams.set("query", typeCode ? `${typeCode}${keyword}` : keyword);
  url.searchParams.set("tag", typeCode);
  url.searchParams.set("ak", apiKey);
  url.searchParams.set("output", "json");
  url.searchParams.set("scope", "2");
  url.searchParams.set("ret_coordtype", "gcj02ll");
  url.searchParams.set("page_size", "50");
  url.searchParams.set("page_num", "0");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`百度 POI 查询失败: HTTP ${res.status}`);
  const data = await res.json() as {
    status: number;
    message: string;
    results?: Array<{
      name: string;
      location: { lat: number; lng: number };
      address?: string;
      street_id?: string;
      detail_info?: {
        tag?: string;
      };
    }>;
  };
  if (data.status !== 0 || !data.results?.length) {
    throw new Error(data.message || "百度 POI 未找到结果");
  }

  return data.results
    .filter(r => r.location && r.location.lat > 0 && r.location.lng > 0)
    .map(r => {
      const [lng, lat] = bd09towgs84(r.location.lng, r.location.lat);
      
      let specificType = categoryName;
      if (poiType === "poi_all" && r.detail_info?.tag) {
        const typeParts = r.detail_info.tag.split(";");
        specificType = typeParts[typeParts.length - 1] || categoryName;
      }

      return {
        name: r.name,
        type: poiType,
        lat,
        lng,
        categoryName: specificType,
        color,
        tags: { 
          address: r.address || "",
          type: r.detail_info?.tag || "",
        },
        address: r.address,
        source: "baidu" as const,
      };
    });
}

function elementCenter(coords: number[][]): { lat: number; lng: number } {
  if (coords.length === 0) return { lat: 0, lng: 0 };
  const sum = coords.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0]);
  return {
    lng: sum[0] / coords.length,
    lat: sum[1] / coords.length,
  };
}
