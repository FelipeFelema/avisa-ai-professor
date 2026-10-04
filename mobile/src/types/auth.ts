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

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface ChangePasswordFeedback {
  status?: number;
  message: string;
  field?: keyof ChangePasswordRequest;
  indeterminate?: boolean;
}

export interface DeleteAccountRequest {
  currentPassword: string;
  confirmationPhrase: string;
}

export interface AccountDeletionImpact {
  role: UserRole;
  canDelete: boolean;
  blockReason: 'LAST_ADMIN_REQUIRED' | null;
  ownedClassroomsCount: number;
  announcementsInOwnedClassroomsCount: number;
  externalMembershipsCount: number;
  authoredAnnouncementsInOtherClassroomsCount: number;
}

export interface AccountDeletionFeedback {
  status?: number;
  message: string;
  field?: keyof DeleteAccountRequest;
  indeterminate?: boolean;
}

export interface SessionCleanupOutcome {
  accessTokenRemoved: boolean;
  refreshTokenRemoved: boolean;
  complete: boolean;
}

export interface AuthContextData {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  applyProfileUpdate: (user: AuthUser, generation?: number) => void;
  expireSession: (generation?: number) => Promise<SessionCleanupOutcome | void>;
  sessionStorageRecoveryRequired?: boolean;
  retrySessionCleanup?: () => Promise<boolean>;
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
