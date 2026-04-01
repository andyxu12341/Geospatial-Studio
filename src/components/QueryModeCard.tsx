import { useTranslation } from "react-i18next";
import { Search, Square, Pentagon, Loader2, Pause, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSpatialQueryStore } from "@/store/useSpatialQueryStore";
import { motion, AnimatePresence } from "framer-motion";

interface QueryModeCardProps {
  onQuery: () => void;
  error?: string | null;
}

export function QueryModeCard({ onQuery, error }: QueryModeCardProps) {
  const { t } = useTranslation();
  const { 
    queryMode, setQueryMode, 
    keyword, setKeyword,
    isLoading, queryCategory
  } = useSpatialQueryStore();

  const modes = [
    { id: "semantic", icon: Search, label: t("areaQuery.modeSemantic"), hint: t("areaQuery.modeSemanticHint") },
    { id: "rectangle", icon: Square, label: t("areaQuery.modeRectangle"), hint: t("areaQuery.modeRectangleHint") },
    { id: "polygon", icon: Pentagon, label: t("areaQuery.modePolygon"), hint: t("areaQuery.modePolygonHint") },
  ] as const;

  return (
    <Card className="overflow-hidden border-primary/20 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          {t("areaQuery.extractionMode")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-3 gap-2">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const active = queryMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setQueryMode(mode.id)}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border p-2 transition-all ${
                  active 
                    ? "border-primary bg-primary/10 text-primary shadow-sm" 
                    : "border-border hover:bg-accent text-muted-foreground"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "animate-in zoom-in-50" : ""}`} />
                <span className="text-[10px] font-medium">{mode.label}</span>
              </button>
            );
          })}
        </div>

        <div className="rounded-lg bg-muted/50 p-2 text-[10px] text-muted-foreground leading-relaxed">
          {modes.find(m => m.id === queryMode)?.hint}
        </div>

        <AnimatePresence mode="wait">
          {queryMode === "semantic" && (
            <motion.div
              key="semantic-input"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  placeholder={t("areaQuery.keywordPlaceholder")}
                  onKeyDown={e => e.key === "Enter" && onQuery()}
                  className="h-9 pl-9 text-sm"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          <Button 
            onClick={onQuery} 
            disabled={isLoading} 
            className="flex-1 gap-1.5 h-9 font-medium"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {t("toast.areaQuery")}...</>
            ) : queryCategory === "area" ? (
              <><Search className="h-4 w-4" /> {t("areaQuery.startAreaQuery")}</>
            ) : queryMode === "rectangle" ? (
              <><Square className="h-4 w-4" /> {t("areaQuery.startDrawRect")}</>
            ) : queryMode === "polygon" ? (
              <><Pentagon className="h-4 w-4" /> {t("areaQuery.startDrawPoly")}</>
            ) : (
              <><Search className="h-4 w-4" /> {t("areaQuery.query")}</>
            )}
          </Button>
          
          {isLoading && (
            <Button variant="outline" size="icon" className="shrink-0 h-9 w-9">
              <Pause className="h-4 w-4" />
            </Button>
          )}
        </div>

        {isLoading && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              <span>{t("areaQuery.progress")}</span>
              <span>{t("areaQuery.estimating")}...</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <motion.div 
                className="h-full bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: "95%" }}
                transition={{ duration: 20, ease: "linear" }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[10px] text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
            <div className="flex items-start gap-1.5 font-medium">
              <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="leading-tight">{error}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
