import { z } from "zod";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";
import type { ToolDefinition, ClaudeToolDef } from "../types";

const logger = createLogger("GetLocationTool");

const inputSchema = z.object({
  userId: z.string().uuid().optional(),
});

type Input = z.infer<typeof inputSchema>;
type Output = {
  city: string;
  state: string;
  pincode: string;
  latitude: string;
  longitude: string;
  formatted: string;
  googleMapsUrl: string;
};

export const getLocationTool: ToolDefinition<Input, Output> = {
  name: "get_location",
  description:
    "Get the user's current location. Use when user asks to send their location, find " +
    "something near them, or search locally. Returns city, coordinates, and a Google Maps link.",
  requiresConfirmation: false,

  inputSchema,

  async execute(_input: Input): Promise<Output> {
    logger.info("Getting user location");

    const city = config.USER_DEFAULT_CITY;
    const state = config.USER_DEFAULT_STATE;
    const pincode = config.USER_DEFAULT_PINCODE;
    const lat = config.USER_DEFAULT_LAT;
    const lng = config.USER_DEFAULT_LNG;

    const googleMapsUrl = `https://maps.google.com/?q=${lat},${lng}`;

    return {
      city,
      state,
      pincode,
      latitude: lat,
      longitude: lng,
      formatted: `${city}, ${state}, India - ${pincode}`,
      googleMapsUrl,
    };
  },

  toClaudeToolDefinition(): ClaudeToolDef {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {},
        required: [],
      },
    };
  },
};
