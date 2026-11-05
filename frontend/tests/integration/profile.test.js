// Sign-in + alias (profile) flow: GET/POST /api/me
import { describe, it, expect, afterAll } from "vitest";
import me from "../../src/pages/api/me";
import state from "../../src/pages/api/state";
import { call, cleanup, db, makeGuest, makeUser, uniqueAlias } from "./helpers";

afterAll(cleanup);

describe("authentication", () => {
  it("rejects requests without a token", async () => {
    expect(await call(me)).toEqual({ status: 401, body: { error: "unauthorized" } });
  });

  it("rejects a bogus token", async () => {
    expect((await call(me, { token: "not-a-jwt" })).status).toBe(401);
  });

  it("rejects unsupported methods", async () => {
    const u = await makeUser();
    expect((await call(me, { method: "DELETE", token: u.token })).status).toBe(405);
  });
});

describe("alias", () => {
  it("a new account has no profile yet and can't load a board", async () => {
    const u = await makeUser();
    const r = await call(me, { token: u.token });
    expect(r).toEqual({ status: 200, body: { profile: null, isGuest: false } });
    expect(await call(state, { token: u.token })).toEqual({
      status: 404,
      body: { error: "profile_not_found" },
    });
  });

  it("saves the chosen alias (trimmed, inner spaces collapsed) and only the alias", async () => {
    const u = await makeUser();
    const alias = uniqueAlias("Si  Paling");
    const r = await call(me, { method: "POST", token: u.token, body: { name: `  ${alias}  ` } });
    const expected = alias.replace(/\s+/g, " ");
    expect(r).toEqual({ status: 200, body: { profile: { name: expected } } });
    expect((await call(me, { token: u.token })).body.profile).toEqual({ name: expected });
    const { data } = await db.from("profiles").select("*").eq("id", u.id).single();
    expect(data.name).toBe(expected);
    expect(data).not.toHaveProperty("entitas");
  });

  it("caps the alias at 30 characters", async () => {
    const u = await makeUser();
    const long = uniqueAlias("x".repeat(40));
    const r = await call(me, { method: "POST", token: u.token, body: { name: long } });
    expect(r.body.profile.name).toBe(long.slice(0, 30));
  });

  it.each([undefined, "", "   ", null])("rejects an empty alias (%s)", async (name) => {
    const u = await makeUser();
    const r = await call(me, { method: "POST", token: u.token, body: { name } });
    expect(r).toEqual({ status: 400, body: { error: "alias required" } });
  });

  it("rejects an alias another player already uses, case-insensitively", async () => {
    const alias = uniqueAlias("Garut Lover");
    await makeUser({ alias });
    const b = await makeUser();
    for (const name of [alias, alias.toUpperCase(), ` ${alias.toLowerCase()} `]) {
      const r = await call(me, { method: "POST", token: b.token, body: { name } });
      expect(r).toEqual({ status: 409, body: { error: "alias_taken" } });
    }
  });

  it("treats % and _ literally when checking duplicates", async () => {
    const tag = uniqueAlias("").trim();
    await makeUser({ alias: `a_c ${tag}` });
    const b = await makeUser();
    expect((await call(me, { method: "POST", token: b.token, body: { name: `abc ${tag}` } })).status).toBe(200);
    const c = await makeUser();
    expect((await call(me, { method: "POST", token: c.token, body: { name: `% ${tag}` } })).status).toBe(200);
  });

  it("lets a player re-save or change their own alias", async () => {
    const alias = uniqueAlias();
    const u = await makeUser({ alias });
    expect((await call(me, { method: "POST", token: u.token, body: { name: alias.toUpperCase() } })).status).toBe(200);
    const next = uniqueAlias("Renamed");
    expect((await call(me, { method: "POST", token: u.token, body: { name: next } })).body.profile.name).toBe(next);
  });
});

describe("guest (anonymous) players", () => {
  it("are flagged as guests and can play after choosing an alias", async () => {
    const g = await makeGuest({ alias: uniqueAlias("Tamu") });
    expect((await call(me, { token: g.token })).body.isGuest).toBe(true);
    const s = await call(state, { token: g.token });
    expect(s.status).toBe(200);
    expect(s.body.isGuest).toBe(true);
  });
});
