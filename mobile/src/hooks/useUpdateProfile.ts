import { useMutation } from '@tanstack/react-query';

import { useAuth } from '@/hooks/useAuth';
import { updateProfile } from '@/services/auth';
import type { UpdateProfileRequest } from '@/types/auth';

export function useUpdateProfile() {
  const { applyProfileUpdate } = useAuth();

  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => updateProfile(data),
    retry: false,
    onSuccess: (profile) => {
      applyProfileUpdate(profile);
    },
  });
}
