export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthContextData {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: () => Promise<void>;
  logout: () => Promise<void>;
}
