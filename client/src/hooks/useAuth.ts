import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface LoginData {
  email: string;
  password: string;
  useTempUser?: boolean;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: string;
  departmentId?: number;
}

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: !!localStorage.getItem('auth_token'),
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      const res = await apiRequest('POST', '/api/auth/login', data);
      return res.json();
    },
    onSuccess: (data: { token: string; user: User }) => {
      localStorage.setItem('auth_token', data.token);
      queryClient.setQueryData(["/api/auth/user"], data.user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const res = await apiRequest('POST', '/api/auth/register', data);
      return res.json();
    },
    onSuccess: (data: { token: string; user: User }) => {
      localStorage.setItem('auth_token', data.token);
      queryClient.setQueryData(["/api/auth/user"], data.user);
    },
  });

  const logout = () => {
    localStorage.removeItem('auth_token');
    queryClient.setQueryData(["/api/auth/user"], null);
    queryClient.clear();
    window.location.href = "/?showLogin=true";
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout,
    isLoginLoading: loginMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
  };
}
