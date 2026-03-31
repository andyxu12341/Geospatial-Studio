import { GeocodeItem, POIResult, AreaQueryType } from "./types";
import { bd09towgs84, wgs84tobd09, transformBbox } from "../utils/coordTransform";
import { jsonp } from "./base";
import { POI_COLORS } from "./constants";

export async function geocodeBaidu(address: string, apiKey: string, city?: string): Promise<GeocodeItem> {
  try {
    let url = `https://api.map.baidu.com/geocoding/v3/?output=json&ak=${encodeURIComponent(apiKey)}&address=${encodeURIComponent(address)}`;
    if (city) url += `&city=${encodeURIComponent(city)}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await jsonp<any>(url);
    if (data.status !== 0 || !data.result?.location) {
      return { address, status: "failed", source: "baidu", error: data.message || "未找到有效坐标" };
    }
    const { lng: bdLng, lat: bdLat } = data.result.location;
    const [wgsLng, wgsLat] = bd09towgs84(bdLng, bdLat);
    const lvl = data.result.level ?? "";
    const genericLevels = ["城市", "省", "国家"];
    const isGeneric = genericLevels.includes(lvl);

    return {
      address,
      lng: wgsLng.toFixed(6),
      lat: wgsLat.toFixed(6),
      formattedAddress: data.result.formatted_address ?? address,
      source: "baidu",
      status: "success",
      warning: isGeneric ? "已定位到区域中心" : undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "未知错误";
    return { address, status: "failed", source: "baidu", error: msg };
  }
}

export async function queryBaiduPOI(
  keyword: string,
  poiType: AreaQueryType,
  apiKey: string,
  bbox?: [number, number, number, number],
  polygonLatLngs?: [number, number][],
): Promise<POIResult[]> {
  const POITYPE_MAP: Record<string, string> = {
    poi_restaurant: "美食",
    poi_medical: "医疗",
    poi_transport: "交通设施",
    poi_shopping: "购物",
    poi_education: "教育培训",
    poi_sport: "运动健身",
    poi_hotel: "酒店",
    poi_all: "美食|医疗|交通设施|购物|教育培训|运动健身|酒店|生活服务|旅游景点|休闲娱乐",
    all: "美食|医疗|交通设施|购物|教育培训|运动健身|酒店|生活服务|旅游景点|休闲娱乐",
    building: "房地产",
    landuse: "生活服务",
    admin: "行政地标",
  };
  const typeCode = POITYPE_MAP[poiType] || "";
  const color = POI_COLORS[poiType] || "#9B59B6";

  const isPolygonSearch = !!(polygonLatLngs && polygonLatLngs.length >= 3);
  const isRectSearch = !!bbox;
  const url = new URL("https://api.map.baidu.com/place/v2/search");

  url.searchParams.set("ak", apiKey);
  url.searchParams.set("output", "json");
  url.searchParams.set("page_size", "20");
  url.searchParams.set("page_num", "0");
  url.searchParams.set("scope", "2");

  if (keyword) url.searchParams.set("query", keyword);
  if (typeCode) url.searchParams.set("tag", typeCode);

  if (isPolygonSearch) {
    const bdPoints = polygonLatLngs!.map(([lat, lng]) => {
      const [bdLng, bdLat] = wgs84tobd09(lng, lat);
      return `${bdLat.toFixed(6)},${bdLng.toFixed(6)}`;
    });
    url.searchParams.set("region", "全国");
    url.searchParams.set("bounds", bdPoints.join(","));
  } else if (isRectSearch) {
    const [bdSouth, bdWest, bdNorth, bdEast] = transformBbox(bbox!, wgs84tobd09);
    const rect = `${bdSouth.toFixed(6)},${bdWest.toFixed(6)},${bdNorth.toFixed(6)},${bdEast.toFixed(6)}`;
    url.searchParams.set("bounds", rect);
  } else {
    url.searchParams.set("region", "全国");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await jsonp<any>(url.toString());
  if (data.status !== 0) {
    throw new Error(`百度 POI 查询失败: ${data.message} (${data.status})`);
  }
  if (!data.results?.length) {
    throw new Error(`百度 POI 未找到结果（${data.total || 0} 条），请尝试其他关键词或扩大搜索范围`);
  }

  return data.results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any) => p.location)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => {
      const { lng: bdLng, lat: bdLat } = p.location;
      const [lng, lat] = bd09towgs84(bdLng, bdLat);
      
      return {
        name: p.name,
        type: poiType,
        lat,
        lng,
        categoryName: p.tag || "POI",
        color,
        tags: {
          address: p.address || "",
          uid: p.uid || "",
          province: p.province || "",
          city: p.city || "",
          area: p.area || "",
          street_id: p.street_id || "",
        },
        address: p.address,
        source: "baidu" as const,
      };
    });
}
