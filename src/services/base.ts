import { GeocodeItem, MapSource } from "./types";

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries - 1) {
        await sleep(800 * (attempt + 1));
      }
    }
  }
  throw lastErr;
}

let _jsonpCounter = 0;
export function jsonp<T>(url: string, timeout = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cbName = `__geo_${Date.now()}_${_jsonpCounter++}`;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; cleanup(); reject(new Error("JSONP 请求超时")); }
    }, timeout);

    function cleanup() {
      clearTimeout(timer);
      delete (window as unknown as Record<string, unknown>)[cbName];
      const el = document.getElementById(cbName);
      if (el) el.remove();
    }

    (window as unknown as Record<string, unknown>)[cbName] = (data: T) => {
      if (!settled) { settled = true; cleanup(); resolve(data); }
    };

    const script = document.createElement("script");
    script.id = cbName;
    const sep = url.includes("?") ? "&" : "?";
    script.src = `${url}${sep}callback=${cbName}`;
    script.onerror = () => { if (!settled) { settled = true; cleanup(); reject(new Error("JSONP 脚本加载失败")); } };
    document.head.appendChild(script);
  });
}

export function friendlyError(raw: string): string {
  if (/timeout|超时/i.test(raw)) return "匹配失败: 请求超时";
  if (/network|fetch|ERR_/i.test(raw)) return "匹配失败: 网络异常";
  if (/HTTP\s*[45]\d{2}/i.test(raw)) return "匹配失败: 服务端错误";
  if (/key|密钥|invalid/i.test(raw)) return "匹配失败: API Key无效";
  if (/JSONP/i.test(raw)) return "匹配失败: 跨域请求失败";
  if (raw.includes("API 错误") || raw.includes("查询失败")) return raw;
  if (raw.startsWith("匹配失败")) return raw;
  if (raw === "已取消") return raw;
  return "匹配失败: 未找到有效坐标";
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_VERSION = "v2";

export function cacheGet(address: string, source: MapSource, regionFilter?: string): GeocodeItem | null {
  try {
    const key = `gc:${CACHE_VERSION}:${source}:${address}:${regionFilter ?? ""}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { item, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return item;
  } catch {
    return null;
  }
}

export function cacheSet(address: string, source: MapSource, item: GeocodeItem, regionFilter?: string) {
  if (item.status === "success") {
    try {
      const key = `gc:${CACHE_VERSION}:${source}:${address}:${regionFilter ?? ""}`;
      localStorage.setItem(key, JSON.stringify({ item, ts: Date.now() }));
    } catch { /* storage full — ignore */ }
  }
}

export function clearGeocodingCache() {
  try {
    const prefix = "gc:";
    const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
