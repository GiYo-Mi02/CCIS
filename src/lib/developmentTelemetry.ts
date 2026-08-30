interface RouteMetric {
  requests: number;
  duplicates: number;
  slowRequests: number;
  totalDurationMs: number;
}

interface DevelopmentTelemetrySnapshot {
  apiCallsByRoute: Record<string, RouteMetric>;
  mediaBytesByPage: Record<string, number>;
  activeRealtimeChannels: number;
}

declare global {
  var __CCIS_DEV_TELEMETRY__: { snapshot: () => DevelopmentTelemetrySnapshot } | undefined;
  var __CCIS_ACTIVE_REALTIME_CHANNELS__: number | undefined;
}

const metrics = new Map<string, RouteMetric>();
const mediaBytes = new Map<string, number>();
const recentRequests = new Map<string, number>();

function routeName(input: RequestInfo | URL, method?: string): string | null {
  try {
    const raw = input instanceof Request ? input.url : input.toString();
    const url = new URL(raw, window.location.origin);
    const supabaseHost = new URL(import.meta.env.VITE_SUPABASE_URL).host;
    if (url.host !== supabaseHost) return null;
    const segments = url.pathname.split('/').filter(Boolean);
    const route = segments.slice(0, 4).join('/');
    return `${(method || (input instanceof Request ? input.method : 'GET')).toUpperCase()} /${route}`;
  } catch {
    return null;
  }
}

export function installDevelopmentTelemetry(): void {
  if (!import.meta.env.DEV || globalThis.__CCIS_DEV_TELEMETRY__) return;
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init) => {
    const route = routeName(input, init?.method);
    const startedAt = performance.now();
    if (route) {
      const now = Date.now();
      const metric = metrics.get(route) || { requests: 0, duplicates: 0, slowRequests: 0, totalDurationMs: 0 };
      metric.requests += 1;
      if (now - (recentRequests.get(route) || 0) < 2_000) metric.duplicates += 1;
      recentRequests.set(route, now);
      metrics.set(route, metric);
    }

    try {
      return await originalFetch(input, init);
    } finally {
      if (route) {
        const duration = performance.now() - startedAt;
        const metric = metrics.get(route)!;
        metric.totalDurationMs += duration;
        if (duration >= 1_000) metric.slowRequests += 1;
      }
    }
  };

  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!(entry instanceof PerformanceResourceTiming)) continue;
        if (!/\.(avif|gif|jpe?g|png|webp|pdf)(\?|$)/i.test(entry.name)) continue;
        const page = window.location.pathname || '/';
        mediaBytes.set(page, (mediaBytes.get(page) || 0) + Math.max(entry.transferSize, entry.encodedBodySize, 0));
      }
    });
    observer.observe({ type: 'resource', buffered: true });
  }

  globalThis.__CCIS_DEV_TELEMETRY__ = {
    snapshot: () => ({
      apiCallsByRoute: Object.fromEntries(metrics),
      mediaBytesByPage: Object.fromEntries(mediaBytes),
      activeRealtimeChannels: globalThis.__CCIS_ACTIVE_REALTIME_CHANNELS__ || 0,
    }),
  };
}

export {};
