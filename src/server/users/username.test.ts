import { describe, expect, it, vi } from "vitest";
import { resolveAvailableUsername, slugifyName } from "./username";

describe("slugifyName", () => {
  it.each([
    ["Carlos Mendoza", "carlos-mendoza"],
    ["María José García", "maria-jose-garcia"],
    ["Layla Hassan", "layla-hassan"],
    ["Cárlös", "carlos"],
    // `ı` (U+0131, dotless i) no se descompone con NFD; se descarta como
    // cualquier otra letra no-ASCII residual. Comportamiento aceptado:
    // los usernames son sugerencias iniciales y el user puede editar.
    ["Çağrı Öztürk", "cagr-ozturk"],
    ["  espacios  ", "espacios"],
    ["¡¡¡Hola!!!", "hola"],
    ["A@B-_C", "a-b-c"],
    ["a---b", "a-b"], // collapse multiple separators
    ["-leading-and-trailing-", "leading-and-trailing"],
    [null, "user"],
    [undefined, "user"],
    ["", "user"],
    ["   ", "user"],
    ["!@#$%", "user"], // no letras → fallback
  ] as const)("slugifyName(%s) → %s", (input, expected) => {
    expect(slugifyName(input)).toBe(expected);
  });

  it("caps to 20 characters and strips trailing dash", () => {
    expect(slugifyName("Carlos Mendoza García López")).toHaveLength(20);
    // No debería terminar en "-"
    expect(slugifyName("Carlos Mendoza García López")).not.toMatch(/-$/);
  });
});

describe("resolveAvailableUsername", () => {
  it("returns the base when it's available", async () => {
    const isTaken = vi.fn(async () => false);
    expect(await resolveAvailableUsername("carlos-mendoza", isTaken)).toBe("carlos-mendoza");
    expect(isTaken).toHaveBeenCalledTimes(1);
  });

  it("appends -2 when the base is taken", async () => {
    const taken = new Set(["carlos-mendoza"]);
    const isTaken = vi.fn(async (c: string) => taken.has(c));
    expect(await resolveAvailableUsername("carlos-mendoza", isTaken)).toBe("carlos-mendoza-2");
  });

  it("increments until it finds a free slot", async () => {
    const taken = new Set(["carlos-mendoza", "carlos-mendoza-2", "carlos-mendoza-3"]);
    const isTaken = vi.fn(async (c: string) => taken.has(c));
    expect(await resolveAvailableUsername("carlos-mendoza", isTaken)).toBe("carlos-mendoza-4");
  });

  it("trims the prefix to respect the 20-char limit when suffixing", async () => {
    const taken = new Set(["abcdefghijabcdefghij"]); // exactly 20 chars
    const isTaken = vi.fn(async (c: string) => taken.has(c));
    const result = await resolveAvailableUsername("abcdefghijabcdefghij", isTaken);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result).toMatch(/-2$/);
  });

  it("falls back to user-XXXXXX after exhausting numeric attempts", async () => {
    const isTaken = vi.fn(async () => true); // todo está tomado
    const result = await resolveAvailableUsername("carlos", isTaken);
    expect(result).toMatch(/^user-[a-z0-9]+$/);
    expect(result.length).toBeLessThanOrEqual(20);
  });
});
