import type { ModelClient } from "./types";

// react-native-litert-lm needs a native build/device and has no jest-expo
// mock, so this mocks the module the same way preprocess.test.ts mocks
// expo-image-manipulator, to verify engine.ts's own mapping logic — progress
// -> load-state transitions, the resetConversation-before-execute call
// sequence, and MemoryError surfacing as a load error — never touching real
// inference. Jest only allows referencing "mock"-prefixed variables inside a
// jest.mock() factory (hoisted above normal declarations), hence the naming.
const mockLoadModel = jest.fn();
const mockExecute = jest.fn();
const mockResetConversation = jest.fn();
const mockCreateLLM = jest.fn(() => ({
  loadModel: mockLoadModel,
  execute: mockExecute,
  resetConversation: mockResetConversation,
}));
const mockCheckBackendSupport = jest.fn();
const mockGetRecommendedBackend = jest.fn();
const mockIsMemoryError = jest.fn();

jest.mock("react-native-litert-lm", () => ({
  createLLM: mockCreateLLM,
  GEMMA_4_E2B_IT: "mock-model-id",
  checkBackendSupport: mockCheckBackendSupport,
  getRecommendedBackend: mockGetRecommendedBackend,
  isMemoryError: mockIsMemoryError,
}));

// engine.ts keeps its load state in module-level singletons (llm/loadState/
// loadPromise), not per-instance state — so unlike every other test file
// here, each test needs a genuinely fresh module (jest.resetModules + a
// re-require) rather than the one static import shared across tests.
// Otherwise state — and the in-flight-load memoization itself — would leak
// between tests. A dynamic import() doesn't work here (this Jest config runs
// without --experimental-vm-modules, confirmed by actually trying it), so
// this uses require() instead, with its own lint rule suppressed.
function loadFreshClient(): ModelClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require("./engine") as typeof import("./engine")).realModelClient;
}

describe("realModelClient", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockCreateLLM.mockImplementation(() => ({
      loadModel: mockLoadModel,
      execute: mockExecute,
      resetConversation: mockResetConversation,
    }));
    mockCheckBackendSupport.mockReturnValue(undefined); // gpu OK, no warning
    mockGetRecommendedBackend.mockReturnValue("cpu");
    mockIsMemoryError.mockReturnValue(false);
  });

  it("reports not_downloaded before ensureReady() is ever called", async () => {
    const client = loadFreshClient();
    expect(client.getLoadState()).toEqual({ status: "not_downloaded" });
  });

  describe("progress -> load-state mapping", () => {
    it("maps download progress ticks, the unsignaled loading gap, then ready", async () => {
      const client = loadFreshClient();
      let progressCallback: ((p: number) => void) | undefined;
      let resolveLoad: () => void = () => {};
      mockLoadModel.mockImplementation((_path: string, _config: unknown, onProgress: (p: number) => void) => {
        progressCallback = onProgress;
        return new Promise<void>((resolve) => {
          resolveLoad = resolve;
        });
      });

      const readyPromise = client.ensureReady();

      // The synchronous portion of ensureModelLoaded() (llm/loadState
      // assignment, the loadModel() call) runs before the first await
      // suspends ensureReady(), so this is already visible.
      expect(client.getLoadState()).toEqual({ status: "downloading", progress: 0 });

      progressCallback!(0.4);
      expect(client.getLoadState()).toEqual({ status: "downloading", progress: 0.4 });

      progressCallback!(1);
      expect(client.getLoadState()).toEqual({ status: "loading" });

      resolveLoad();
      await readyPromise;
      expect(client.getLoadState()).toEqual({ status: "ready" });
    });
  });

  describe("generate()'s resetConversation-before-execute sequence", () => {
    it("resets the conversation with the given systemPrompt, then executes, in that order", async () => {
      const client = loadFreshClient();
      mockLoadModel.mockResolvedValue(undefined);
      await client.ensureReady();

      mockExecute.mockResolvedValue("raw model output");

      const result = await client.generate({
        systemPrompt: "SYSTEM PROMPT",
        userPrompt: "USER PROMPT",
        image: { uri: "file://photo.jpg", width: 896, height: 896 },
      });

      expect(result).toBe("raw model output");
      expect(mockResetConversation).toHaveBeenCalledWith(undefined, "SYSTEM PROMPT");
      expect(mockExecute).toHaveBeenCalledWith([
        { type: "text", text: "USER PROMPT" },
        { type: "image", path: "file://photo.jpg" },
      ]);
      // Not just "both were called" — resetConversation must complete its
      // call before execute is invoked, since it switches the session-level
      // system prompt execute() is about to run against.
      expect(mockResetConversation.mock.invocationCallOrder[0]).toBeLessThan(
        mockExecute.mock.invocationCallOrder[0]
      );
    });

    it("throws instead of touching the native API if generate() is called before ensureReady()", async () => {
      const client = loadFreshClient();

      await expect(
        client.generate({ systemPrompt: "s", userPrompt: "u", image: { uri: "file://x.jpg", width: 1, height: 1 } })
      ).rejects.toThrow("Model not loaded");
      expect(mockResetConversation).not.toHaveBeenCalled();
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe("MemoryError handling", () => {
    it("surfaces a MemoryError from loadModel as a load-error state, not an uncaught crash", async () => {
      const client = loadFreshClient();
      const estimate = { verdict: "critical", recommendation: "Use a smaller model or free up memory." };
      const memoryError = Object.assign(new Error("won't fit"), { estimate });
      mockLoadModel.mockRejectedValue(memoryError);
      mockIsMemoryError.mockImplementation((e: unknown) => e === memoryError);

      await expect(client.ensureReady()).rejects.toBe(memoryError);

      expect(client.getLoadState()).toEqual({
        status: "error",
        message: "Not enough memory to load the model (critical): Use a smaller model or free up memory.",
      });
    });

    it("falls back to the error's own message for a non-memory load failure", async () => {
      const client = loadFreshClient();
      mockLoadModel.mockRejectedValue(new Error("network down"));
      mockIsMemoryError.mockReturnValue(false);

      await expect(client.ensureReady()).rejects.toThrow("network down");
      expect(client.getLoadState()).toEqual({ status: "error", message: "network down" });
    });
  });

  describe("concurrent ensureReady() calls", () => {
    it("memoizes the in-flight load instead of double-loading the model", async () => {
      const client = loadFreshClient();
      mockLoadModel.mockResolvedValue(undefined);

      await Promise.all([client.ensureReady(), client.ensureReady()]);

      expect(mockCreateLLM).toHaveBeenCalledTimes(1);
      expect(mockLoadModel).toHaveBeenCalledTimes(1);
      expect(client.getLoadState()).toEqual({ status: "ready" });
    });
  });
});
