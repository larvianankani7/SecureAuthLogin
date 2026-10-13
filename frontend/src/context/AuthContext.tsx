import {
  createContext,
  useContext,
  useState,
  useEffect
} from 'react';
import type { ReactNode } from 'react';
import { API_BASE_URL } from '../lib/api';

export type User = {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'admin';
  createdAt: string;
};

type AuthContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  );

export function AuthProvider({
  children
}: {
  children: ReactNode;
}) {
  const [user, setUser] =
    useState<User | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/users/me`,
            {
              credentials: 'include'
            }
          );

        if (response.ok) {
          const data =
            await response.json();

          if (!cancelled) {
            setUser(data.user ?? null);
          }

          return;
        }

        if (response.status !== 401) {
          if (!cancelled) {
            setUser(null);
          }

          return;
        }

        const refreshResponse =
          await fetch(
            `${API_BASE_URL}/api/auth/refresh`,
            {
              method: 'POST',
              credentials: 'include'
            }
          );

        if (!refreshResponse.ok) {
          if (!cancelled) {
            setUser(null);
          }

          return;
        }

        const refreshData =
          await refreshResponse.json();

        if (!cancelled) {
          setUser(
            refreshData.user ?? null
          );
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void initAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = async () => {
    try {
      await fetch(
        `${API_BASE_URL}/api/auth/logout`,
        {
          method: 'POST',
          credentials: 'include'
        }
      );
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        logout,
        isLoading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within AuthProvider'
    );
  }

  return context;
}