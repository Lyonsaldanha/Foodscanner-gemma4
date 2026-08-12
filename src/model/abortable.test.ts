import { createAbortError, raceWithAbort } from "./abortable";

describe("raceWithAbort", () => {
  it("resolves with the promise's value when the signal never fires", async () => {
    const result = await raceWithAbort(Promise.resolve("value"), new AbortController().signal);
    expect(result).toBe("value");
  });

  it("passes the promise straight through when no signal is given", async () => {
    const result = await raceWithAbort(Promise.resolve("value"), undefined);
    expect(result).toBe("value");
  });

  it("rejects immediately, without waiting, when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    // A promise that would only ever resolve after this test's timeout —
    // proves the race doesn't wait for it, since the test still finishes.
    const neverResolves = new Promise<string>(() => {});

    await expect(raceWithAbort(neverResolves, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects with AbortError once the signal fires mid-flight, ignoring the original promise's eventual resolution", async () => {
    const controller = new AbortController();
    let resolveOriginal: (value: string) => void = () => {};
    const original = new Promise<string>((resolve) => {
      resolveOriginal = resolve;
    });

    const raced = raceWithAbort(original, controller.signal);
    controller.abort();
    resolveOriginal("too late");

    await expect(raced).rejects.toMatchObject({ name: "AbortError", message: "Aborted" });
  });
});

describe("createAbortError", () => {
  it("produces an Error identifiable by name, not just message text", () => {
    const error = createAbortError();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AbortError");
  });
});
