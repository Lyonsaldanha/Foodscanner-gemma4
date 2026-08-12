export type CaptureTarget = "ingredients" | "nutrition";

export interface CapturedPhoto {
  uri: string;
  capturedAt: string;
}

export type CaptureSlots = Record<CaptureTarget, CapturedPhoto | null>;

export interface CaptureState {
  activeTarget: CaptureTarget; // which slot the top toggle currently points the shutter at
  slots: CaptureSlots;
}

export interface CaptureSettings {
  autoSinglePhotoMode: boolean; // best-effort single photo -> both panels; off by default
}
