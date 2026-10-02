import { fireEvent } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import LoginScreen from '../../app/(auth)/login';
import RegisterScreen from '../../app/(auth)/register';
import HomeScreen from '../../app/(app)/(tabs)/index';
import ClassroomsScreen from '../../app/(app)/(tabs)/classrooms';
import ProfileScreen from '../../app/(app)/(tabs)/profile';
import AnnouncementDetailsScreen from '../../app/(app)/announcements/[id]';
import EditAnnouncementScreen from '../../app/(app)/announcements/[id]/edit';
import ClassroomDetailsScreen from '../../app/(app)/classrooms/[id]';
import NewAnnouncementScreen from '../../app/(app)/classrooms/[id]/new-announcement';
import NewClassroomScreen from '../../app/(app)/classrooms/new';
import ProfileEditScreen from '../../app/(app)/profile/edit';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import { useAuth } from '@/hooks/useAuth';
import { useClassroomAnnouncements } from '@/hooks/useClassroomAnnouncements';
import { useCreateAnnouncement } from '@/hooks/useCreateAnnouncement';
import { useCreateClassroom } from '@/hooks/useCreateClassroom';
import { useDeleteAnnouncement } from '@/hooks/useDeleteAnnouncement';
import { useDeleteClassroom } from '@/hooks/useDeleteClassroom';
import { useJoinClassroom } from '@/hooks/useJoinClassroom';
import { useLeaveClassroom } from '@/hooks/useLeaveClassroom';
import { useMyClassrooms } from '@/hooks/useMyClassrooms';
import { useAvailableClassrooms } from '@/hooks/useAvailableClassrooms';
import { useUpdateAnnouncement } from '@/hooks/useUpdateAnnouncement';
import { useUpdateProfile } from '@/hooks/useUpdateProfile';
import { renderWithProviders } from '../helpers/render';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/hooks/useAnnouncement', () => ({ useAnnouncement: jest.fn() }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useClassroomAnnouncements', () => ({
  useClassroomAnnouncements: jest.fn(),
}));
jest.mock('@/hooks/useCreateAnnouncement', () => ({ useCreateAnnouncement: jest.fn() }));
jest.mock('@/hooks/useCreateClassroom', () => ({ useCreateClassroom: jest.fn() }));
jest.mock('@/hooks/useDeleteAnnouncement', () => ({ useDeleteAnnouncement: jest.fn() }));
jest.mock('@/hooks/useDeleteClassroom', () => ({ useDeleteClassroom: jest.fn() }));
jest.mock('@/hooks/useJoinClassroom', () => ({ useJoinClassroom: jest.fn() }));
jest.mock('@/hooks/useLeaveClassroom', () => ({ useLeaveClassroom: jest.fn() }));
jest.mock('@/hooks/useMyClassrooms', () => ({ useMyClassrooms: jest.fn() }));
jest.mock('@/hooks/useAvailableClassrooms', () => ({ useAvailableClassrooms: jest.fn() }));
jest.mock('@/hooks/useUpdateAnnouncement', () => ({ useUpdateAnnouncement: jest.fn() }));
jest.mock('@/hooks/useUpdateProfile', () => ({ useUpdateProfile: jest.fn() }));

const mockUseRouter = jest.mocked(useRouter);
const mockUseLocalSearchParams = jest.mocked(useLocalSearchParams);
const mockUseAnnouncement = jest.mocked(useAnnouncement);
const mockUseAuth = jest.mocked(useAuth);
const mockUseClassroomAnnouncements = jest.mocked(useClassroomAnnouncements);
const mockUseCreateAnnouncement = jest.mocked(useCreateAnnouncement);
const mockUseCreateClassroom = jest.mocked(useCreateClassroom);
const mockUseDeleteAnnouncement = jest.mocked(useDeleteAnnouncement);
const mockUseDeleteClassroom = jest.mocked(useDeleteClassroom);
const mockUseJoinClassroom = jest.mocked(useJoinClassroom);
const mockUseLeaveClassroom = jest.mocked(useLeaveClassroom);
const mockUseMyClassrooms = jest.mocked(useMyClassrooms);
const mockUseAvailableClassrooms = jest.mocked(useAvailableClassrooms);
const mockUseUpdateAnnouncement = jest.mocked(useUpdateAnnouncement);
const mockUseUpdateProfile = jest.mocked(useUpdateProfile);

const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(),
};

const classroom = {
  id: 'classroom-1',
  name: 'História do Brasil',
  ownerId: 'owner-1',
  teacher: { id: 'owner-1', name: 'Prof. Ana' },
  lastAnnouncement: null,
};

const announcement = {
  id: 'announcement-1',
  classroomId: classroom.id,
  title: 'Aviso atual',
  content: 'Conteúdo atual',
  createdAt: '2026-09-01T00:00:00.000Z',
  expiresAt: '2026-09-08T00:00:00.000Z',
  author: { id: 'teacher-1', name: 'Prof. Ana' },
};

const user = {
  id: 'teacher-1',
  name: 'Prof. Ana',
  email: 'ana@example.com',
  role: 'PROFESSOR' as const,
};

function configureRouter(canGoBack = false) {
  router.canGoBack.mockReturnValue(canGoBack);
  mockUseRouter.mockReturnValue(router as unknown as ReturnType<typeof useRouter>);
}

