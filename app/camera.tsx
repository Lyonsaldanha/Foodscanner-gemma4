import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Link, useRouter } from "expo-router";
import { useCaptureState } from "../src/capture/useCaptureState";

// Ad hoc ink/paper/sketch palette (CLAUDE.md's "Conceptual Sketch Bento Box"
// style) — not yet the formal src/ui/theme.ts (that lands with the Result
// screen work, T7.1), but camera/processing chrome should already read as
// notebook-ish, not a stock glossy camera UI.
const INK = "#2b2a25";
const PAPER = "#f6f1e6";
const ACCENT = "#b3452b";

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const captureState = useCaptureState();
  const router = useRouter();

  const handleShutterPress = async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        captureState.capturePhoto(photo.uri);
      }
    } finally {
      setIsCapturing(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centeredPaper}>
        <Text style={styles.bodyText}>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centeredPaper}>
        <Text style={styles.heading}>CAMERA ACCESS</Text>
        <Text style={styles.bodyText}>
          Ingredient Lens needs the camera to scan ingredient panels and nutrition labels.
        </Text>
        <Pressable style={styles.sketchButton} onPress={requestPermission}>
          <Text style={styles.sketchButtonText}>Grant Camera Access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      <View style={styles.topBar}>
        <ToggleButton
          label="Ingredients"
          active={captureState.activeTarget === "ingredients"}
          captured={captureState.slots.ingredients !== null}
          onPress={() => captureState.setActiveTarget("ingredients")}
        />
        <ToggleButton
          label="Nutrition"
          active={captureState.activeTarget === "nutrition"}
          captured={captureState.slots.nutrition !== null}
          onPress={() => captureState.setActiveTarget("nutrition")}
        />
        <Link href="/settings" style={styles.settingsLink}>
          <Text style={styles.settingsLinkText}>⚙</Text>
        </Link>
      </View>

      <View style={styles.bottomBar}>
        {captureState.canAnalyze ? (
          <Pressable
            style={styles.analyzeButton}
            onPress={() =>
              router.push({
                pathname: "/processing",
                params: {
                  ingredientsUri: captureState.slots.ingredients?.uri ?? "",
                  nutritionUri: captureState.slots.nutrition?.uri ?? "",
                },
              })
            }
            accessibilityLabel="Analyze captured photos"
          >
            <Text style={styles.analyzeButtonText}>Analyze</Text>
          </Pressable>
        ) : (
          <View style={styles.analyzeButtonPlaceholder} />
        )}

        <Pressable
          accessibilityLabel="Take photo"
          style={[styles.shutterButton, isCapturing && styles.shutterButtonDisabled]}
          onPress={handleShutterPress}
          disabled={isCapturing}
        >
          <View style={styles.shutterInner} />
        </Pressable>

        <View style={styles.analyzeButtonPlaceholder} />
      </View>
    </View>
  );
}

function ToggleButton({
  label,
  active,
  captured,
  onPress,
}: {
  label: string;
  active: boolean;
  captured: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.toggleButton, active && styles.toggleButtonActive]}
      onPress={onPress}
      accessibilityLabel={`Capture target: ${label}`}
    >
      <Text style={[styles.toggleButtonText, active && styles.toggleButtonTextActive]}>
        {label}
        {captured ? " ✓" : ""}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centeredPaper: {
    flex: 1,
    backgroundColor: PAPER,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 1,
    color: INK,
  },
  bodyText: {
    fontSize: 15,
    color: INK,
    textAlign: "center",
  },
  sketchButton: {
    borderWidth: 2,
    borderColor: INK,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: PAPER,
  },
  sketchButtonText: {
    color: INK,
    fontSize: 16,
    fontWeight: "600",
  },
  topBar: {
    position: "absolute",
    top: 56,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  toggleButton: {
    borderWidth: 2,
    borderColor: PAPER,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 9,
    borderBottomRightRadius: 15,
    borderBottomLeftRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "rgba(43,42,37,0.55)",
  },
  toggleButtonActive: {
    backgroundColor: PAPER,
  },
  toggleButtonText: {
    color: PAPER,
    fontWeight: "600",
    fontSize: 14,
  },
  toggleButtonTextActive: {
    color: INK,
  },
  settingsLink: {
    marginLeft: "auto",
    borderWidth: 2,
    borderColor: PAPER,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsLinkText: {
    color: PAPER,
    fontSize: 16,
  },
  bottomBar: {
    position: "absolute",
    bottom: 48,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: PAPER,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterButtonDisabled: {
    opacity: 0.5,
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: PAPER,
  },
  analyzeButton: {
    borderWidth: 2,
    borderColor: PAPER,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 9,
    borderBottomRightRadius: 15,
    borderBottomLeftRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: ACCENT,
    minWidth: 84,
    alignItems: "center",
  },
  analyzeButtonPlaceholder: {
    minWidth: 84,
  },
  analyzeButtonText: {
    color: PAPER,
    fontWeight: "700",
  },
});
