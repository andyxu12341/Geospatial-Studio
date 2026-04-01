import { useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useOverpassQuery, type SpatialResult } from "@/hooks/useOverpassQuery";
import { useSpatialQueryStore } from "@/store/useSpatialQueryStore";
import { toast } from "sonner";
import type { GeoMapHandle } from "@/components/GeoMap";

interface UseSpatialQueryProps {
  geoMapRef: React.RefObject<GeoMapHandle>;
  gaodeKey: string;
  baiduKey: string;
  onResults: (results: SpatialResult[]) => void;
}

export function useSpatialQuery({ geoMapRef, gaodeKey, baiduKey, onResults }: UseSpatialQueryProps) {
  const { t } = useTranslation();
  const { fetchSpatial, error: queryError } = useOverpassQuery();
  
  const {
    dataSource,
    queryMode,
    areaType,
    queryCategory,
    keyword,
    setIsLoading,
    setResults
  } = useSpatialQueryStore();

  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveAreaType = useMemo(() => {
    if (queryCategory === "poi") {
      return areaType.startsWith("poi_") ? areaType : "poi_all";
    } else {
      return !areaType.startsWith("poi_") ? areaType : "building";
    }
  }, [queryCategory, areaType]);

  const handleQuery = async () => {
    if (queryCategory === "poi" && queryMode === "semantic" && !keyword.trim()) {
      toast.error(t("toast.noKeyword"));
      return;
    }

    try {
      if (debounceRef.current) return;
      debounceRef.current = setTimeout(() => { debounceRef.current = null; }, 800);

      setIsLoading(true);
      setError(null);
      onResults([]); 
      setResults([]);

      const isAreaQuery = queryCategory === "area";
      const effectiveDataSource = isAreaQuery ? "osm" : dataSource;
      const apiKey = effectiveDataSource === "gaode" ? gaodeKey.trim() : effectiveDataSource === "baidu" ? baiduKey.trim() : undefined;
      const finalKeyword = keyword.trim();

      if (queryMode === "rectangle") {
        geoMapRef.current?.setDrawCallbacks(async (bounds) => {
          const bbox: [number, number, number, number] = [
            bounds.getSouth(), bounds.getWest(),
            bounds.getNorth(), bounds.getEast(),
          ];
          try {
            const results = await fetchSpatial({ mode: "rectangle", areaType: effectiveAreaType, dataSource: effectiveDataSource, bbox, apiKey });
            onResults(results);
            setResults(results);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setIsLoading(false);
            geoMapRef.current?.setDrawMode("none");
          }
        }, null);
        geoMapRef.current?.setDrawMode("rectangle");
        toast.info(t("areaQuery.startDrawRect"));
        return;
      }

      if (queryMode === "polygon") {
        geoMapRef.current?.setDrawCallbacks(null, async (latlngs) => {
          const polygonLatLngs: [number, number][] = latlngs.map(l => [l.lat, l.lng]);
          try {
            const results = await fetchSpatial({ mode: "polygon", areaType: effectiveAreaType, dataSource: effectiveDataSource, polygonLatLngs, apiKey });
            onResults(results);
            setResults(results);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setIsLoading(false);
            geoMapRef.current?.setDrawMode("none");
          }
        });
        geoMapRef.current?.setDrawMode("polygon");
        toast.info(t("areaQuery.startDrawPoly"));
        return;
      }

      const results = await fetchSpatial({ 
        mode: "semantic", 
        areaType: effectiveAreaType, 
        dataSource: effectiveDataSource, 
        keyword: finalKeyword, 
        apiKey 
      });
      onResults(results);
      setResults(results);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    }
  };

  return {
    handleQuery,
    error: error || queryError
  };
}
