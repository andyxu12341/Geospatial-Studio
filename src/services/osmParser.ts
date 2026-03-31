import { AreaQueryType, AreaResult, POIResult } from "./types";
import { LANDUSE_STANDARD_MAP, POI_COLORS, BUILDING_NAME_MAP } from "./constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseOverpassElements(data: any, queryType: AreaQueryType): (AreaResult | POIResult)[] {
  if (!data || !data.elements) return [];

  const nodes = new Map<number, [number, number]>();
  const ways = new Map<number, number[]>();
  const elements = data.elements;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements.forEach((el: any) => {
    if (el.type === "node") nodes.set(el.id, [el.lon, el.lat]);
    if (el.type === "way") ways.set(el.id, el.nodes);
  });

  const results: (AreaResult | POIResult)[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements.forEach((el: any) => {
    if (!el.tags) return;

    if (queryType.startsWith("poi_") || queryType === "poi_all") {
      let lat = el.lat;
      let lng = el.lon;
      if (el.type === "way" && el.center) {
        lat = el.center.lat;
        lng = el.center.lon;
      } else if (el.type === "way" && !el.center && el.nodes) {
        const coords = el.nodes.map((id: number) => nodes.get(id)).filter(Boolean);
        if (coords.length > 0) {
          lat = coords.reduce((acc: number, c) => acc + c[1], 0) / coords.length;
          lng = coords.reduce((acc: number, c) => acc + c[0], 0) / coords.length;
        }
      }

      if (lat !== undefined && lng !== undefined) {
        results.push({
          name: el.tags.name || el.tags["name:zh"] || el.tags["name:en"] || "未命名点位",
          type: queryType,
          osmId: el.id,
          osmType: el.type,
          lat,
          lng,
          categoryName: getCategoryName(el.tags, queryType),
          color: POI_COLORS[queryType] || "#9B59B6",
          tags: el.tags,
          source: "osm"
        } as POIResult);
      }
    } else {
      let coords: [number, number][] = [];
      if (el.type === "way") {
        coords = el.nodes.map((id: number) => nodes.get(id)).filter(Boolean);
      } else if (el.type === "relation" && el.members) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        el.members.forEach((m: any) => {
          if (m.type === "way" && m.role !== "inner") {
            const wayNodes = ways.get(m.ref);
            if (wayNodes) {
              coords.push(...wayNodes.map(id => nodes.get(id)).filter(Boolean));
            }
          }
        });
      }

      if (coords.length >= 3) {
        results.push({
          name: el.tags.name || el.tags["name:zh"] || el.tags["name:en"] || "未命名区域",
          type: queryType,
          osmId: el.id,
          osmType: el.type,
          tags: el.tags,
          categoryName: getCategoryName(el.tags, queryType),
          color: getCategoryColor(el.tags, queryType),
          polygon: [coords],
          center: el.center ? { lat: el.center.lat, lng: el.center.lon } : undefined
        } as AreaResult);
      }
    }
  });

  return results;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCategoryName(tags: any, type: AreaQueryType): string {
  if (type === "building") {
    const bType = tags.building || "yes";
    return BUILDING_NAME_MAP[bType] || `建筑 (${bType})`;
  }
  if (type === "landuse" || type === "all") {
    const key = tags.landuse || tags.leisure || tags.amenity || tags.natural || tags.waterway || "default";
    return LANDUSE_STANDARD_MAP[key]?.name || `其他 (${key})`;
  }
  if (type === "admin") {
    const level = tags.admin_level || "unknown";
    const levelMap: Record<string, string> = {
      "2": "国家级", "4": "省级", "6": "地市级", "8": "区县级", "9": "街道级", "10": "社区级"
    };
    return levelMap[level] || `行政边界 (L${level})`;
  }
  if (type.startsWith("poi_") || type === "poi_all") {
    return tags.amenity || tags.shop || tags.tourism || tags.leisure || tags.office || tags.craft || "POI";
  }
  return "未知分类";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCategoryColor(tags: any, type: AreaQueryType): string {
  if (type === "building") return "#A9A9A9";
  if (type === "admin") return "#595959";
  const key = tags.landuse || tags.leisure || tags.amenity || tags.natural || tags.waterway || "default";
  return LANDUSE_STANDARD_MAP[key]?.color || "#E0E0E0";
}
