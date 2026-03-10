import { z } from "zod";

export const IdSchema = z.string().uuid();
export const TimestampSchema = z.string().datetime();
export const PhoneNumberSchema = z.string().regex(/^\+[1-9]\d{1,14}$/, "E.164 format required");
