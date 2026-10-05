export type TeacherInviteResult = Readonly<{
  id: string;
  code: string;
  role: 'PROFESSOR';
  isActive: true;
  createdAt: string;
  expiresAt: string;
  updatedAt: string;
}>;

export type TeacherInviteAccessState = 'checking' | 'authorized' | 'indeterminate' | 'invalid';

export type TeacherInviteFeedback =
  | { kind: 'none' }
  | { kind: 'success'; category: 'generated' | 'copied' }
  | {
      kind: 'error';
      category: 'forbidden' | 'unavailable' | 'copy-failed' | 'invalid-response';
    }
  | { kind: 'uncertain'; category: 'delivery-unconfirmed' };

export type TeacherInviteOperationState = 'idle' | 'generating' | 'copying';

export type TeacherInviteViewState = Readonly<{
  access: TeacherInviteAccessState;
  operation: TeacherInviteOperationState;
  result?: TeacherInviteResult;
  feedback: TeacherInviteFeedback;
}>;
