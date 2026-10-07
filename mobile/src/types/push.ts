import type {
  activatePushSchema,
  emptyPushRequestSchema,
  pushBindingViewSchema,
  pushInstallationHeadersSchema,
  pushInstallationViewSchema,
  pushTestAcceptedSchema,
  revokePushSchema,
} from '@/validations/push.schema';
import type { z } from 'zod';

export type PushInstallationHeaders = z.infer<typeof pushInstallationHeadersSchema>;
export type ActivatePushRequest = z.infer<typeof activatePushSchema>;
export type RevokePushRequest = z.infer<typeof revokePushSchema>;
export type EmptyPushRequest = z.infer<typeof emptyPushRequestSchema>;
export type PushBindingView = z.infer<typeof pushBindingViewSchema>;
export type PushInstallationView = z.infer<typeof pushInstallationViewSchema>;
export type PushTestAccepted = z.infer<typeof pushTestAcceptedSchema>;

export interface PushInstallationIdentity {
  installationId: string;
  capability: string;
}

export interface PushCurrentBinding {
  bindingId: string;
  lifecycleVersion: number;
}

export interface PushPendingRevocation extends PushCurrentBinding {
  installationId: string;
  capability: string;
  reason: 'USER_DISABLED' | 'LOGOUT' | 'PERMISSION_REVOKED';
}
