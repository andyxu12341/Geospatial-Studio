import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type MapSource } from "@/utils/geocoding";

interface RegionFilterCardProps {
  mapSource: MapSource;
  regionFilter: string;
  onRegionFilterChange: (val: string) => void;
}

export function RegionFilterCard({
  mapSource,
  regionFilter,
  onRegionFilterChange,
}: RegionFilterCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Globe className="h-4 w-4" /> {t("settings.regionFilter")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="region-filter" className="text-xs text-muted-foreground">
            {mapSource === "osm" ? t("settings.regionFilterOsm") : t("settings.regionFilterOther")}
          </Label>
          <Input
            id="region-filter"
            placeholder={mapSource === "osm" ? "China, Beijing" : "山东 或 济南市"}
            value={regionFilter}
            onChange={(e) => onRegionFilterChange(e.target.value)}
            className="h-8 text-sm"
          />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {mapSource === "osm" ? t("settings.regionFilterHintOsm") : t("settings.regionFilterHintOther")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
