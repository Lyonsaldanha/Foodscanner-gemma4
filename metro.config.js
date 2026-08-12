// expo-sqlite's web implementation (T13.1's first real import of it into the
// app bundle — T0.3 installed the package, but nothing actually imported it
// outside Jest-mocked tests until now) runs its SQLite engine as WASM in a
// web worker. The default Metro config has no asset extension for .wasm, so
// bundling it for web fails with "Unable to resolve ...wa-sqlite.wasm" —
// this is Expo's documented fix, not project-specific.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("wasm");

module.exports = config;
