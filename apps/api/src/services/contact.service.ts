// TODO Day 5: Add contact domain events (contactCreated,
// contactUpdated, contactDeleted) to @xtanbot/events
// and emit them here following the meeting.service pattern.
import { contactRepository } from "@xtanbot/db";
import { createLogger } from "@xtanbot/logger";
import type { CreateContact, UpdateContact } from "@xtanbot/zod-schemas";

const logger = createLogger("ContactService");

export const contactService = {
  async create(data: CreateContact) {
    logger.info({ userId: data.userId }, "Creating contact");
    return contactRepository.create(data);
  },

  async getById(id: string) {
    return contactRepository.findById(id);
  },

  async getUserContacts(userId: string) {
    return contactRepository.findByUserId(userId);
  },

  async search(userId: string, query: string) {
    return contactRepository.search(userId, query);
  },

  async update(id: string, data: UpdateContact) {
    return contactRepository.update(id, data);
  },

  async delete(id: string) {
    return contactRepository.softDelete(id);
  },
} as const;
