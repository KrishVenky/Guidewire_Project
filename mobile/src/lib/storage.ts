import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

type StorageMethod = (key: string, value?: string) => Promise<string | void | null>;

function hasMethod(method: unknown): method is StorageMethod {
  return typeof method === 'function';
}

async function getItemFromFallback(key: string): Promise<string | null> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
}

async function setItemInFallback(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  }
}

async function deleteItemFromFallback(key: string): Promise<void> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
  }
}

export async function getItemAsync(key: string): Promise<string | null> {
  try {
    if (hasMethod(SecureStore.getItemAsync)) {
      return await SecureStore.getItemAsync(key);
    }
  } catch {
    return await getItemFromFallback(key);
  }

  return await getItemFromFallback(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  try {
    if (hasMethod(SecureStore.setItemAsync)) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
  } catch {
    await setItemInFallback(key, value);
    return;
  }

  await setItemInFallback(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  try {
    if (hasMethod(SecureStore.deleteItemAsync)) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
  } catch {
    await deleteItemFromFallback(key);
    return;
  }

  await deleteItemFromFallback(key);
}
