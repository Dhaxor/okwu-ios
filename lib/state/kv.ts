// The device's key-value storage for the persisted stores: AsyncStorage
// (localStorage on web). Kept apart from ./store so the store stays pure.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KV } from "./store";

export const deviceKV: KV = {
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
  removeItem: (k) => AsyncStorage.removeItem(k),
};
