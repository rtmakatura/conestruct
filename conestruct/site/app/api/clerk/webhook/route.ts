import { headers } from "next/headers";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { getDb, users, companies } from "@/db";

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("CLERK_WEBHOOK_SECRET not set", { status: 500 });
  }

  const headerPayload = headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();

  let evt: WebhookEvent;
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const db = getDb();

  switch (evt.type) {
    case "user.created":
    case "user.updated": {
      const { id, email_addresses, first_name, last_name } = evt.data;
      const email = email_addresses?.[0]?.email_address;
      if (!email) {
        return new Response("User has no email", { status: 400 });
      }
      const name = [first_name, last_name].filter(Boolean).join(" ") || null;
      await db
        .insert(users)
        .values({ id, email, name })
        .onConflictDoUpdate({
          target: users.id,
          set: { email, name, updatedAt: new Date() },
        });
      break;
    }
    case "organization.created":
    case "organization.updated": {
      const { id, name } = evt.data;
      await db
        .insert(companies)
        .values({ id, name })
        .onConflictDoUpdate({
          target: companies.id,
          set: { name, updatedAt: new Date() },
        });
      break;
    }
    default:
      break;
  }

  return new Response("ok", { status: 200 });
}
