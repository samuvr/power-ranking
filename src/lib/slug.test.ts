import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("baja a minúsculas y une con guiones", () => {
    expect(slugify("Samuel Vidal Ruiz")).toBe("samuel-vidal-ruiz");
  });

  it("quita acentos y signos", () => {
    expect(slugify("Post-Cortes ¡Training Camp!")).toBe("post-cortes-training-camp");
    expect(slugify("José Ángel")).toBe("jose-angel");
  });

  it("cae en un nombre por defecto si no queda nada", () => {
    expect(slugify("¿?")).toBe("ranking");
  });
});
