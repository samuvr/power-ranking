import { describe, expect, it } from "vitest";
import { isUndefinedColumnError } from "./client";

describe("isUndefinedColumnError", () => {
  it("reconoce el 42703 de Postgres", () => {
    expect(isUndefinedColumnError(Object.assign(new Error("column x"), { code: "42703" }))).toBe(
      true,
    );
  });

  it("ignora otros errores de base de datos", () => {
    expect(isUndefinedColumnError(Object.assign(new Error("boom"), { code: "23505" }))).toBe(false);
    expect(isUndefinedColumnError(new Error("boom"))).toBe(false);
    expect(isUndefinedColumnError(null)).toBe(false);
    expect(isUndefinedColumnError("42703")).toBe(false);
  });
});
