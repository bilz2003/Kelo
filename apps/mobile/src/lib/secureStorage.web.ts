// expo-secure-store has no native binding on web — calling it there throws
// (there's no Keychain/Keystore equivalent in a browser). This app ships no
// web target (no "web" key in app.json); this file exists only so
// `expo start --web` is usable for local development/preview without
// crashing. It's picked up automatically by Metro's platform-extension
// resolution and never bundled into the real iOS/Android app, which always
// uses secureStorage.ts (real SecureStore) — this file changes nothing
// about what ships.
export const secureStorage = {
  getItem: async (key: string) => window.localStorage.getItem(key),
  setItem: async (key: string, value: string) => {
    window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    window.localStorage.removeItem(key);
  },
};
