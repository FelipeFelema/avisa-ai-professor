import { fireEvent, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import AnnouncementDetailsScreen from '../../app/(app)/announcements/[id]';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import { useAuth } from '@/hooks/useAuth';
import { darkTheme, lightTheme } from '@/theme';
import { renderWithProviders } from '../helpers/render';
import { ThemeSwitcher } from '../helpers/theme';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/hooks/useAnnouncement', () => ({ useAnnouncement: jest.fn() }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));

const mockUseRouter = jest.mocked(useRouter);
const mockUseLocalSearchParams = jest.mocked(useLocalSearchParams);
const mockUseAnnouncement = jest.mocked(useAnnouncement);
const mockUseAuth = jest.mocked(useAuth);

const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(),
};

const announcement = {
  id: 'announcement-1',
  classroomId: 'classroom-1',
  title: 'Aviso atual',
  content: 'Linha 1\n\nLinha 2\nLinha 3',
  createdAt: '2026-09-01T12:00:00.000Z',
  expiresAt: '2026-10-04T12:00:00.000Z',
  author: { id: 'teacher-1', name: 'Prof. Ana' },
};

function collectText(node: unknown, result: string[] = []): string[] {
  if (typeof node === 'string') {
    result.push(node);
    return result;
  }

  if (Array.isArray(node)) {
    node.forEach((child) => collectText(child, result));
    return result;
  }

  if (node && typeof node === 'object' && 'children' in node) {
    collectText((node as { children?: unknown }).children, result);
  }

  return result;
}

function setAnnouncementContext() {
  mockUseRouter.mockReturnValue(router as unknown as ReturnType<typeof useRouter>);
  mockUseLocalSearchParams.mockReturnValue({ id: announcement.id });
  mockUseAuth.mockReturnValue({
    user: {
      id: announcement.author.id,
      name: announcement.author.name,
      email: 'ana@example.com',
      role: 'PROFESSOR',
    },
  } as never);
  mockUseAnnouncement.mockReturnValue({
    data: announcement,
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: jest.fn(),
  } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  setAnnouncementContext();
});

describe('announcement detail route', () => {
  it('renders the complete reading hierarchy, line breaks, dates, and author actions', async () => {
    const view = await renderWithProviders(
      <>
        <AnnouncementDetailsScreen />
        <ThemeSwitcher />
      </>,
    );
    const text = collectText(view.toJSON());
    const publishedDate = new Date(announcement.createdAt).toLocaleDateString('pt-BR');
    const expirationDate = new Date(announcement.expiresAt).toLocaleDateString('pt-BR');

    expect(view.getByRole('header', { name: announcement.title })).toBeTruthy();
    expect(text.indexOf(announcement.title)).toBeLessThan(
      text.findIndex((value) => value.includes('Professor')),
    );
    expect(text.findIndex((value) => value.includes('Professor'))).toBeLessThan(
      text.indexOf('Publicado em'),
    );
    expect(text.indexOf('Publicado em')).toBeLessThan(text.indexOf(publishedDate));
    expect(text.indexOf(publishedDate)).toBeLessThan(text.indexOf('Expira em'));
    expect(text.indexOf('Expira em')).toBeLessThan(text.indexOf(expirationDate));
    expect(text.indexOf(expirationDate)).toBeLessThan(text.indexOf(announcement.content));

    const body = view.getByText(announcement.content);
    expect(
      StyleSheet.flatten(view.getByRole('header', { name: announcement.title }).props.style).color,
    ).toBe(lightTheme.colors.text);
    expect(body.props.numberOfLines).toBeUndefined();
    expect(view.getByText(publishedDate)).toBeTruthy();
    expect(view.getByText(expirationDate)).toBeTruthy();
    expect(view.getByRole('button', { name: 'Editar comunicado' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Excluir comunicado' })).toBeTruthy();

    await fireEvent.press(view.getByText('Select Escuro'));
    expect(
      StyleSheet.flatten(view.getByRole('header', { name: announcement.title }).props.style).color,
    ).toBe(darkTheme.colors.text);
    expect(view.getByText(announcement.content)).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Editar comunicado' }));
    expect(router.push).toHaveBeenCalledWith('/announcements/announcement-1/edit');
  });

  it('shows no reserved author action area for a non-author', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'parent-1',
        name: 'Pessoa leitora',
        email: 'parent@example.com',
        role: 'PARENT',
      },
    } as never);

    const view = await renderWithProviders(<AnnouncementDetailsScreen />);

    expect(view.queryByRole('button', { name: 'Editar comunicado' })).toBeNull();
    expect(view.queryByRole('button', { name: 'Excluir comunicado' })).toBeNull();
  });

  it('keeps long title, authorship, and body values readable without line limits', async () => {
    const longTitle =
      'Aviso muito extenso sobre a organização das atividades e dos prazos desta turma';
    const longAuthor = 'Professora responsável por comunicados de acompanhamento';
    const longContent =
      'Parágrafo inicial com orientações importantes para a turma.\n\n' +
      'Segundo parágrafo com detalhes adicionais que precisam continuar disponíveis durante a leitura.';
    const longAnnouncement = {
      ...announcement,
      title: longTitle,
      content: longContent,
      author: { ...announcement.author, name: longAuthor },
    };
    mockUseAnnouncement.mockReturnValue({
      data: longAnnouncement,
      isLoading: false,
      isError: false,
      error: undefined,
      refetch: jest.fn(),
    } as never);

    const view = await renderWithProviders(<AnnouncementDetailsScreen />);

    expect(view.getByText(longTitle).props.numberOfLines).toBeUndefined();
    expect(view.getByText(`Professor • ${longAuthor}`)).toBeTruthy();
    expect(view.getByText(longContent).props.numberOfLines).toBeUndefined();
  });

  it('keeps retry and safe return through loading, recoverable error, 404, and missing states', async () => {
    const refetch = jest.fn();
    mockUseAnnouncement.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: undefined,
      refetch,
    } as never);
    let view = await renderWithProviders(<AnnouncementDetailsScreen />);
    expect(view.getByText('Carregando comunicado')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Voltar' })).toBeTruthy();
    await view.unmount();

    mockUseAnnouncement.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('network timeout'),
      refetch,
    } as never);
    view = await renderWithProviders(<AnnouncementDetailsScreen />);
    expect(view.getByText('Não foi possível carregar o comunicado')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetch).toHaveBeenCalledTimes(1);
    await view.unmount();

    mockUseAnnouncement.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { isAxiosError: true, response: { status: 404 } },
      refetch,
    } as never);
    view = await renderWithProviders(<AnnouncementDetailsScreen />);
    expect(view.getByText('Comunicado não encontrado')).toBeTruthy();
    const notFoundActions = view.getAllByRole('button', { name: 'Voltar' });
    await fireEvent.press(notFoundActions.at(-1)!);
    expect(router.back).toHaveBeenCalledTimes(1);
    await view.unmount();

    mockUseAnnouncement.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: undefined,
      refetch,
    } as never);
    view = await renderWithProviders(<AnnouncementDetailsScreen />);
    expect(view.getByText('Comunicado não encontrado')).toBeTruthy();
    const missingActions = view.getAllByRole('button', { name: 'Voltar' });
    await fireEvent.press(missingActions.at(-1)!);
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(2));
  });
});
