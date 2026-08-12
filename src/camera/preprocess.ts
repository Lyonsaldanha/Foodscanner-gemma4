import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { PreprocessedImage } from "../model/types";

// LiteRT-LM's optimal input resolution for Gemma 4 E2B (ingredient-lens-spec.md §6.2).
export const MODEL_INPUT_SIZE = 896;

// Resizes a captured photo to the model's expected input resolution.
// ingredient-lens-spec.md §6.2 also calls for normalizing pixel values to
// [-1, 1] as part of this step, but expo-image-manipulator only exposes
// file-level operations (resize/crop/rotate/save), not raw pixel buffers —
// there's no JS-side way to do that math without a pixel-buffer API this
// project doesn't depend on. PreprocessedImage (src/model/types.ts) is a
// file reference, not a raw tensor, so that normalization is left to
// whatever loads this file for inference on the native side; not built or
// verifiable in this sandbox (no device, no real react-native-litert-lm
// bridge — see this file's plan.md Reality check).
export async function preprocessImage(uri: string): Promise<PreprocessedImage> {
  const context = ImageManipulator.manipulate(uri).resize({ width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}
