import { createLLM, GEMMA_4_E2B_IT, isMemoryError } from "react-native-litert-lm";
import type { ModelClient, ModelGenerateOptions, ModelLoadState } from "./types";
import { raceWithAbort } from "./abortable";

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

function ensureModelLoaded(): Promise<void> {
  if (llm && loadState.status === "ready") return Promise.resolve();
  if (loadPromise) return loadPromise;

  llm = createLLM({ enableMemoryTracking: true });
  loadState = { status: "downloading", progress: 0 };

  loadPromise = llm
    .loadModel(
      GEMMA_4_E2B_IT,
      {
        // CONFIRMED (not a theory anymore — see plan.md T14.2's "Further
        // findings" for the full writeup): both backends are broken on this
        // device, for two distinct, root-caused reasons in
        // react-native-litert-lm 0.6.0 (latest published version — no fix
        // available via upgrade):
        //   - backend: "cpu" loads fine but crashes on the first real
        //     multimodal execute() with "Failed to invoke the compiled
        //     model". Cause: HybridLiteRTLM.kt hardcodes the vision encoder
        //     to GPU whenever multimodal:true is set, regardless of the
        //     primary backend, and its fallback-retry chain explicitly skips
        //     retrying when the requested backend is already "cpu" — so this
        //     mismatch only surfaces once real inference is attempted, not
        //     at load time. This exact bug class (model metadata marks a
        //     section GPU-only; explicit CPU request -> INVALID_ARGUMENT/
        //     invoke failure) is an open, unfixed upstream engine issue:
        //     github.com/google-ai-edge/LiteRT-LM/issues/2461.
        //   - backend: "gpu" (current setting) loads, but gets torn down
        //     under real memory pressure: LiteRTLMRegistry.kt installs a
        //     global, unconditional onTrimMemory handler that closes every
        //     loaded model instance app-wide as soon as Android signals
        //     TRIM_MEMORY_RUNNING_LOW (a mild signal) — there's no config
        //     flag to opt out, and the JS-level memoryBudget/onMemoryWarning
        //     hooks in the package's README are advisory-only and don't
        //     intercept this native close.
        // Net: this is a structural limitation of running a multimodal
        // (vision+text) model via this package on this device, not
        // something either backend choice or further config tuning fixes.
        // forceLoad below remains a stopgap either way.
        //
        // BOTH failure modes are now confirmed live on the actual test
        // device (POCO F1), not just theorized from source/upstream issues:
        //   - "gpu": reloaded after freeing 3.5GB of device RAM up front —
        //     loaded and initialized fine, then still got torn down by the
        //     OS trim callback ~20s later (adb logcat: "Received memory
        //     warning (level=10)... Closing resources"). Freeing memory
        //     bought time, not a fix — the process itself pins ~3.7GB
        //     resident once loaded, which alone drags system-wide
        //     MemAvailable low enough to retrigger the same warning.
        //   - "cpu" (current setting): survives idle longer (~62s vs gpu's
        //     ~20s) before the same trim teardown, but a real in-app scan
        //     reproduced the predicted crash exactly: LiteRtLmJniException
        //     "Failed to invoke the compiled model" at
        //     llm_litert_compiled_model_executor.cc:708, the instant
        //     execute() is called with a real image. Matches
        //     github.com/google-ai-edge/LiteRT-LM/issues/2461 precisely.
        // Conclusion: this device cannot run this model via this package,
        // full stop — not a config problem. Paused here; next test is on a
        // different physical device. See plan.md T14.2 for the full trail.
        backend: "cpu",
        multimodal: true,
        // Default is 4096, sized for multi-turn chat. Every call this app
        // makes is one-shot (ingredients OR nutrition prompt -> one JSON
        // response, no conversation history — see generate()'s
        // resetConversation-before-every-call comment below), so the KV
        // cache doesn't need that much budget. 2048 is a reasoned cut, not
        // one measured against real prompt/output token counts (no device
        // existed to measure against until this session) — if real prompts
        // ever get close to it, this is the first knob to revisit. Cut
        // further to 1024 alongside forceLoad below — worth ~30MB more
        // (see the KV-cache math in T14.2's plan.md entry), which is real
        // but small; it is not what's actually causing crashes once
        // forceLoad is on (see that comment for the real cause).
        maxContextTokens: 1024,
        // TEMPORARY (T14.2 tactical fix, not a real solution): the pre-flight
        // estimate is documented as deliberately conservative, and on a
        // 5.5GB-RAM device it still rejected a load that was only ~458MB
        // over budget after the cpu/maxContextTokens fixes above. forceLoad
        // skips that JS-side safety check and attempts the real load anyway
        // — trading a clean, safe error for a real (if conservative-estimate
        // suggests unlikely) chance of an OS-level kill instead. Revisit via
        // the OCR-first architecture discussed in plan.md Phase 14 rather
        // than leaving this flag on long-term.
        forceLoad: true,
      },
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
    const executePromise = llm.execute([
      { type: "text", text: options.userPrompt },
      { type: "image", path: options.image.uri },
    ]);

    // T13.3: react-native-litert-lm 0.6 has no cancellation API (checked its
    // full type surface — no abort/cancel/stop on LiteRTLMInstance or
    // ExecuteOptions), so aborting here can only make the PROMISE our caller
    // is awaiting settle immediately; the native inference call itself keeps
    // running until it finishes on its own, and its (now-unwanted) result is
    // just discarded. This is a real, disclosed limitation of the installed
    // package version, not a full mid-flight stop — see plan.md T13.3.
    if (options.signal) {
      executePromise.catch(() => {
        // Prevent an unhandled rejection once this result is abandoned below.
      });
    }
    return raceWithAbort(executePromise, options.signal);
  },
};