function configureLoadedState() {
  mockUseLocalSearchParams.mockReturnValue({ id: classroom.id });
  mockUseAuth.mockReturnValue({ user, isLoading: false } as never);
  mockUseMyClassrooms.mockReturnValue({
    data: [classroom],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  } as never);
  mockUseClassroomAnnouncements.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: jest.fn(),
  } as never);
  mockUseAnnouncement.mockReturnValue({
    data: announcement,
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: jest.fn(),
  } as never);
  mockUseCreateClassroom.mockReturnValue({ mutateAsync: jest.fn(), isPending: false } as never);
  mockUseCreateAnnouncement.mockReturnValue({ mutateAsync: jest.fn(), isPending: false } as never);
  mockUseDeleteAnnouncement.mockReturnValue({ mutateAsync: jest.fn(), isPending: false } as never);
  mockUseDeleteClassroom.mockReturnValue({ mutate: jest.fn(), isPending: false } as never);
  mockUseLeaveClassroom.mockReturnValue({ mutate: jest.fn(), isPending: false } as never);
  mockUseUpdateAnnouncement.mockReturnValue({ mutateAsync: jest.fn(), isPending: false } as never);
  mockUseUpdateProfile.mockReturnValue({ mutateAsync: jest.fn(), isPending: false } as never);
  mockUseJoinClassroom.mockReturnValue({ mutate: jest.fn(), isPending: false } as never);
  mockUseAvailableClassrooms.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  } as never);
}

function resetRouterCalls() {
  router.push.mockClear();
  router.replace.mockClear();
  router.back.mockClear();
  router.canGoBack.mockClear();
}

beforeEach(() => {
  jest.clearAllMocks();
  configureRouter(false);
  configureLoadedState();
});

describe('secondary route navigation matrix', () => {
  it('renders one visual back control and uses the expected fallback on every secondary route', async () => {
    const cases = [
      { name: 'register', fallback: '/login', element: <RegisterScreen /> },
      { name: 'new classroom', fallback: '/classrooms', element: <NewClassroomScreen /> },
      {
        name: 'classroom details',
        fallback: '/classrooms',
        element: <ClassroomDetailsScreen />,
      },
      {
        name: 'new announcement',
        fallback: `/classrooms/${classroom.id}`,
        element: <NewAnnouncementScreen />,
      },
      {
        name: 'announcement details',
        fallback: `/classrooms/${classroom.id}`,
        element: <AnnouncementDetailsScreen />,
      },
      {
        name: 'announcement edit',
        fallback: `/announcements/${announcement.id}`,
        element: <EditAnnouncementScreen />,
      },
      { name: 'profile edit', fallback: '/profile', element: <ProfileEditScreen /> },
    ];

    for (const route of cases) {
      resetRouterCalls();
      configureRouter(false);
      const view = await renderWithProviders(route.element);
      const controls = view.getAllByRole('button', { name: 'Voltar' });

      expect(controls).toHaveLength(1);
      await fireEvent.press(controls[0]);
      expect(router.canGoBack).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith(route.fallback);
      expect(router.back).not.toHaveBeenCalled();
      await view.unmount();
    }
  });

  it('prefers immediate history over the fallback for a secondary route', async () => {
    configureRouter(true);
    const view = await renderWithProviders(<AnnouncementDetailsScreen />);

    await fireEvent.press(view.getByRole('button', { name: 'Voltar' }));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('keeps the visual return control mounted through loading, error, and not-found states', async () => {
    mockUseMyClassrooms.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: jest.fn(),
    } as never);
    let view = await renderWithProviders(<ClassroomDetailsScreen />);
    expect(view.getByRole('button', { name: 'Voltar' })).toBeTruthy();
    await view.unmount();

    mockUseMyClassrooms.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: jest.fn(),
    } as never);
    view = await renderWithProviders(<ClassroomDetailsScreen />);
    expect(view.getByRole('button', { name: 'Voltar' })).toBeTruthy();
    await view.unmount();

    mockUseMyClassrooms.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as never);
    view = await renderWithProviders(<ClassroomDetailsScreen />);
    expect(view.getByRole('button', { name: 'Voltar' })).toBeTruthy();
    await view.unmount();

    mockUseAnnouncement.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: undefined,
      refetch: jest.fn(),
    } as never);
    view = await renderWithProviders(<AnnouncementDetailsScreen />);
    expect(view.getByRole('button', { name: 'Voltar' })).toBeTruthy();
    await view.unmount();

    mockUseAnnouncement.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: undefined,
      refetch: jest.fn(),
    } as never);
    view = await renderWithProviders(<EditAnnouncementScreen />);
    expect(view.getAllByRole('button', { name: 'Voltar' }).length).toBeGreaterThanOrEqual(1);
  });

  it('uses the classroom-list fallback for announcement error and absent-item states', async () => {
    configureRouter(false);
    mockUseAnnouncement.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('network timeout'),
      refetch: jest.fn(),
    } as never);
    let view = await renderWithProviders(<AnnouncementDetailsScreen />);

    await fireEvent.press(view.getAllByRole('button', { name: 'Voltar' })[0]);
    expect(router.replace).toHaveBeenCalledWith('/classrooms');
    await view.unmount();

    configureRouter(false);
    mockUseAnnouncement.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: undefined,
      refetch: jest.fn(),
    } as never);
    view = await renderWithProviders(<AnnouncementDetailsScreen />);

    await fireEvent.press(view.getAllByRole('button', { name: 'Voltar' })[0]);
    expect(router.replace).toHaveBeenCalledWith('/classrooms');
  });

  it('does not add the control to Login, Home, Classrooms, or Profile roots', async () => {
    const roots = [
      <LoginScreen key="login" />,
      <HomeScreen key="home" />,
      <ClassroomsScreen key="classrooms" />,
      <ProfileScreen key="profile" />,
    ];

    for (const root of roots) {
      const view = await renderWithProviders(root);
      expect(view.queryByRole('button', { name: 'Voltar' })).toBeNull();
      await view.unmount();
    }
  });
});
