import { GeocodeItem, POIResult, AreaQueryType } from "./types";
import { gcj02towgs84, wgs84togcj02, transformBbox } from "../utils/coordTransform";
import simplify from "@turf/simplify";
import { polygon } from "@turf/helpers";
import { LANDUSE_STANDARD_MAP, POI_COLORS } from "./constants";

function getTimeoutSignal(ms: number) {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (AbortSignal as any).timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function searchGaodePOI(
  keyword: string,
  apiKey: string,
  city?: string,
): Promise<Array<{ name: string; location: string; address: string; type: string }>> {
  const url = new URL("https://restapi.amap.com/v3/place/text");
  url.searchParams.set("keywords", keyword);
  url.searchParams.set("key", apiKey);
  if (city && city !== "全国") {
    url.searchParams.set("city", city);
  }
  url.searchParams.set("offset", "5");
  url.searchParams.set("page", "1");
  url.searchParams.set("extensions", "all");
  url.searchParams.set("output", "json");

  console.log(`[Gaode Geocode] POI Search: ${keyword} (city: ${city || "全国"})`);
  const res = await fetch(url.toString(), { signal: getTimeoutSignal(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;

  if (data.status !== "1") {
    throw new Error(`高德 API 错误: ${data.info} (${data.infocode})`);
  }

  if (!data.pois?.length) return [];

  return data.pois
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any) => p.location)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => ({
      name: p.name,
      location: p.location,
      address: p.address ?? "",
      type: p.type ?? "",
    }));
}

async function geocodeGaodeFallback(address: string, apiKey: string, city?: string): Promise<GeocodeItem | null> {
  let url = `https://restapi.amap.com/v3/geocode/geo?key=${encodeURIComponent(apiKey)}&address=${encodeURIComponent(address)}&output=json`;
  if (city && city !== "全国") url += `&city=${encodeURIComponent(city)}`;
  
  console.log(`[Gaode Geocode] Fallback Search: ${address} (city: ${city || "全国"})`);
  const res = await fetch(url, { signal: getTimeoutSignal(8000) });
  if (!res.ok) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;
  if (data.status !== "1") {
    throw new Error(`高德 API 错误: ${data.info} (${data.infocode})`);
  }
  if (!data.geocodes?.length) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const first = data.geocodes.find((g: any) => g.location);
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
    source: "gaode",
    status: "success",
    warning: isGeneric ? "已定位到区域中心" : undefined,
  };
}

export async function geocodeGaode(address: string, apiKey: string, city?: string): Promise<GeocodeItem> {
  try {
    // 1. Try POI search first (often better for specific landmarks)
    let pois: Array<{ name: string; location: string; address: string; type: string }> = [];
    try {
      pois = await searchGaodePOI(address, apiKey, city);
    } catch (err) {
      console.warn("[Gaode Geocode] POI Search failed:", err);
      // If it's a key error, we might want to fail early, but let's try fallback anyway
    }

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
        source: "gaode",
        status: "success",
      };
    }

    // 2. Fallback to standard Geocoding API
    const geoResult = await geocodeGaodeFallback(address, apiKey, city);
    if (geoResult) return geoResult;

    return { address, status: "failed", source: "gaode", error: "未找到有效坐标" };

  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    return { address, status: "failed", source: "gaode", error: msg };
  }
}

export async function queryGaodePOI(
  keyword: string,
  poiType: AreaQueryType,
  apiKey: string,
  bbox?: [number, number, number, number],
  polygonLatLngs?: [number, number][],
): Promise<POIResult[]> {
  const POITYPE_MAP: Record<string, string> = {
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
  const color = POI_COLORS[poiType] || "#9B59B6";

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

  // For semantic search (place/text), set city to "全国" if not specified to avoid city-specific restrictions
  if (!isPolygonSearch && !isRectSearch) {
    url.searchParams.set("city", "全国");
    url.searchParams.set("citylimit", "false");
  }

  url.searchParams.set("offset", "20"); // Safer offset
  url.searchParams.set("page", "1");
  url.searchParams.set("output", "json");
  url.searchParams.set("extensions", "all");

  if (isPolygonSearch) {
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
    if (gcjPoints.length > 0 && gcjPoints[0] !== gcjPoints[gcjPoints.length - 1]) {
      gcjPoints.push(gcjPoints[0]);
    }
    url.searchParams.set("polygon", gcjPoints.join("|"));
  } else if (isRectSearch) {
    const [gcjSouth, gcjWest, gcjNorth, gcjEast] = transformBbox(bbox!, wgs84togcj02);
    // Gaode polygon search for rectangle needs 4 points to be safe.
    const rect = [
      `${gcjWest.toFixed(6)},${gcjNorth.toFixed(6)}`,
      `${gcjEast.toFixed(6)},${gcjNorth.toFixed(6)}`,
      `${gcjEast.toFixed(6)},${gcjSouth.toFixed(6)}`,
      `${gcjWest.toFixed(6)},${gcjSouth.toFixed(6)}`,
      `${gcjWest.toFixed(6)},${gcjNorth.toFixed(6)}`
    ].join("|");
    url.searchParams.set("polygon", rect);
  }

  url.searchParams.set("offset", "20"); // Safer offset
  url.searchParams.set("page", "1");
  url.searchParams.set("extensions", "all");
  url.searchParams.set("output", "json");

  console.log(`[Gaode POI] Querying: ${url.toString().replace(apiKey, "HIDDEN")}`);

  const res = await fetch(url.toString(), { signal: getTimeoutSignal(15000) });
  if (!res.ok) throw new Error(`高德 POI 查询失败: HTTP ${res.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;

  if (data.status !== "1") {
    throw new Error(`高德 POI 查询失败: ${data.info} (${data.infocode})`);
  }
  if (!data.pois?.length) {
    throw new Error(`高德 POI 未找到结果（${data.count || 0} 条），请尝试其他关键词或扩大搜索范围`);
  }

  return data.pois
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any) => p.location)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => {
      const [gcjLng, gcjLat] = p.location.split(",").map(Number);
      const [lng, lat] = gcj02towgs84(gcjLng, gcjLat);
      
      let specificType = "POI";
      if (p.type) {
        const typeParts = p.type.split(";");
        specificType = typeParts[typeParts.length - 1] || "POI";
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
