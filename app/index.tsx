import { StyleSheet, Text, View } from "react-native";

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ingredient Lens</Text>
      <Text>Scaffold placeholder — camera flow lands in a later task.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
});
