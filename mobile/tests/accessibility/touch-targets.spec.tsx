import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet, View } from 'react-native';
import { fireEvent } from '@testing-library/react-native';

import { AnnouncementCard } from '@/components/announcements';
import { AuthRolePicker } from '@/components/auth';
import { ClassroomCard, EmptyClassroomState, HomeHeader } from '@/components/home';
import { BackButton, Button, FormField, ScreenState } from '@/components/ui';
import LoginScreen from '../../app/(auth)/login';
import ProfileScreen from '../../app/(app)/(tabs)/profile';
import { darkTheme, lightTheme } from '@/theme';
import { renderWithProviders } from '../helpers/render';

const themePreferences = [
  { name: 'Claro', value: 'light' as const, palette: lightTheme },
  { name: 'Escuro', value: 'dark' as const, palette: darkTheme },
];

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    Ionicons: (props: Record<string, unknown>) => React.createElement(Text, props),
  };
});

type PlatformTarget = {
  name: 'iOS' | 'Android';
  minimum: number;
};

const platformTargets: PlatformTarget[] = [
  { name: 'iOS', minimum: lightTheme.targets.ios },
  { name: 'Android', minimum: lightTheme.targets.android },
];

function flattenPressableStyle(control: { props: { style?: unknown } }, pressed = false) {
  const style = control.props.style as
    ((state: { pressed: boolean }) => unknown) | unknown | undefined;
  return StyleSheet.flatten(typeof style === 'function' ? style({ pressed }) : style) as {
    minHeight?: number;
    minWidth?: number;
    opacity?: number;
    backgroundColor?: string;
  };
}

function expectMinimumTarget(control: { props: { style?: unknown } }, minimum: number) {
  const style = flattenPressableStyle(control);
  expect(style.minHeight ?? 0).toBeGreaterThanOrEqual(minimum);
  expect(style.minWidth ?? 0).toBeGreaterThanOrEqual(minimum);
}

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

