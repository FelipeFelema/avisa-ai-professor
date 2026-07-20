export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface AuthContextData {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  teacherCode?: string;
}

export interface RegisterResponse {
  accessToken: string;
  refreshToken: string;
}
