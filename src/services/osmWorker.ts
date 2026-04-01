// Web Worker for parsing Overpass data
import { parseOverpassElements } from "./osmParser";

self.onmessage = (e: MessageEvent) => {
  const { data, queryType } = e.data;
  try {
    const results = parseOverpassElements(data, queryType);
    self.postMessage({ results });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Parsing failed" });
  }
};
