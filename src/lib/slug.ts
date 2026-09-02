/** "Samuel Vidal Ruiz" -> "samuel-vidal-ruiz". Para nombrar los ficheros. */
export function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ranking"
  );
}
