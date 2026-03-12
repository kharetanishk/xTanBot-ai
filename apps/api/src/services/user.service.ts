import { userRepository } from "@xtanbot/db";
import { createLogger } from "@xtanbot/logger";
import type { CreateUser, UpdateUser } from "@xtanbot/zod-schemas";

const logger = createLogger("UserService");

export const userService = {
  async create(data: CreateUser) {
    logger.info({ email: data.email }, "Creating user");
    return userRepository.create(data);
  },

  async getById(id: string) {
    return userRepository.findById(id);
  },

  async getByEmail(email: string) {
    return userRepository.findByEmail(email);
  },

  async update(id: string, data: UpdateUser) {
    return userRepository.update(id, data);
  },
} as const;
