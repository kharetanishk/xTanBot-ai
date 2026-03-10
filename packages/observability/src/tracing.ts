export function createTracer(_name: string) {
  return {
    startSpan: (_operationName: string) => ({
      end: () => {},
      setTag: (_key: string, _value: unknown) => {},
    }),
  };
}
