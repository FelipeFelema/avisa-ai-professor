export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

export type UserRole = 'PARENT' | 'PROFESSOR' | 'ADMIN';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
}

export interface AuthContextData {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  applyProfileUpdate: (user: AuthUser) => void;
  expireSession: () => Promise<void>;
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
