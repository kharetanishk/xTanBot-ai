import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.middleware";
import { userService } from "../services/user.service";
import {
  RegisterUserSchema,
  LoginUserSchema,
  UpdateUserSchema,
} from "@xtanbot/zod-schemas";
import { createLogger } from "@xtanbot/logger";
import { hashPassword, verifyPassword } from "../utils/password.util";
import { toPublicUser } from "../utils/user-public.util";

const logger = createLogger("UsersRoute");

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  // POST /users/login — sign in (public)
  app.post("/users/login", async (request, reply) => {
    const body = LoginUserSchema.parse(request.body);
    const user = await userService.getByEmail(body.email);
    if (
      !user ||
      !(await verifyPassword(body.password, user.passwordHash))
    ) {
      return reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid email or password",
      });
    }

    const token = await reply.jwtSign({
      userId: user.id,
      email: user.email,
    });

    return reply.send({ user: toPublicUser(user), token });
  });

  // POST /users — register user (public)
  app.post("/users", async (request, reply) => {
    const body = RegisterUserSchema.parse(request.body);
    const existing = await userService.getByEmail(body.email);

    if (existing) {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: "User with this email already exists",
      });
    }

    const { password, ...profile } = body;
    const passwordHash = await hashPassword(password);
    const user = await userService.create({ ...profile, passwordHash });

    const token = await reply.jwtSign({
      userId: user.id,
      email: user.email,
    });

    return reply.status(201).send({ user: toPublicUser(user), token });
  });

  // GET /users/me — get current user
  app.get("/users/me", { preHandler: requireAuth }, async (request, reply) => {
    const { userId } = request.user;
    const user = await userService.getById(userId);

    if (!user) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "User not found",
      });
    }

    return reply.send(toPublicUser(user));
  });

  app.patch(
    "/users/me",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.user;
      const raw = UpdateUserSchema.parse(request.body);
      const data: {
        name?: string;
        timezone?: string;
        phone?: string | null;
      } = {};
      if (raw.name !== undefined) data.name = raw.name;
      if (raw.timezone !== undefined) data.timezone = raw.timezone;
      if (raw.phone !== undefined) {
        data.phone = raw.phone === "" ? null : raw.phone;
      }
      if (Object.keys(data).length === 0) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "No fields to update",
        });
      }
      const user = await userService.update(userId, data);
      return reply.send(toPublicUser(user));
    },
  );
}
