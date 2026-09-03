import { beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  clientIp,
  consumeAttempt,
  resetAllAttempts,
  resetAttempts,
} from "./rate-limit";

const RULE = { limit: 3, windowMs: 60_000 };
const T0 = 1_700_000_000_000;

beforeEach(() => {
  resetAllAttempts();
});

describe("checkRateLimit", () => {
  it("deja pasar una clave sin fallos previos", () => {
    expect(checkRateLimit("a", RULE, T0)).toEqual({
      allowed: true,
      remaining: 3,
      retryAfterSeconds: 0,
    });
  });

  it("no consume intentos al consultar", () => {
    consumeAttempt("a", RULE, T0);
    checkRateLimit("a", RULE, T0);
    checkRateLimit("a", RULE, T0);
    expect(checkRateLimit("a", RULE, T0).remaining).toBe(2);
  });
});

describe("consumeAttempt", () => {
  it("bloquea al agotar el límite", () => {
    expect(consumeAttempt("a", RULE, T0).allowed).toBe(true);
    expect(consumeAttempt("a", RULE, T0).allowed).toBe(true);
    const third = consumeAttempt("a", RULE, T0);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(checkRateLimit("a", RULE, T0).allowed).toBe(false);
  });

  it("cuenta cada clave por separado", () => {
    consumeAttempt("a", RULE, T0);
    consumeAttempt("a", RULE, T0);
    consumeAttempt("a", RULE, T0);
    expect(checkRateLimit("a", RULE, T0).allowed).toBe(false);
    expect(checkRateLimit("b", RULE, T0).allowed).toBe(true);
  });

  it("informa de cuánto falta para volver a tener cupo", () => {
    consumeAttempt("a", RULE, T0);
    consumeAttempt("a", RULE, T0 + 10_000);
    const blocked = consumeAttempt("a", RULE, T0 + 20_000);
    expect(blocked.allowed).toBe(false);
    // El fallo más antiguo (T0) sale de la ventana 40 s después de T0 + 20 s.
    expect(blocked.retryAfterSeconds).toBe(40);
  });
});

describe("ventana deslizante", () => {
  it("olvida los fallos que salen de la ventana", () => {
    consumeAttempt("a", RULE, T0);
    consumeAttempt("a", RULE, T0);
    consumeAttempt("a", RULE, T0);
    expect(checkRateLimit("a", RULE, T0 + 59_999).allowed).toBe(false);
    expect(checkRateLimit("a", RULE, T0 + 60_001).allowed).toBe(true);
  });

  it("libera cupo poco a poco, no de golpe", () => {
    consumeAttempt("a", RULE, T0);
    consumeAttempt("a", RULE, T0 + 30_000);
    consumeAttempt("a", RULE, T0 + 40_000);
    // Al caducar solo el primer fallo queda un hueco, no tres.
    const afterFirstExpires = checkRateLimit("a", RULE, T0 + 60_001);
    expect(afterFirstExpires.allowed).toBe(true);
    expect(afterFirstExpires.remaining).toBe(1);
  });
});

describe("resetAttempts", () => {
  it("devuelve el cupo entero tras un intento correcto", () => {
    consumeAttempt("a", RULE, T0);
    consumeAttempt("a", RULE, T0);
    consumeAttempt("a", RULE, T0);
    resetAttempts("a");
    expect(checkRateLimit("a", RULE, T0)).toEqual({
      allowed: true,
      remaining: 3,
      retryAfterSeconds: 0,
    });
  });
});

describe("clientIp", () => {
  const withHeaders = (headers: Record<string, string>) =>
    new Request("https://example.com", { headers });

  it("toma el primer valor de x-forwarded-for", () => {
    expect(clientIp(withHeaders({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });

  it("cae en x-real-ip cuando no hay x-forwarded-for", () => {
    expect(clientIp(withHeaders({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("devuelve 'unknown' sin cabeceras de proxy", () => {
    expect(clientIp(withHeaders({}))).toBe("unknown");
  });
});
