export const USER_NAME_PATTERN = /^[\p{L}\s'-]+$/u;

export function normalizeUserName(name: string): string {
  return name.trim();
}

export function transformUserName(value: unknown): unknown {
  return typeof value === 'string' ? normalizeUserName(value) : value;
}

export function normalizeUserEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function transformUserEmail(value: unknown): unknown {
  return typeof value === 'string' ? normalizeUserEmail(value) : value;
}

export type UserProfileInput = {
  name?: string;
  email?: string;
};

export function normalizeUserProfile(
  input: UserProfileInput,
): UserProfileInput {
  return {
    ...(input.name !== undefined
      ? { name: normalizeUserName(input.name) }
      : {}),
    ...(input.email !== undefined
      ? { email: normalizeUserEmail(input.email) }
      : {}),
  };
}
