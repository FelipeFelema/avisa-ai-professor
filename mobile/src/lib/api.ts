import { create } from 'axios';

import { env } from '@/config';

export const api = create({
  baseURL: env.apiUrl,
  timeout: 10000,
});
