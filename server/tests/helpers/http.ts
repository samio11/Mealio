import type { Express } from "express";
import request from "supertest";

const TEST_ORIGIN = process.env.FRONTEND_URL ?? "http://localhost:3000";

/**
 * A cookie-aware HTTP client for integration tests.
 *
 * Better-Auth requires a trusted `Origin` header (it rejects browser-style
 * requests without one), so every request sends it.
 */
export class TestClient {
  private cookies: string[] = [];

  constructor(
    private readonly app: Express,
    readonly label: string,
  ) {}

  private apply(req: request.Test): request.Test {
    req.set("Origin", TEST_ORIGIN);
    if (this.cookies.length > 0) req.set("Cookie", this.cookies.join("; "));
    return req;
  }

  private capture(res: request.Response): void {
    const raw = res.headers["set-cookie"] as unknown;
    const list = Array.isArray(raw) ? (raw as string[]) : typeof raw === "string" ? [raw] : [];
    for (const cookie of list) {
      const pair = cookie.split(";")[0]?.trim();
      if (!pair) continue;
      const name = pair.split("=")[0];
      if (!name) continue;
      this.cookies = this.cookies.filter((c) => !c.startsWith(`${name}=`));
      this.cookies.push(pair);
    }
  }

  async post(path: string, body?: unknown): Promise<request.Response> {
    const res = await this.apply(request(this.app).post(path)).send(body ?? {});
    this.capture(res);
    return res;
  }

  async get(path: string): Promise<request.Response> {
    const res = await this.apply(request(this.app).get(path));
    this.capture(res);
    return res;
  }

  async patch(path: string, body?: unknown): Promise<request.Response> {
    const res = await this.apply(request(this.app).patch(path)).send(body ?? {});
    this.capture(res);
    return res;
  }

  async del(path: string, body?: unknown): Promise<request.Response> {
    const req = this.apply(request(this.app).delete(path));
    const res = body === undefined ? await req : await req.send(body);
    this.capture(res);
    return res;
  }
}

export async function signUp(app: Express, email: string, name = "Test User"): Promise<TestClient> {
  const client = new TestClient(app, email);
  const res = await client.post("/api/auth/sign-up/email", { email, password: "Passw0rd!23", name });
  if (res.status !== 200) {
    throw new Error(`sign-up failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return client;
}
