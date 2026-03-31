import { create } from 'zustand';
import { type SpatialResult } from '@/hooks/useOverpassQuery';

export type DataSource = 'osm' | 'gaode' | 'baidu';
export type QueryMode = 'semantic' | 'bbox' | 'polygon';
export type AreaQueryType = 'poi_all' | 'poi_medical' | 'poi_education' | 'poi_food' | 'building' | 'landuse' | 'admin';

interface SpatialQueryState {
  dataSource: DataSource;
  queryMode: QueryMode;
  areaType: AreaQueryType;
  keyword: string;
  bbox: [number, number, number, number] | null;
  polygonLatLngs: [number, number][] | null;
  results: SpatialResult[];
  isLoading: boolean;
  
  setDataSource: (source: DataSource) => void;
  setQueryMode: (mode: QueryMode) => void;
  setAreaType: (type: AreaQueryType) => void;
  setKeyword: (keyword: string) => void;
  setBbox: (bbox: [number, number, number, number] | null) => void;
  setPolygonLatLngs: (latlngs: [number, number][] | null) => void;
  setResults: (results: SpatialResult[]) => void;
  setIsLoading: (loading: boolean) => void;
  reset: () => void;
}

// ... rest of the file ...

export const useSpatialQueryStore = create<SpatialQueryState>((set) => ({
  dataSource: 'osm',
  queryMode: 'semantic',
  areaType: 'poi_all',
  keyword: '',
  bbox: null,
  polygonLatLngs: null,
  results: [],
  isLoading: false,

  setDataSource: (dataSource) => set({ dataSource }),
  setQueryMode: (queryMode) => set({ queryMode }),
  setAreaType: (areaType) => set({ areaType }),
  setKeyword: (keyword) => set({ keyword }),
  setBbox: (bbox) => set({ bbox }),
  setPolygonLatLngs: (polygonLatLngs) => set({ polygonLatLngs }),
  setResults: (results) => set({ results }),
  setIsLoading: (isLoading) => set({ isLoading }),
  reset: () => set({
    dataSource: 'osm',
    queryMode: 'semantic',
    areaType: 'poi_all',
    keyword: '',
    bbox: null,
    polygonLatLngs: null,
    results: [],
    isLoading: false,
  }),
}));
