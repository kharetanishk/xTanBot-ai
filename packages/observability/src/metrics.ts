export const metrics = {
  increment: (_name: string, _value?: number, _tags?: Record<string, string>): void => {},
  histogram: (_name: string, _value: number, _tags?: Record<string, string>): void => {},
  gauge: (_name: string, _value: number, _tags?: Record<string, string>): void => {},
} as const;
