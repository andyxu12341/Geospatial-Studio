import { useState, useRef, useCallback, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useTheme } from "next-themes";
import { MapPin, Map, Settings, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { GeoMap, GeoMapHandle } from "@/components/GeoMap";
import { GeocodingPanel } from "@/components/GeocodingPanel";
import { AreaQueryPanel } from "@/components/AreaQueryPanel";
import { ResultsSection } from "@/components/ResultsSection";
import { ApiSettingsCard } from "@/components/ApiSettingsCard";
import { RegionFilterCard } from "@/components/RegionFilterCard";
import { HelpDialog } from "@/components/HelpDialog";
import { useToast } from "@/hooks/use-toast";
import { type MapSource, type GeocodeItem } from "@/utils/geocoding";
import type { SpatialResult } from "@/hooks/useOverpassQuery";
import html2canvas from "html2canvas";

type AppMode = "geocoding" | "polygon";

function GeospatialStudioApp() {
  const { toast } = useToast();
  const mapRef = useRef<GeoMapHandle>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const [appMode, setAppMode] = useState<AppMode>("geocoding");
  const [mapSource, setMapSource] = useState<MapSource>("gaode");
  const [gaodeKey, setGaodeKey] = useState("");
  const [baiduKey, setBaiduKey] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [showGaode, setShowGaode] = useState(false);
  const [showBaidu, setShowBaidu] = useState(false);

  const [geocodingResults, setGeocodingResults] = useState<GeocodeItem[]>([]);
  const [areaResults, setAreaResults] = useState<SpatialResult[]>([]);
  const [markers, setMarkers] = useState<{ lat: number; lng: number; label: string; category?: string }[]>([]);

  useEffect(() => {
    const savedGaode = localStorage.getItem("gaodeKey");
    const savedBaidu = localStorage.getItem("baiduKey");
    const savedRegion = localStorage.getItem("regionFilter");
    if (savedGaode) setGaodeKey(savedGaode);
    if (savedBaidu) setBaiduKey(savedBaidu);
    if (savedRegion) setRegionFilter(savedRegion);
  }, []);

  useEffect(() => {
    localStorage.setItem("gaodeKey", gaodeKey);
  }, [gaodeKey]);

  useEffect(() => {
    localStorage.setItem("baiduKey", baiduKey);
  }, [baiduKey]);

  useEffect(() => {
    localStorage.setItem("regionFilter", regionFilter);
  }, [regionFilter]);

  const handleGeocodingResults = useCallback((results: GeocodeItem[]) => {
    setGeocodingResults(results);
    const validResults = results.filter((r) => r.status === "success" && r.lat != null && r.lng != null);
    setMarkers(
      validResults.map((r) => ({
        lat: r.lat!,
        lng: r.lng!,
        label: r.address,
        category: r.category,
      }))
    );
  }, []);

  const handleAreaResults = useCallback((results: SpatialResult[]) => {
    setAreaResults(results);
    const poiResults = results.filter((r) => r.poi);
    setMarkers(
      poiResults.map((r) => ({
        lat: r.poi!.lat,
        lng: r.poi!.lng,
        label: r.poi!.name,
        category: r.poi!.categoryName,
      }))
    );
  }, []);

  const handleExportPNG = useCallback(() => {
    const mapEl = document.querySelector(".leaflet-container") as HTMLElement;
    if (!mapEl) {
      toast({ title: "导出失败", description: "未找到地图容器", variant: "destructive" });
      return;
    }
    html2canvas(mapEl, { useCORS: true }).then((canvas) => {
      const link = document.createElement("a");
      link.download = `geospatial-studio-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "导出成功", description: "地图已保存为 PNG" });
    });
  }, [toast]);

  const handleCopyCoords = useCallback((r: GeocodeItem) => {
    if (r.lat != null && r.lng != null) {
      const coords = `${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}`;
      navigator.clipboard.writeText(coords);
      toast({ title: "已复制", description: coords });
    }
  }, [toast]);

  const handleSelectCandidate = useCallback((address: string, candidates: GeocodeItem["candidates"]) => {
    if (!candidates || candidates.length === 0) return;
    toast({ title: `备选结果 (${address})`, description: `${candidates.length} 个候选` });
  }, [toast]);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  }, [appMode]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1">
            <MapPin className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Geospatial Studio</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>功能模式</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={appMode === "geocoding"}
                    onClick={() => setAppMode("geocoding")}
                    className="w-full"
                  >
                    <MapPin className="h-4 w-4" />
                    <span>地理编码</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={appMode === "polygon"}
                    onClick={() => setAppMode("polygon")}
                    className="w-full"
                  >
                    <Map className="h-4 w-4" />
                    <span>区域查询</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>数据源配置</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 space-y-3">
                <ApiSettingsCard
                  mapSource={mapSource}
                  onMapSourceChange={setMapSource}
                  gaodeKey={gaodeKey}
                  onGaodeKeyChange={setGaodeKey}
                  baiduKey={baiduKey}
                  onBaiduKeyChange={setBaiduKey}
                  showGaode={showGaode}
                  onShowGaodeChange={setShowGaode}
                  showBaidu={showBaidu}
                  onShowBaiduChange={setShowBaidu}
                />
                <RegionFilterCard
                  mapSource={mapSource}
                  regionFilter={regionFilter}
                  onRegionFilterChange={setRegionFilter}
                />
              </div>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>操作面板</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 space-y-3">
                {appMode === "geocoding" ? (
                  <GeocodingPanel
                    mapSource={mapSource}
                    gaodeKey={gaodeKey}
                    baiduKey={baiduKey}
                    regionFilter={regionFilter}
                    onResults={handleGeocodingResults}
                    onProcessingChange={() => {}}
                    onProgressUpdate={() => {}}
                  />
                ) : (
                  <AreaQueryPanel
                    geoMapRef={mapRef}
                    mapSource={mapSource}
                    gaodeKey={gaodeKey}
                    baiduKey={baiduKey}
                    onResults={handleAreaResults}
                  />
                )}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupContent>
              <div className="px-2">
                <ResultsSection
                  appMode={appMode}
                  results={geocodingResults}
                  areaResults={areaResults}
                  onExportPNG={handleExportPNG}
                  onCopyCoords={handleCopyCoords}
                  onSelectCandidate={handleSelectCandidate}
                />
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="px-2 flex items-center gap-2">
            <HelpDialog
              mapSource={mapSource}
              gaodeKeyConfigured={!!gaodeKey.trim()}
              baiduKeyConfigured={!!baiduKey.trim()}
            />
          </div>
        </SidebarFooter>
      </Sidebar>

      <main className="flex-1 relative">
        <div ref={mapContainerRef} className="absolute inset-0">
          <GeoMap ref={mapRef} markers={markers} />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const { theme } = useTheme();

  return (
    <BrowserRouter>
      <div className={theme === "dark" ? "dark" : ""}>
        <SidebarProvider>
          <GeospatialStudioApp />
          <Toaster />
        </SidebarProvider>
      </div>
    </BrowserRouter>
  );
}
