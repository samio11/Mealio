import type { MessMembership, User } from "../../generated/prisma/client.ts";

export interface AuthSessionContext {
  user: User;
  session: { id: string; expiresAt: Date };
  /** The mess resolved for this request, if the route was mess-scoped. */
  membership?: MessMembership;
  messId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthSessionContext;
      /** Parsed query object produced by the `validate` middleware. */
      listQuery?: Record<string, unknown>;
    }
  }
}

export {};
