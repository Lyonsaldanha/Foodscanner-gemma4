import { useCallback, useMemo, useState } from "react";
import type { CapturedPhoto, CaptureSlots, CaptureState, CaptureTarget } from "../types/capture";

const EMPTY_SLOTS: CaptureSlots = { ingredients: null, nutrition: null };

export interface UseCaptureStateResult extends CaptureState {
  setActiveTarget: (target: CaptureTarget) => void;
  // Captures into whichever slot activeTarget currently points to — the
  // confirmed unguided flow: one shutter, a top toggle picks the target.
  capturePhoto: (uri: string) => void;
  retake: (target: CaptureTarget) => void;
  reset: () => void;
  // True once at least one slot is filled — gates the Analyze action.
  canAnalyze: boolean;
}

export function useCaptureState(initialTarget: CaptureTarget = "ingredients"): UseCaptureStateResult {
  const [activeTarget, setActiveTarget] = useState<CaptureTarget>(initialTarget);
  const [slots, setSlots] = useState<CaptureSlots>(EMPTY_SLOTS);

  const capturePhoto = useCallback(
    (uri: string) => {
      const photo: CapturedPhoto = { uri, capturedAt: new Date().toISOString() };
      setSlots((prev) => ({ ...prev, [activeTarget]: photo }));
    },
    [activeTarget]
  );

  const retake = useCallback((target: CaptureTarget) => {
    setSlots((prev) => ({ ...prev, [target]: null }));
  }, []);

  const reset = useCallback(() => {
    setSlots(EMPTY_SLOTS);
  }, []);

  const canAnalyze = useMemo(() => slots.ingredients !== null || slots.nutrition !== null, [slots]);

  return { activeTarget, slots, setActiveTarget, capturePhoto, retake, reset, canAnalyze };
}
