

## [1.2.3](https://github.com/andyxu12341/Geospatial-Studio/compare/v1.2.2...v1.2.3) (2026-03-31)


### Bug Fixes

* 移除多余的 ThemeProvider 避免与 Index 内部 dark mode 冲突 ([d9ef3e9](https://github.com/andyxu12341/Geospatial-Studio/commit/d9ef3e9b04f1e14b0339c334e8c8d517c26aed95))

## [1.2.2](https://github.com/andyxu12341/Geospatial-Studio/compare/v1.2.1...v1.2.2) (2026-03-31)


### Bug Fixes

* 修复 App.tsx 路由指向原始 Index 页面，保留 Vite 部署路径修复 ([3ad108d](https://github.com/andyxu12341/Geospatial-Studio/commit/3ad108dde11c7f5042e1b41f6e8853384b72d19b))

## [1.2.1](https://github.com/andyxu12341/Geospatial-Studio/compare/v1.2.0...v1.2.1) (2026-03-31)


### Bug Fixes

* 按照新架构重写 App.tsx 并修正 Vite 部署基准路径 ([dd5993d](https://github.com/andyxu12341/Geospatial-Studio/commit/dd5993d2cbc72579b2eef829615559956b351caf))

# [1.2.0](https://github.com/andyxu12341/Geospatial-Studio/compare/v1.1.0...v1.2.0) (2026-03-31)


### Bug Fixes

* Revert to version 1.0.2 and remove unused dependencies ([a942de1](https://github.com/andyxu12341/Geospatial-Studio/commit/a942de1bc541f3ebcda728bb9b5c8be6e9c516ca))
* Simplify OSM POI query and parsing ([a0af30a](https://github.com/andyxu12341/Geospatial-Studio/commit/a0af30a824118143f227b22d80dc74facabb80f6))
* Update project version and dependencies ([9e41b30](https://github.com/andyxu12341/Geospatial-Studio/commit/9e41b30c273dd2b6b920b5102c6cc05cbab88f23))
* 修复 GitHub Pages 部署白屏与更新页面标题 ([3a78b4e](https://github.com/andyxu12341/Geospatial-Studio/commit/3a78b4e1cbb68c7742d41c2699fbb8eebf59827c))
* 更新页面标题为 Geospatial Studio ([e5449f6](https://github.com/andyxu12341/Geospatial-Studio/commit/e5449f6c15267cf0d1fbf69aae613fabb599e988))


### Features

* Introduce Zustand for state management ([f626cf7](https://github.com/andyxu12341/Geospatial-Studio/commit/f626cf797db00b780f1610ba89d1615cce5576a3))
* **useOverpassQuery:** Improve semantic search fallback ([7838f1f](https://github.com/andyxu12341/Geospatial-Studio/commit/7838f1fcfef0002c677f212d90eb2c8003a3ae42))

* chore: prepare for release (98e42d8)
* feat: Introduce Zustand for state management (f626cf7)
* chore: release v1.1.0 (59add75)
* chore: prepare for release (e311b45)
* fix: Revert to version 1.0.2 and remove unused dependencies (a942de1)
* chore: release v1.1.0 (b6a6339)
* chore: prepare for release (4da4364)
* fix: Update project version and dependencies (9e41b30)
* chore: release v1.1.0 (a668e81)
* chore: prepare for release (c0d6954)
* feat(useOverpassQuery): Improve semantic search fallback (7838f1f)
* fix: Simplify OSM POI query and parsing (a0af30a)

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Conventional Commits](https://www.conventionalcommits.org/).

---

## [1.0.2](https://github.com/andyxu12341/Geocoding-China-Pro/compare/v1.0.1...v1.0.2) (2026-03-31)

### Documentation

* update README — reflect search-first engine, basemap auto-alignment, v1.0.1 release info
* add AGENTS.md for AI session context
* update AGENTS.md — every push = one release

## [1.0.1](https://github.com/andyxu12341/Geocoding-China-Pro/compare/v1.0.0...v1.0.1) (2026-03-31)

### Documentation

* add initial CHANGELOG.md for v1.0.0

### Maintenance

* add release-it v1.0.0 with conventional changelog
* update release-it hooks to use direct vite build
* disable GitHub API release, handle push manually

---

## [1.0.0](https://github.com/andyxu12341/Geocoding-China-Pro/compare/v0.0.0...v1.0.0) (2026-03-31)

### Features

* add 9 domestic/international map tile providers for China users
* add category column to results table; extend region filter to OSM
* add OSM area query — query building/residential/park/commercial/administrative polygons from Overpass API
* add request deduplication, caching, statistics panel, history, amap multi-candidate selection, and i18n
* apply official Gaode types codes and add poi_hotel type
* search-first geocoding engine (POI search is always first)
* smart 3-step geocoding engine with level-ranked candidates
* Tab B POI query — grouped select, OSM/Gaode/Baidu POI, unified spatial results
* WebGIS Tabs architecture — TabA geocoding / TabB area extraction + four-dimensional area engine + leaflet-draw

### Bug Fixes

* GeoMap auto-transforms WGS-84 data to GCJ-02 when Gaode basemap is active
* eliminate duplicate progress UI, enforce GCJ-02/BD-09→WGS-84 in Tab A, add POI diagnostics
* eliminate stale-cache poisoning + mandatory audit logging on all transforms
* GCJ-02/BD-09 to WGS-84 coordinate transformation for Gaode/Baidu POI
* gcoord API usage + aggressive logging chain for silent-fail debugging
* INVALID_PARAMS, transformBbox swap, coordinate wash for Tab A & B
* restore Tab A progress UI and eliminate Gaode/Baidu silent failures
* simplify geocodeGaode - trust POI API ranking, remove custom quality sort
* restore correct base path for GitHub Pages

### Technical Architecture

* clean up integrator mindset fixes
* export searchNominatim and NominatimResult for reuse
* extract pure functions, remove dead code, fix async/await
* extract Tab A into GeocodingPanel.tsx
* replace hand-rolled coord transform with gcoord library
* unify export functions with combined exports
*抽离useGeocoding和useOverpassQuery两个Custom Hooks，精简Index.tsx约60行
* 提取ResultsSection组件，统一预览表格和导出菜单

### Documentation

* sync README with search-first architecture
* update README with coord transform, HelpDialog, official Amap codes
* update README with POI features, unified export, and new project structure
* 更新README为完整中英双语版
