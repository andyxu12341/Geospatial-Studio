import { GeocodeItem, GeocodingConfig, POIResult, AreaQueryType, BatchProgress } from "./types";
import { geocodeGaode, queryGaodePOI } from "./amap";
import { geocodeBaidu, queryBaiduPOI } from "./baidu";
import { geocodeOSM, runOverpassQuery, buildOverpassBboxQuery, buildAreaOverpassQuery, buildPolygonOverpassQuery, buildPOIBboxQuery, buildPOIPolygonQuery, parseOverpassElements } from "./osm";
import { cacheGet, cacheSet, friendlyError, sleep } from "./base";

const DELAY_MS: Record<string, number> = {
  gaode: 100,
  baidu: 100,
  osm: 1000, // Nominatim requires at least 1s between requests
};

export interface GeocodingService {
  geocode(address: string, config: GeocodingConfig): Promise<GeocodeItem>;
  queryPOI(
    keyword: string,
    poiType: AreaQueryType,
    config: GeocodingConfig,
    bbox?: [number, number, number, number],
    polygonLatLngs?: [number, number][]
  ): Promise<POIResult[]>;
}

class GaodeService implements GeocodingService {
  async geocode(address: string, config: GeocodingConfig): Promise<GeocodeItem> {
    if (!config.gaodeKey) throw new Error("缺少高德 API Key");
    return geocodeGaode(address, config.gaodeKey, config.regionFilter);
  }
  async queryPOI(
    keyword: string,
    poiType: AreaQueryType,
    config: GeocodingConfig,
    bbox?: [number, number, number, number],
    polygonLatLngs?: [number, number][]
  ): Promise<POIResult[]> {
    if (!config.gaodeKey) throw new Error("缺少高德 API Key");
    return queryGaodePOI(keyword, poiType, config.gaodeKey, bbox, polygonLatLngs);
  }
}

class BaiduService implements GeocodingService {
  async geocode(address: string, config: GeocodingConfig): Promise<GeocodeItem> {
    if (!config.baiduKey) throw new Error("缺少百度 API Key");
    return geocodeBaidu(address, config.baiduKey, config.regionFilter);
  }
  async queryPOI(
    keyword: string,
    poiType: AreaQueryType,
    config: GeocodingConfig,
    bbox?: [number, number, number, number],
    polygonLatLngs?: [number, number][]
  ): Promise<POIResult[]> {
    if (!config.baiduKey) throw new Error("缺少百度 API Key");
    return queryBaiduPOI(keyword, poiType, config.baiduKey, bbox, polygonLatLngs);
  }
}

class OSMService implements GeocodingService {
  async geocode(address: string, config: GeocodingConfig): Promise<GeocodeItem> {
    return geocodeOSM(address, config.regionFilter);
  }
  async queryPOI(
    keyword: string,
    poiType: AreaQueryType,
    config: GeocodingConfig,
    bbox?: [number, number, number, number],
    polygonLatLngs?: [number, number][]
  ): Promise<POIResult[]> {
    let query = "";
    if (polygonLatLngs && polygonLatLngs.length >= 3) {
      query = buildPOIPolygonQuery(polygonLatLngs, poiType);
    } else if (bbox) {
      query = buildPOIBboxQuery(bbox, poiType);
    } else {
      throw new Error("OSM POI 查询需要指定范围（矩形或多边形）");
    }

    const data = await runOverpassQuery(query);
    return parseOverpassElements(data, poiType) as POIResult[];
  }
}

const services: Record<string, GeocodingService> = {
  gaode: new GaodeService(),
  baidu: new BaiduService(),
  osm: new OSMService(),
};

export async function geocodeAddress(address: string, config: GeocodingConfig): Promise<GeocodeItem> {
  const cached = cacheGet(address, config.source, config.regionFilter);
  if (cached) return cached;

  const service = services[config.source];
  if (!service) throw new Error(`不支持的地图源: ${config.source}`);

  const result = await service.geocode(address, config);
  if (result.status === "success") {
    cacheSet(address, config.source, result, config.regionFilter);
  } else if (result.error) {
    result.error = friendlyError(result.error);
  }
  return result;
}

export async function queryPOI(
  keyword: string,
  poiType: AreaQueryType,
  config: GeocodingConfig,
  bbox?: [number, number, number, number],
  polygonLatLngs?: [number, number][]
): Promise<POIResult[]> {
  const service = services[config.source];
  if (!service) throw new Error(`不支持的地图源: ${config.source}`);
  return service.queryPOI(keyword, poiType, config, bbox, polygonLatLngs);
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
      item = await geocodeAddress(address, config);
      // Attach category if provided
      if (addressToCategory?.has(address)) {
        item.category = addressToCategory.get(address);
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
