import { Stack } from "expo-router";
import { useFonts, Caveat_600SemiBold, Caveat_700Bold } from "@expo-google-fonts/caveat";
import { View } from "react-native";
import { colors } from "../src/ui/theme";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Caveat_600SemiBold, Caveat_700Bold });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
