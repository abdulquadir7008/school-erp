import { create } from "zustand";
import { clearTokens, getApiErrorMessage, getTokens, setTokens } from "../api/client";
import { fetchProfile, loginRequest, logoutRequest, Profile } from "../api/mobile";

interface AuthState {
  user: Profile | null;
  role: "STUDENT" | "TEACHER" | null;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  hydrate: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

function roleOf(profile: Profile | null): "STUDENT" | "TEACHER" | null {
  if (!profile) return null;
  if (profile.role === "TEACHER") return "TEACHER";
  if (profile.role === "STUDENT") return "STUDENT";
  // Any other role is not allowed in the mobile app (admins use the web dashboard)
  return null;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  isLoading: false,
  isHydrated: false,
  error: null,

  login: async (identifier, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await loginRequest(identifier.trim(), password);
      await setTokens(data.accessToken, data.refreshToken);
      const profile = await fetchProfile();
      const role = roleOf(profile);
      if (!role) {
        await clearTokens();
        throw new Error("This app is for students and teachers. Please use the web dashboard.");
      }
      set({ user: profile, role, isLoading: false });
    } catch (e: any) {
      const message = getApiErrorMessage(e);
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  hydrate: async () => {
    try {
      const { accessToken } = await getTokens();
      if (!accessToken) {
        set({ isHydrated: true });
        return;
      }
      const profile = await fetchProfile();
      const role = roleOf(profile);
      if (!role) {
        await clearTokens();
        set({ user: null, role: null, isHydrated: true });
        return;
      }
      set({ user: profile, role, isHydrated: true });
    } catch {
      await clearTokens();
      set({ user: null, role: null, isHydrated: true });
    }
  },

  refreshProfile: async () => {
    const profile = await fetchProfile();
    set({ user: profile, role: roleOf(profile) });
  },

  logout: async () => {
    try {
      const { refreshToken } = await getTokens();
      await logoutRequest(refreshToken);
    } catch {
      // ignore — clear locally regardless
    } finally {
      await clearTokens();
      set({ user: null, role: null });
    }
  },
}));
