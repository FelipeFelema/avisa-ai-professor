import { useAuth } from '@/hooks/useAuth';
import { useSessionMutation } from '@/hooks/useSessionMutation';
import { updateProfile } from '@/services/auth';
import type { UpdateProfileRequest } from '@/types/auth';

export function useUpdateProfile() {
  const { applyProfileUpdate } = useAuth();

  return useSessionMutation(
    (data: UpdateProfileRequest, generation) =>
      updateProfile(data, { sessionGeneration: generation }),
    {
      onSuccess: (profile, _data, generation) => applyProfileUpdate(profile, generation),
    },
  );
}
