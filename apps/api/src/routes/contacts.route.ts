import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.middleware";
import { contactService } from "../services/contact.service";
import { CreateContactSchema, UpdateContactSchema } from "@xtanbot/zod-schemas";

export async function contactsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/contacts", { preHandler: requireAuth }, async (request, reply) => {
    const body = CreateContactSchema.parse(request.body);
    const { userId } = request.user;
    const contact = await contactService.create({ ...body, userId });
    return reply.status(201).send(contact);
  });

  app.get("/contacts", { preHandler: requireAuth }, async (request, reply) => {
    const { userId } = request.user;
    const query = (request.query as { q?: string }).q;

    const contacts = query
      ? await contactService.search(userId, query)
      : await contactService.getUserContacts(userId);

    return reply.send(contacts);
  });

  app.get(
    "/contacts/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const contact = await contactService.getById(id);

      if (!contact) {
        return reply
          .status(404)
          .send({
            statusCode: 404,
            error: "Not Found",
            message: "Contact not found",
          });
      }

      return reply.send(contact);
    },
  );

  app.patch(
    "/contacts/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = UpdateContactSchema.parse(request.body);
      const contact = await contactService.update(id, body);
      return reply.send(contact);
    },
  );

  app.delete(
    "/contacts/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await contactService.delete(id);
      return reply.status(204).send();
    },
  );
}
