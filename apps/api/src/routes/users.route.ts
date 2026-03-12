import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.middleware";
import { userService } from "../services/user.service";
import { CreateUserSchema } from "@xtanbot/zod-schemas";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("UsersRoute");

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  // POST /users — register user (public)
  app.post("/users", async (request, reply) => {
    const body = CreateUserSchema.parse(request.body);
    const existing = await userService.getByEmail(body.email);

    if (existing) {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: "User with this email already exists",
      });
    }

    const user = await userService.create(body);

    // Issue JWT
    const token = await reply.jwtSign({
      userId: user.id,
      email: user.email,
    });

    return reply.status(201).send({ user, token });
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

    return reply.send(user);
  });
}
