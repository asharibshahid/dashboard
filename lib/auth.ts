import { auth } from "@clerk/nextjs/server";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function requireUserId() {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();
  return userId;
}
