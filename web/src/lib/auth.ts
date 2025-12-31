import { writable, derived } from 'svelte/store';
import { auth as authApi, type User } from './api';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    loading: true,
    initialized: false,
  });

  return {
    subscribe,

    async initialize() {
      update((state) => ({ ...state, loading: true }));
      try {
        const { user } = await authApi.me();
        set({ user, loading: false, initialized: true });
      } catch {
        set({ user: null, loading: false, initialized: true });
      }
    },

    async login(email: string, password: string) {
      const { user } = await authApi.login(email, password);
      set({ user, loading: false, initialized: true });
      return user;
    },

    async register(email: string, password: string) {
      const { user } = await authApi.register(email, password);
      set({ user, loading: false, initialized: true });
      return user;
    },

    async logout() {
      await authApi.logout();
      set({ user: null, loading: false, initialized: true });
    },

    setUser(user: User | null) {
      update((state) => ({ ...state, user }));
    },
  };
}

export const authStore = createAuthStore();

export const isAuthenticated = derived(
  authStore,
  ($auth) => $auth.initialized && $auth.user !== null
);

export const isLoading = derived(authStore, ($auth) => $auth.loading);
