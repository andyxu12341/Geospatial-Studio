import osmtogeojson from 'osmtogeojson';
import { AreaQueryType, AreaResult, POIResult } from "./types";
import { LANDUSE_STANDARD_MAP, POI_COLORS, BUILDING_NAME_MAP } from "./constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseOverpassElements(data: any, queryType: AreaQueryType): (AreaResult | POIResult)[] {
  if (!data || !data.elements) return [];

  const geojson = osmtogeojson(data);
  const results: (AreaResult | POIResult)[] = [];

  geojson.features.forEach((feature: GeoJSON.Feature) => {
    const tags = feature.properties.tags || {};
    const geometry = feature.geometry;
    if (!geometry) return;

    if (queryType.startsWith("poi_") || queryType === "poi_all") {
      let lat: number | undefined;
      let lng: number | undefined;

      if (geometry.type === "Point") {
        [lng, lat] = geometry.coordinates;
      } else if (geometry.type === "Polygon" || geometry.type === "LineString") {
        // Use centroid for non-point features
        const coords = geometry.type === "Polygon" ? geometry.coordinates[0] : geometry.coordinates;
        lat = coords.reduce((acc: number, c: number[]) => acc + c[1], 0) / coords.length;
        lng = coords.reduce((acc: number, c: number[]) => acc + c[0], 0) / coords.length;
      }

      if (lat !== undefined && lng !== undefined) {
        results.push({
          name: tags.name || tags["name:zh"] || tags["name:en"] || "未命名点位",
          type: queryType,
          osmId: feature.properties.id,
          osmType: feature.properties.type,
          lat,
          lng,
          categoryName: getCategoryName(tags, queryType),
          color: POI_COLORS[queryType] || "#9B59B6",
          tags: tags,
          source: "osm"
        } as POIResult);
      }
    } else {
      let coords: [number, number][] = [];
      if (geometry.type === "Polygon") {
        coords = geometry.coordinates[0].map((c: number[]) => [c[0], c[1]]);
      } else if (geometry.type === "MultiPolygon") {
        // Simple approach: take the first polygon
        coords = geometry.coordinates[0][0].map((c: number[]) => [c[0], c[1]]);
      }

      if (coords.length >= 3) {
        results.push({
          name: tags.name || tags["name:zh"] || tags["name:en"] || "未命名区域",
          type: queryType,
          osmId: feature.properties.id,
          osmType: feature.properties.type,
          tags: tags,
          categoryName: getCategoryName(tags, queryType),
          color: getCategoryColor(tags, queryType),
          polygon: [coords.map(c => [c[0], c[1]])],
          center: geometry.type === "Polygon" ? { lat: geometry.coordinates[0][0][1], lng: geometry.coordinates[0][0][0] } : undefined
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
    // 检查更多可能的标签
    const categoryKey = tags.amenity || tags.shop || tags.tourism || tags.leisure || tags.office || tags.craft || tags.man_made || tags.historic || tags.sport;
    if (!categoryKey) return "其他设施";
    
    // 简单的中文映射
    const poiMap: Record<string, string> = {
      "hospital": "医院", "clinic": "诊所", "pharmacy": "药店", "doctors": "医生",
      "school": "学校", "university": "大学", "kindergarten": "幼儿园", "library": "图书馆",
      "restaurant": "餐厅", "cafe": "咖啡馆", "fast_food": "快餐", "bar": "酒吧",
      "supermarket": "超市", "convenience": "便利店", "mall": "商场",
      "bus_station": "公交站", "parking": "停车场", "fuel": "加油站",
      "sports_centre": "体育中心", "pitch": "运动场", "stadium": "体育场",
      "hotel": "酒店", "motel": "汽车旅馆"
    };
    return poiMap[categoryKey] || categoryKey;
  }
  return "其他";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCategoryColor(tags: any, type: AreaQueryType): string {
  if (type === "building") return "#A9A9A9";
  if (type === "admin") return "#595959";
  const key = tags.landuse || tags.leisure || tags.amenity || tags.natural || tags.waterway || "default";
  return LANDUSE_STANDARD_MAP[key]?.color || "#E0E0E0";
}
