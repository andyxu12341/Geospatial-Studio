import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MapPin, 
  Info, 
  Layers, 
  MousePointer2 
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type AreaQueryType,
  AREA_TYPE_LABELS,
  type MapSource,
} from "@/utils/geocoding";
import { useSpatialQueryStore, type QueryCategory, type DataSource } from "@/store/useSpatialQueryStore";

interface AreaQueryPanelProps {
  mapSource: MapSource;
}

const POLYGON_TYPES: AreaQueryType[] = ["all", "building", "landuse", "admin"];
const POI_TYPES: AreaQueryType[] = [
  "poi_restaurant", "poi_medical", "poi_transport",
  "poi_shopping", "poi_education", "poi_sport",
  "poi_hotel", "poi_all",
];

function TypeButton({
  type, active, onClick, disabled, tooltip,
}: {
  type: AreaQueryType;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={tooltip}
      className={`rounded-md border px-3 py-2 text-xs transition-all whitespace-nowrap min-w-[70px] flex items-center justify-center ${
        disabled
          ? "border-border bg-muted/40 text-muted-foreground cursor-not-allowed opacity-60"
          : active
            ? "border-primary bg-primary/10 text-primary font-medium"
            : "border-border hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      {AREA_TYPE_LABELS[type]}
    </button>
  );
}

export function AreaQueryPanel({ mapSource }: AreaQueryPanelProps) {
  const { t } = useTranslation();
  
  const {
    dataSource, setDataSource,
    areaType, setAreaType,
    queryCategory, setQueryCategory,
  } = useSpatialQueryStore();

  // Sync prop mapSource to store dataSource
  useEffect(() => {
    if (mapSource !== dataSource) {
      setDataSource(mapSource as DataSource);
    }
  }, [mapSource, dataSource, setDataSource]);

  const isOsm = dataSource === "osm";
  
  // Effective area type based on category
  const effectiveAreaType = useMemo(() => {
    if (queryCategory === "poi") {
      return areaType.startsWith("poi_") ? areaType : "poi_all";
    } else {
      return !areaType.startsWith("poi_") ? areaType : "building";
    }
  }, [queryCategory, areaType]);

  // Ensure areaType is valid for the current category
  useEffect(() => {
    if (queryCategory === "poi" && !areaType.startsWith("poi_")) {
      setAreaType("poi_all");
    } else if (queryCategory === "area" && areaType.startsWith("poi_")) {
      setAreaType("building");
    }
  }, [queryCategory, areaType, setAreaType]);

  return (
    <Card className="overflow-hidden border-primary/20 shadow-sm">
      <CardHeader className="pb-0 pt-4 px-4">
        <Tabs value={queryCategory} onValueChange={(v) => setQueryCategory(v as QueryCategory)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-10">
            <TabsTrigger value="poi" className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4" />
              {t("areaQuery.tabPoi")}
            </TabsTrigger>
            <TabsTrigger value="area" className="flex items-center gap-2 text-sm">
              <Layers className="h-4 w-4" />
              {t("areaQuery.tabArea")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      
      <CardContent className="space-y-5 pt-6 px-4">
        <AnimatePresence mode="wait">
          {queryCategory === "poi" ? (
            <motion.div
              key="poi-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              <div>
                <label className="mb-2.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("areaQuery.poiType")}
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {POI_TYPES.map(type => (
                    <TypeButton
                      key={type}
                      type={type}
                      active={effectiveAreaType === type}
                      onClick={() => setAreaType(type)}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="area-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3.5 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
                <div className="flex items-center gap-1.5 font-bold mb-1.5">
                  <Info className="h-4 w-4" />
                  {t("areaQuery.osmDataset")}
                </div>
                <p className="opacity-90 leading-relaxed">{t("areaQuery.osmDatasetHint")}</p>
              </div>

              <div>
                <label className="mb-2.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("areaQuery.areaType")}
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {POLYGON_TYPES.map(type => (
                    <TypeButton
                      key={type}
                      type={type}
                      active={effectiveAreaType === type}
                      onClick={() => setAreaType(type)}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