describe.each(platformTargets)('$name touch targets', ({ minimum }) => {
  describe.each(themePreferences)('in $name theme', ({ value, palette }) => {
    beforeEach(() => {
      jest.mocked(AsyncStorage.getItem).mockResolvedValue(value);
    });

    it('enforces the platform minimum on shared and route-facing controls', async () => {
      const buttonView = await renderWithProviders(<Button label="Salvar" onPress={jest.fn()} />);
      expectMinimumTarget(buttonView.getByRole('button'), minimum);

      const backView = await renderWithProviders(<BackButton fallbackHref="/login" />);
      expectMinimumTarget(backView.getByRole('button', { name: 'Voltar' }), minimum);

      const stateView = await renderWithProviders(
        <ScreenState
          kind="empty"
          title="Nenhum item"
          actionLabel="Tentar novamente"
          onAction={jest.fn()}
        />,
      );
      expectMinimumTarget(stateView.getByRole('button'), minimum);

      const cardView = await renderWithProviders(
        <ClassroomCard
          name="Historia"
          teacher="Professora Ana"
          actionLabel="Excluir turma"
          onActionPress={jest.fn()}
        />,
      );
      expectMinimumTarget(
        cardView.getByRole('button', { name: 'Excluir turma: Historia' }),
        minimum,
      );

      const roleView = await renderWithProviders(
        <AuthRolePicker value={null} onChange={jest.fn()} />,
      );
      for (const control of roleView.getAllByRole('button')) {
        expectMinimumTarget(control, minimum);
      }
    });

    it('covers detail-card semantics, reading order, pressed feedback, and route action meaning', async () => {
      const announcementView = await renderWithProviders(
        <AnnouncementCard
          title="Aviso da turma"
          content="Conteúdo completo do aviso"
          author="Professora Ana"
          expiresAt={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}
          onPress={jest.fn()}
        />,
      );
      const announcementControl = announcementView.getByRole('button', {
        name: 'Abrir comunicado Aviso da turma',
      });
      const announcementText = collectText(announcementView.toJSON());

      expect(announcementControl.props.accessible).toBe(true);
      expect(announcementControl.props.accessibilityRole).toBe('button');
      expect(announcementControl.props.accessibilityHint).toBe('Abre o comunicado completo.');
      expect(announcementControl.props.focusable ?? true).toBe(true);
      expectMinimumTarget(announcementControl, minimum);
      expect(announcementText.indexOf('Aviso da turma')).toBeLessThan(
        announcementText.findIndex((value) => value.includes('Professor')),
      );
      expect(announcementText.findIndex((value) => value.includes('Professor'))).toBeLessThan(
        announcementText.indexOf('Conteúdo completo do aviso'),
      );
      expect(announcementText.indexOf('Conteúdo completo do aviso')).toBeLessThan(
        announcementText.indexOf('Expira em 1 dia'),
      );

      const routeControls = [
        { label: '+ Novo', accessibilityLabel: 'Criar comunicado', variant: 'primary' as const },
        { label: 'Editar', accessibilityLabel: 'Editar comunicado', variant: 'secondary' as const },
        {
          label: 'Excluir',
          accessibilityLabel: 'Excluir comunicado',
          variant: 'destructive' as const,
        },
        {
          label: 'Sair da turma',
          accessibilityLabel: 'Sair da turma',
          variant: 'destructive' as const,
        },
        {
          label: 'Sair da conta',
          accessibilityLabel: 'Sair da conta',
          variant: 'destructive' as const,
        },
      ];

      for (const routeControl of routeControls) {
        const routeView = await renderWithProviders(
          <Button
            label={routeControl.label}
            accessibilityLabel={routeControl.accessibilityLabel}
            variant={routeControl.variant}
            onPress={jest.fn()}
          />,
        );
        const control = routeView.getByRole('button', { name: routeControl.accessibilityLabel });

        expect(control.props.accessibilityRole).toBe('button');
        expect(control.props.accessibilityLabel).toBe(routeControl.accessibilityLabel);
        expect(control.props.focusable ?? true).toBe(true);
        expectMinimumTarget(control, minimum);

        const style = flattenPressableStyle(control);
        if (routeControl.variant === 'destructive') {
          expect(routeControl.accessibilityLabel).toMatch(/Excluir|Sair/);
          expect(style.backgroundColor).toBe(palette.colors.danger);
          expect(routeView.getByText(routeControl.label)).toBeTruthy();
        }
        await routeView.unmount();
      }
    });

    it('covers primary-surface names, targets, pressed treatment, and explicit semantics', async () => {
      const headerView = await renderWithProviders(<HomeHeader name="Nome da pessoa" />);
      expect(
        headerView.getByRole('header', { name: /Bem-vindo ao Avisa Aí Professor/ }),
      ).toBeTruthy();

      const emptyView = await renderWithProviders(
        <EmptyClassroomState
          title="Nenhuma turma disponível"
          description="Quando houver novas turmas, elas aparecerão aqui."
          onPress={jest.fn()}
        />,
      );
      expect(emptyView.root?.props.accessibilityRole).toBe('summary');
      expect(emptyView.getByRole('header', { name: 'Nenhuma turma disponível' })).toBeTruthy();
      expectMinimumTarget(emptyView.getByRole('button', { name: 'Ver turmas' }), minimum);

      const cardView = await renderWithProviders(
        <ClassroomCard
          name="História do Brasil"
          teacher="Professora Ana"
          lastAnnouncement="Avaliação da próxima semana"
          announcementExpiresAt={new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()}
          actionLabel="Excluir turma"
          onActionPress={jest.fn()}
          onPress={jest.fn()}
        />,
      );
      const openControl = cardView.getByRole('button', { name: 'Abrir turma História do Brasil' });
      const actionControl = cardView.getByRole('button', {
        name: 'Excluir turma: História do Brasil',
      });
      expectMinimumTarget(openControl, minimum);
      expectMinimumTarget(actionControl, minimum);
      expect(actionControl.props.accessibilityLabel).toBe('Excluir turma: História do Brasil');
      expect(
        cardView.getByText('Avaliação da próxima semana').props.accessibilityRole,
      ).toBeUndefined();
      expect(cardView.getByText(/Expira/)).toBeTruthy();
      expect(actionControl.props.accessibilityRole).toBe('button');

      const searchView = await renderWithProviders(
        <View>
          <FormField
            label="Buscar turma pelo nome"
            leadingIcon="search-outline"
            placeholder="Buscar turma pelo nome..."
            error="Use até 80 caracteres na pesquisa"
          />
          <Button
            label="Limpar pesquisa"
            accessibilityLabel="Limpar pesquisa"
            variant="ghost"
            onPress={jest.fn()}
          />
          <ScreenState
            kind="error"
            title="Não foi possível buscar turmas"
            message="Verifique sua conexão e tente novamente."
            actionLabel="Tentar novamente"
            onAction={jest.fn()}
          />
        </View>,
      );
      const searchInput = searchView.getByLabelText('Buscar turma pelo nome');
      const searchStyle = StyleSheet.flatten(searchInput.props.style) as {
        minHeight?: number;
        flex?: number;
      };
      expect(searchStyle.minHeight).toBeGreaterThanOrEqual(minimum);
      expect(searchStyle.flex).toBe(1);
      expect(searchInput.props.accessibilityLabel).toBe('Buscar turma pelo nome');
      expect(searchInput.props.accessibilityHint).toBe('Use até 80 caracteres na pesquisa');
      const searchIcon = searchView.getByTestId('form-field-leading-icon');
      expect(searchIcon.props.name).toBe('search-outline');
      expect(searchIcon.props.accessible).toBe(false);
      expect(searchIcon.props.accessibilityRole).toBeUndefined();

      const clearControl = searchView.getByRole('button', { name: 'Limpar pesquisa' });
      const retryControl = searchView.getByRole('button', { name: 'Tentar novamente' });
      expect(clearControl.props.accessibilityRole).toBe('button');
      expect(clearControl.props.accessibilityLabel).toBe('Limpar pesquisa');
      expect(retryControl.props.accessibilityRole).toBe('button');
      expectMinimumTarget(clearControl, minimum);
      expectMinimumTarget(retryControl, minimum);
      expect(
        searchView.getByText('Use até 80 caracteres na pesquisa').props.accessibilityRole,
      ).toBe('alert');

      const searchReadingOrder = collectText(searchView.toJSON());
      expect(searchReadingOrder.indexOf('Buscar turma pelo nome')).toBeLessThan(
        searchReadingOrder.indexOf('Use até 80 caracteres na pesquisa'),
      );
      expect(searchReadingOrder.indexOf('Use até 80 caracteres na pesquisa')).toBeLessThan(
        searchReadingOrder.indexOf('Limpar pesquisa'),
      );
      expect(searchReadingOrder.indexOf('Limpar pesquisa')).toBeLessThan(
        searchReadingOrder.indexOf('Não foi possível buscar turmas'),
      );
      expect(searchReadingOrder.indexOf('Não foi possível buscar turmas')).toBeLessThan(
        searchReadingOrder.indexOf('Tentar novamente'),
      );
    });

    it('keeps theme choices named, selected, and large enough to tap', async () => {
      const profileView = await renderWithProviders(<ProfileScreen />, {
        auth: {
          user: {
            id: 'user-theme-accessibility',
            name: 'Ana Silva',
            email: 'ana@example.com',
            role: 'PROFESSOR',
          },
          isAuthenticated: true,
          isLoading: false,
        },
      });

      const themeGroup = profileView.getByLabelText('Tema');
      const selectedLabel = value === 'light' ? 'Claro' : 'Escuro';
      const unselectedLabel = value === 'light' ? 'Escuro' : 'Claro';
      const selectedOption = profileView.getByRole('radio', { name: selectedLabel });
      const unselectedOption = profileView.getByRole('radio', { name: unselectedLabel });

      expect(themeGroup.props.accessibilityRole).toBe('radiogroup');
      expect(profileView.getAllByRole('radio')).toHaveLength(2);
      expect(selectedOption.props.accessibilityState.selected).toBe(true);
      expect(unselectedOption.props.accessibilityState.selected).toBe(false);
      expectMinimumTarget(selectedOption, minimum);
      expectMinimumTarget(unselectedOption, minimum);

      await fireEvent.press(unselectedOption);

      expect(
        profileView.getByRole('radio', { name: unselectedLabel }).props.accessibilityState.selected,
      ).toBe(true);
      expect(profileView.getByText(`Tema atual: ${unselectedLabel}`)).toBeTruthy();

      await profileView.unmount();
      jest
        .mocked(AsyncStorage.getItem)
        .mockResolvedValue(unselectedLabel === 'Claro' ? 'light' : 'dark');

      const loginView = await renderWithProviders(<LoginScreen />);
      expect(loginView.getByLabelText('Tema').props.accessibilityRole).toBe('radiogroup');
      expect(loginView.getAllByRole('radio')).toHaveLength(2);
      for (const label of ['Claro', 'Escuro'] as const) {
        const choice = loginView.getByRole('radio', { name: label });
        expect(choice.props.accessibilityState.selected).toBe(label === unselectedLabel);
        expectMinimumTarget(choice, minimum);
      }
      expect(loginView.getByText(`Tema atual: ${unselectedLabel}`)).toBeTruthy();
    });
  });
});
