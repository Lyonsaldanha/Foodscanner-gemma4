import { createLLM, GEMMA_4_E2B_IT, checkBackendSupport, getRecommendedBackend, isMemoryError } from "react-native-litert-lm";
import type { Backend } from "react-native-litert-lm";
import type { ModelClient, ModelGenerateOptions, ModelLoadState } from "./types";

// The real ModelClient (T4.1's seam), wrapping react-native-litert-lm.
// Requires a native build (npx expo prebuild + expo run:android) and a
// physical arm64 device — does not run in the web preview or under Jest
// (see engine.test.ts for the mapping-logic tests, mocked the same way
// preprocess.test.ts mocks expo-image-manipulator). NEVER RUN on real
// hardware as of this writing — see plan.md Phase 12 / architecture.md ADR 1.
//
// Uses the package's imperative API (createLLM/loadModel/execute), not the
// React hook (useModel) T4.1 originally expected to need bridging — the
// installed package's actual types show loadModel(path, config,
// onDownloadProgress) already reports download progress via a plain
// callback, so no React state is needed to satisfy ModelClient.getLoadState().
//
// Each ingredients/nutrition call needs a different system prompt, but the
// engine's systemPrompt is set once per loadModel() call (session-level) —
// resetConversation(undefined, systemPrompt) is the documented, cheap way to
// switch it without reloading the model weights. Our app only ever does
// one-shot calls (no multi-turn follow-up), so there's no conversation state
// worth preserving across scans; resetting before every generate() is correct.

let llm: ReturnType<typeof createLLM> | null = null;
let loadState: ModelLoadState = { status: "not_downloaded" };
let loadPromise: Promise<void> | null = null;

function pickBackend(): Backend {
  // checkBackendSupport returns a warning string if the config may have
  // issues, undefined if OK. getRecommendedBackend() is the package's own
  // safe-default fallback ('cpu').
  return checkBackendSupport("gpu") ? getRecommendedBackend() : "gpu";
}

function ensureModelLoaded(): Promise<void> {
  if (llm && loadState.status === "ready") return Promise.resolve();
  if (loadPromise) return loadPromise;

  llm = createLLM({ enableMemoryTracking: true });
  loadState = { status: "downloading", progress: 0 };

  loadPromise = llm
    .loadModel(
      GEMMA_4_E2B_IT,
      { backend: pickBackend(), multimodal: true },
      (progress) => {
        // The package reports one continuous download-progress stream; a
        // brief unsignaled "parsing into memory" gap between progress
        // reaching 1 and the promise resolving is approximated as "loading".
        loadState = progress >= 1 ? { status: "loading" } : { status: "downloading", progress };
      }
    )
    .then(() => {
      loadState = { status: "ready" };
    })
    .catch((e: unknown) => {
      const message = isMemoryError(e)
        ? `Not enough memory to load the model (${e.estimate.verdict}): ${e.estimate.recommendation}`
        : e instanceof Error
          ? e.message
          : "Failed to load the model.";
      loadState = { status: "error", message };
      throw e;
    })
    .finally(() => {
      loadPromise = null;
    });

  return loadPromise;
}

export const realModelClient: ModelClient = {
  getLoadState(): ModelLoadState {
    return loadState;
  },

  async ensureReady(): Promise<void> {
    await ensureModelLoaded();
  },

  async generate(options: ModelGenerateOptions): Promise<string> {
    if (!llm) {
      throw new Error("Model not loaded — call ensureReady() before generate().");
    }
    llm.resetConversation(undefined, options.systemPrompt);
    return llm.execute([
      { type: "text", text: options.userPrompt },
      { type: "image", path: options.image.uri },
    ]);
  },
};
