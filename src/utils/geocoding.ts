// ============================================================
// Geocoding Utility — Refactored to Service Pattern
// ============================================================

export * from "../services/types";
export * from "../services/constants";
export { clearGeocodingCache } from "../services/base";
export { 
  geocodeAddress as geocodeOne, 
  queryPOI, 
  geocodeBatch 
} from "../services/factory";
export { 
  runOverpassQuery, 
  buildOverpassBboxQuery, 
  buildAreaOverpassQuery, 
  buildPolygonOverpassQuery, 
  buildPOIBboxQuery, 
  buildPOIPolygonQuery, 
  buildPOIByKeywordQuery,
  buildPOIBboxAndNameQuery,
  parseOverpassElements,
  getQueryGroup,
  geocodeOSM
} from "../services/osm";

// Re-export MapSource for backward compatibility
export type { MapSource } from "../services/types";
