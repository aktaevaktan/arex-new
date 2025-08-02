"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
  });
  const router = useRouter();

  const checkAuth = async () => {
    try {
      // Attempt to verify the current session
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include", // Ensure cookies are sent
      });

      if (response.ok) {
        const userData = await response.json();
        if (userData.success) {
          console.log("Auth check: User is authenticated", userData.user);
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user: userData.user,
          });
          return true;
        }
      }

      // If not authenticated, try to refresh the token
      const refreshResponse = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (refreshResponse.ok) {
        // Refresh successful, re-check authentication
        const verifyResponse = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
        });

        if (verifyResponse.ok) {
          const userData = await verifyResponse.json();
          if (userData.success) {
            console.log(
              "Auth check after refresh: User is authenticated",
              userData.user
            );
            setAuthState({
              isAuthenticated: true,
              isLoading: false,
              user: userData.user,
            });
            return true;
          }
        }
      }

      // Authentication failed
      console.log("Auth check: User is not authenticated");
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      });
      return false;
    } catch (error) {
      console.error("Auth check error:", error);
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      });
      return false;
    }
  };

  const logout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        console.log("Logout successful");
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      });
      router.push("/auth/login");
    }
  };

  const redirectToLogin = () => {
    console.log("Redirecting to /auth/login");
    router.push("/auth/login");
  };

  const redirectToAdmin = () => {
    console.log("Redirecting to /crm/admin");
    router.push("/crm/admin");
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return {
    ...authState,
    checkAuth,
    logout,
    redirectToLogin,
    redirectToAdmin,
  };
}

export function useRequireAuth() {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      console.log("useRequireAuth: Not authenticated, redirecting to login");
      auth.redirectToLogin();
    }
  }, [auth.isLoading, auth.isAuthenticated]);

  return auth;
}

export function useRedirectIfAuthenticated() {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      console.log(
        "useRedirectIfAuthenticated: Authenticated, redirecting to admin"
      );
      auth.redirectToAdmin();
    }
  }, [auth.isLoading, auth.isAuthenticated]);

  return auth;
}
