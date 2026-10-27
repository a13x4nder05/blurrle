import { beforeEach, describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../server/app";
import { createCloudCatalog } from "../../server/cloud";
const admin = vi.hoisted(() => ({ request: vi.fn(), download: vi.fn() }));
vi.mock("../../server/supabase-client", () => ({ supabaseAdmin: () => admin }));
const people = Array.from({ length: 5 }, (_, index) => ({
  id: index.toString(16).padStart(12, "0"),
  name: `Person ${index}`,
  accepted_answers: [`Person ${index}`],
  hint: "A familiar face",
  review_status: "approved",
}));
const portraits = people.map((person, index) => ({
  id: index.toString(16).padStart(24, "0"),
  person_id: person.id,
  review_status: "approved",
}));
beforeEach(() => {
  admin.request.mockReset();
});
describe("daily API", () => {
  it("returns five ordered Supabase faces and preserves the saved daily selection", async () => {
    let selected: object[] = [];
    admin.request.mockImplementation(async (path: string) => {
      if (path.startsWith("/rest/v1/daily_images?")) return selected;
      if (path === "/rest/v1/rpc/generate_blurrle_daily") {
        selected = people.map((person, position) => ({
          person_id: person.id,
          portrait_id: portraits[position].id,
          position,
        }));
        return [];
      }
      if (path.startsWith("/rest/v1/people?")) return people;
      if (path.startsWith("/rest/v1/portraits?")) return portraits;
      throw new Error(`Unexpected request: ${path}`);
    });
    const app = createApp({
      cloud: createCloudCatalog(),
      now: () => new Date("2026-10-26T23:59:59Z"),
    });
    const first = await request(app).get("/api/daily/actors").expect(200);
    expect(first.headers["cache-control"]).toBe("no-store");
    expect(first.body.day).toBe("2026-10-26");
    expect(
      first.body.rounds.map((round: { personId: string }) => round.personId),
    ).toEqual(people.map((person) => person.id));
    const again = await request(app).get("/api/daily/actors").expect(200);
    expect(again.body).toEqual(first.body);
    expect(
      admin.request.mock.calls.filter(
        ([path]) => path === "/rest/v1/rpc/generate_blurrle_daily",
      ),
    ).toHaveLength(1);
  });
  it("validates categories and refuses unavailable or partial cloud selections", async () => {
    const app = createApp({ cloud: createCloudCatalog() });
    await request(app).get("/api/daily/unknown").expect(404);
    admin.request.mockResolvedValue([]);
    await request(app).get("/api/daily/actors").expect(503);
    admin.request.mockResolvedValue([
      { position: 0, person_id: people[0].id, portrait_id: portraits[0].id },
    ]);
    await request(app).get("/api/daily/actors").expect(503);
  });
});
