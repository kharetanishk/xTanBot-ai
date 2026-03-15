import { z } from "zod";

export const CreateContactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format")
    .optional(),
  company: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export const UpdateContactSchema = CreateContactSchema.partial();

export const ContactSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  company: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CreateContact = z.infer<typeof CreateContactSchema> & {
  userId: string;
};
export type UpdateContact = z.infer<typeof UpdateContactSchema>;
export type Contact = z.infer<typeof ContactSchema>;
