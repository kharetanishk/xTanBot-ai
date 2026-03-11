export type DomainEvent = {
  type: string;
  timestamp: string;
  [key: string]: unknown;
};
