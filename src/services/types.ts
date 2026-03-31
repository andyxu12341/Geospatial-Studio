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

export type AreaQueryMode = "semantic" | "rectangle" | "polygon";

export interface GeocodingConfig {
  source: MapSource;
  gaodeKey?: string;
  baiduKey?: string;
  areaQueryType?: AreaQueryType;
  regionFilter?: string;
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

export interface BatchProgress {
  completed: number;
  total: number;
  latestResult?: GeocodeItem;
}
