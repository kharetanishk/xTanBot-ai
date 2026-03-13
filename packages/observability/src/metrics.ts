import {
  Counter,
  Histogram,
  Gauge,
  register,
  collectDefaultMetrics,
} from "prom-client";

collectDefaultMetrics();

export type { Counter, Histogram, Gauge };

export function counter(
  name: string,
  help: string,
  labelNames: string[] = [],
): Counter {
  try {
    return new Counter({ name, help, labelNames });
  } catch {
    return register.getSingleMetric(name) as Counter;
  }
}

export function histogram(
  name: string,
  help: string,
  buckets: number[] = [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  labelNames: string[] = [],
): Histogram {
  try {
    return new Histogram({ name, help, buckets, labelNames });
  } catch {
    return register.getSingleMetric(name) as Histogram;
  }
}

export function gauge(
  name: string,
  help: string,
  labelNames: string[] = [],
): Gauge {
  try {
    return new Gauge({ name, help, labelNames });
  } catch {
    return register.getSingleMetric(name) as Gauge;
  }
}

export async function collectMetrics(): Promise<string> {
  return register.metrics();
}

export function metricsContentType(): string {
  return register.contentType;
}
