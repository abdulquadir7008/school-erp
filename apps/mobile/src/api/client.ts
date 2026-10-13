import axios, { AxiosError, AxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// NOTE: inside an Android emulator, `localhost` points at the emulator
// itself, not your PC. 10.0.2.2 is the emulator's alias for the host.
// iOS simulator shares the host network, so localhost works there.
// Physical devices need your PC's LAN IP (see apps/mobile/.env).
const DEFAULT_BASE_URL = Platform.select({
  android: "http://10.0.2.2:4000/api/v1",
  default: "http://localhost:4000/api/v1",
});

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_BASE_URL;

const ACCESS_KEY = "schoolsphere.accessToken";
const REFRESH_KEY = "schoolsphere.refreshToken";

export async function getTokens() {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);
  return { accessToken, refreshToken };
}

export async function setTokens(accessToken: string, refreshToken: string) {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, refreshToken),
  ]);
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
  meta?: { total: number; page: number; limit: number; totalPages: number };
}

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const { refreshToken } = await getTokens();
  if (!refreshToken) return null;
  try {
    const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
    const { accessToken, refreshToken: next } = res.data.data;
    await setTokens(accessToken, next);
    return accessToken;
  } catch {
    await clearTokens();
    return null;
  }
}

api.interceptors.request.use(async (config) => {
  const { accessToken } = await getTokens();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      refreshing = refreshing || doRefresh();
      const token = await refreshing;
      refreshing = null;
      if (token) {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (error.code === "ECONNABORTED") return "Request timed out. Check your connection.";
    if (!error.response) return "Network error. Pull to retry when online.";
  }
  return "Something went wrong. Please try again.";
}
