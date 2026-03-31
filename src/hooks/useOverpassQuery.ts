import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  queryPOI,
  runOverpassQuery,
  buildOverpassBboxQuery,
  buildAreaOverpassQuery,
  buildPolygonOverpassQuery,
  buildPOIBboxQuery,
  buildPOIPolygonQuery,
  buildPOIByKeywordQuery,
  parseOverpassElements,
  type AreaQueryType,
  type AreaQueryMode,
  type AreaResult,
  type POIResult,
} from "@/utils/geocoding";

export type SpatialResult = {
  polygon?: AreaResult;
  poi?: POIResult;
};

export interface UseOverpassQueryReturn {
  results: SpatialResult[];
  isLoading: boolean;
  error: string | null;
  fetchSpatial: (params: {
    mode: AreaQueryMode;
    areaType: AreaQueryType;
    dataSource: "osm" | "gaode" | "baidu";
    keyword?: string;
    bbox?: [number, number, number, number];
    polygonLatLngs?: [number, number][];
    apiKey?: string;
  }) => Promise<SpatialResult[]>;
  reset: () => void;
}

function normalizeError(err: unknown): string {
  if (!(err instanceof Error)) return "查询失败";
  const m = err.message;
  if (/504|Gateway|timeout|Timeout/i.test(m)) return "服务器响应超时，请缩小查询范围或稍后再试";
  if (/429/i.test(m)) return "请求过于频繁，请稍后再试";
  return m;
}

function wrapPolygon(results: AreaResult[]): SpatialResult[] {
  return results.map(r => ({ polygon: r }));
}

function wrapPOI(results: POIResult[]): SpatialResult[] {
  return results.map(r => ({ poi: r }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function performSpatialQuery(params: any): Promise<SpatialResult[]> {
  const { mode, areaType, dataSource, keyword, bbox, polygonLatLngs, apiKey } = params;
  const isPOI = areaType.startsWith("poi_") || areaType === "poi_all";

  if (!isPOI) {
    // Area Query (OSM only for now)
    let query = "";
    if (mode === "semantic" && keyword) {
      query = buildAreaOverpassQuery(keyword, areaType);
    } else if (mode === "rectangle" && bbox) {
      query = buildOverpassBboxQuery(bbox, areaType);
    } else if (mode === "polygon" && polygonLatLngs) {
      query = buildPolygonOverpassQuery(polygonLatLngs, areaType);
    } else {
      throw new Error("面域查询参数不足");
    }
    const data = await runOverpassQuery(query);
    
    let areaResults: AreaResult[] = [];
    if (data.elements && data.elements.length > 500) {
      // Use Web Worker for large datasets
      areaResults = await new Promise((resolve, reject) => {
        const worker = new Worker(new URL("../services/osmWorker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (e) => {
          if (e.data.error) reject(new Error(e.data.error));
          else resolve(e.data.results);
          worker.terminate();
        };
        worker.onerror = (err) => {
          reject(err);
          worker.terminate();
        };
        worker.postMessage({ data, queryType: areaType });
      });
    } else {
      areaResults = parseOverpassElements(data, areaType) as AreaResult[];
    }

    return wrapPolygon(areaResults);
  } else {
    // POI Query
    if (dataSource === "osm") {
      let query = "";
      if (mode === "semantic" && keyword) {
        query = buildPOIByKeywordQuery(keyword, areaType);
      } else if (polygonLatLngs && polygonLatLngs.length >= 3) {
        query = buildPOIPolygonQuery(polygonLatLngs, areaType);
      } else if (bbox) {
        query = buildPOIBboxQuery(bbox, areaType);
      } else {
        throw new Error("OSM POI 查询需要指定范围或关键词");
      }
      const data = await runOverpassQuery(query);
      
      let poiResults: POIResult[] = [];
      if (data.elements && data.elements.length > 500) {
        poiResults = await new Promise((resolve, reject) => {
          const worker = new Worker(new URL("../services/osmWorker.ts", import.meta.url), { type: "module" });
          worker.onmessage = (e) => {
            if (e.data.error) reject(new Error(e.data.error));
            else resolve(e.data.results);
            worker.terminate();
          };
          worker.onerror = (err) => {
            reject(err);
            worker.terminate();
          };
          worker.postMessage({ data, queryType: areaType });
        });
      } else {
        poiResults = parseOverpassElements(data, areaType) as POIResult[];
      }
      return wrapPOI(poiResults);
    } else {
      const poiResults = await queryPOI(keyword || "", areaType, {
        source: dataSource,
        gaodeKey: apiKey,
        baiduKey: apiKey,
      }, bbox, polygonLatLngs);
      return wrapPOI(poiResults);
    }
  }
}

export function useOverpassQuery(): UseOverpassQueryReturn {
  const queryClient = useQueryClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [queryParams, setQueryParams] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: results = [], isLoading, isError, error: queryError } = useQuery({
    queryKey: ["spatialQuery", queryParams],
    queryFn: () => performSpatialQuery(queryParams),
    enabled: !!queryParams,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchSpatial = useCallback(async (params: any) => {
    setError(null);
    setQueryParams(params);
    
    try {
      // Use fetchQuery to ensure we return the results directly to the caller
      const data = await queryClient.fetchQuery({
        queryKey: ["spatialQuery", params],
        queryFn: () => performSpatialQuery(params),
        staleTime: 5 * 60 * 1000,
      });
      return data;
    } catch (err) {
      const msg = normalizeError(err);
      setError(msg);
      throw err;
    }
  }, [queryClient]);

  const reset = useCallback(() => {
    setError(null);
    setQueryParams(null);
  }, []);

  const displayError = error || (isError ? normalizeError(queryError) : null);

  return { 
    results: results as SpatialResult[], 
    isLoading, 
    error: displayError, 
    fetchSpatial, 
    reset 
  };
}
