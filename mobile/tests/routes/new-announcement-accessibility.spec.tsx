import { fireEvent, waitFor } from '@testing-library/react-native';

import NewAnnouncementScreen from '../../app/(app)/classrooms/[id]/new-announcement';
import { useCreateAnnouncement } from '@/hooks/useCreateAnnouncement';
import { renderWithProviders } from '../helpers/render';
import { theme } from '@/theme';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: 'classroom-1' })),
}));
jest.mock('@/hooks/useCreateAnnouncement', () => ({
  useCreateAnnouncement: jest.fn(),
}));

const mockUseCreateAnnouncement = jest.mocked(useCreateAnnouncement);

function setCreateAnnouncementState(isPending = false) {
  mockUseCreateAnnouncement.mockReturnValue({
    mutateAsync: jest.fn(),
    isPending,
  } as never);
}

describe('new announcement accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setCreateAnnouncementState();
  });

  it('labels the fields and exposes duration selection semantics and target sizes', async () => {
    const view = await renderWithProviders(<NewAnnouncementScreen />);

    const titleInput = view.getByPlaceholderText('Digite o título');
    const contentInput = view.getByPlaceholderText('Digite o comunicado...');
    expect(titleInput.props.accessibilityLabel).toBe('Título do comunicado');
    expect(titleInput.props.accessibilityHint).toBe('Informe o título do comunicado.');
    expect(contentInput.props.accessibilityLabel).toBe('Conteúdo do comunicado');
    expect(contentInput.props.accessibilityHint).toBe('Informe o conteúdo do comunicado.');

    const durations = ['1 dia', '3 dias', '7 dias', '15 dias', '30 dias'].map((label) =>
      view.getByRole('button', { name: label }),
    );
    for (const duration of durations) {
      expect(duration.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: false, selected: expect.any(Boolean) }),
      );
      expect(duration.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ minHeight: theme.targets.android })]),
      );
    }
    expect(view.getByRole('button', { name: '7 dias' }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
  });

  it('exposes disabled and busy semantics and targets while publishing', async () => {
    setCreateAnnouncementState(true);
    const view = await renderWithProviders(<NewAnnouncementScreen />);
    const publish = view.getByRole('button', { name: 'Publicar comunicado' });

    expect(publish.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(publish.props.style).toEqual(
      expect.objectContaining({
        minHeight: theme.targets.android,
        minWidth: theme.targets.android,
      }),
    );
    for (const duration of ['1 dia', '3 dias', '7 dias', '15 dias', '30 dias'].map((label) =>
      view.getByRole('button', { name: label }),
    )) {
      expect(duration.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true }),
      );
    }
  });

  it('announces validation errors as alerts without submitting', async () => {
    const mutateAsync = jest.fn();
    mockUseCreateAnnouncement.mockReturnValue({ mutateAsync, isPending: false } as never);
    const view = await renderWithProviders(<NewAnnouncementScreen />);

    await fireEvent.press(view.getByRole('button', { name: 'Publicar comunicado' }));

    await waitFor(() => {
      expect(view.getAllByRole('alert').length).toBeGreaterThanOrEqual(2);
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
