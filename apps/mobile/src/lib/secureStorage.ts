import * as SecureStore from "expo-secure-store";

/**
 * Thin wrapper so callers never touch SecureStore's API directly — keeps
 * every persisted auth value going through one place. Native only; see
 * secureStorage.web.ts for why a web variant exists.
 */
export const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
