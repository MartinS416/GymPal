// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `expo-sqlite` runs on WebAssembly in the browser, so Metro has to treat
// `.wasm` files as assets instead of trying to parse them as JavaScript.
config.resolver.assetExts.push('wasm');

// SharedArrayBuffer, which the WebAssembly build of SQLite uses, is only
// available on a cross origin isolated page.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  return middleware(req, res, next);
};

module.exports = config;
