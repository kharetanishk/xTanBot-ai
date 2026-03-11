import { redisConnection } from "@xtanbot/redis";
import { createLogger } from "@xtanbot/logger";
import type { DomainEvent } from "./types";

const logger = createLogger("EventBus");

const EVENT_CHANNEL_PREFIX = "xtanbot:events";

export async function publishEvent(event: DomainEvent): Promise<void> {
  const channel = `${EVENT_CHANNEL_PREFIX}:${event.type}`;
  const payload = JSON.stringify(event);
  await redisConnection.publish(channel, payload);
  logger.info({ eventType: event.type }, "Domain event published");
}

export function subscribeToEvent(
  eventType: string,
  handler: (event: DomainEvent) => Promise<void>,
): void {
  const subscriber = redisConnection.duplicate();
  const channel = `${EVENT_CHANNEL_PREFIX}:${eventType}`;

  subscriber.subscribe(channel, (err) => {
    if (err) {
      logger.error({ err, eventType }, "Failed to subscribe to event channel");
    } else {
      logger.info({ eventType, channel }, "Subscribed to event channel");
    }
  });

  subscriber.on("message", async (_, message) => {
    try {
      const event = JSON.parse(message) as DomainEvent;
      await handler(event);
    } catch (err) {
      logger.error({ err, eventType }, "Event handler failed");
    }
  });
}
