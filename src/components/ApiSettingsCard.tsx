import { useTranslation } from "react-i18next";
import { Key, Eye, EyeOff, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { type MapSource } from "@/utils/geocoding";

interface ApiSettingsCardProps {
  mapSource: MapSource;
  onMapSourceChange: (v: MapSource) => void;
  gaodeKey: string;
  onGaodeKeyChange: (v: string) => void;
  baiduKey: string;
  onBaiduKeyChange: (v: string) => void;
  showGaode: boolean;
  onShowGaodeChange: (v: boolean) => void;
  showBaidu: boolean;
  onShowBaiduChange: (v: boolean) => void;
  disabled?: boolean;
  disabledMessage?: string;
}

export function ApiSettingsCard({
  mapSource, onMapSourceChange,
  gaodeKey, onGaodeKeyChange,
  baiduKey, onBaiduKeyChange,
  showGaode, onShowGaodeChange,
  showBaidu, onShowBaiduChange,
  disabled = false,
  disabledMessage,
}: ApiSettingsCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Key className="h-4 w-4" /> {t("settings.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className={`space-y-3 transition-opacity duration-300 ${disabled ? "opacity-40 pointer-events-none select-none" : ""}`}>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("settings.mapSource")}
          </label>
          <Select value={mapSource} onValueChange={(v) => onMapSourceChange(v as MapSource)} disabled={disabled}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gaode">{t("settings.gaode")}</SelectItem>
              <SelectItem value="baidu">{t("settings.baidu")}</SelectItem>
              <SelectItem value="osm">{t("settings.osm")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mapSource === "osm" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            ⚠️ {t("settings.osmWarning")}
          </div>
        )}

        {mapSource === "gaode" && (
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Key className="h-3 w-3" /> {t("settings.gaodeKey")}
            </label>
            <div className="relative">
              <Input
                type={showGaode ? "text" : "password"}
                value={gaodeKey}
                onChange={(e) => onGaodeKeyChange(e.target.value)}
                placeholder={t("settings.gaodeKeyPlaceholder")}
                className="pr-10 text-sm"
                disabled={disabled}
              />
              <button
                type="button"
                onClick={() => onShowGaodeChange(!showGaode)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                disabled={disabled}
              >
                {showGaode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("settings.gaodeKeyHint")}</p>
          </div>
        )}

        {mapSource === "baidu" && (
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Key className="h-3 w-3" /> {t("settings.baiduKey")}
            </label>
            <div className="relative">
              <Input
                type={showBaidu ? "text" : "password"}
                value={baiduKey}
                onChange={(e) => onBaiduKeyChange(e.target.value)}
                placeholder={t("settings.baiduKeyPlaceholder")}
                className="pr-10 text-sm"
                disabled={disabled}
              />
              <button
                type="button"
                onClick={() => onShowBaiduChange(!showBaidu)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                disabled={disabled}
              >
                {showBaidu ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("settings.baiduKeyHint")}</p>
          </div>
        )}

        {mapSource === "osm" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            ✅ {t("settings.osmFree")}
          </div>
        )}
      </CardContent>

      {disabled && disabledMessage && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px] transition-all">
          <div className="mx-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs font-medium text-primary shadow-sm">
              <Info className="h-4 w-4 shrink-0" />
              <span className="leading-relaxed">{disabledMessage}</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
