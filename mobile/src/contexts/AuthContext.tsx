import { createContext } from 'react';

import type { AuthContextData } from '@/types/auth';

export const AuthContext = createContext<AuthContextData | undefined>(undefined);
