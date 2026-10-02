import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { AnnouncementCard } from '@/components/announcements';
import { AuthRolePicker } from '@/components/auth';
import { ClassroomCard, EmptyClassroomState, HomeHeader } from '@/components/home';
import { BackButton, Button, FormField, ScreenState } from '@/components/ui';
import { theme } from '@/theme';

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
  { name: 'iOS', minimum: theme.targets.ios },
  { name: 'Android', minimum: theme.targets.android },
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
  it('enforces the platform minimum on shared and route-facing controls', async () => {
    const buttonView = await render(<Button label="Salvar" onPress={jest.fn()} />);
    expectMinimumTarget(buttonView.getByRole('button'), minimum);

    const backView = await render(<BackButton fallbackHref="/login" />);
    expectMinimumTarget(backView.getByRole('button', { name: 'Voltar' }), minimum);

    const stateView = await render(
      <ScreenState
        kind="empty"
        title="Nenhum item"
        actionLabel="Tentar novamente"
        onAction={jest.fn()}
      />,
    );
    expectMinimumTarget(stateView.getByRole('button'), minimum);

    const cardView = await render(
      <ClassroomCard
        name="Historia"
        teacher="Professora Ana"
        actionLabel="Excluir turma"
        onActionPress={jest.fn()}
      />,
    );
    expectMinimumTarget(cardView.getByRole('button', { name: 'Excluir turma: Historia' }), minimum);

    const roleView = await render(<AuthRolePicker value={null} onChange={jest.fn()} />);
    for (const control of roleView.getAllByRole('button')) {
      expectMinimumTarget(control, minimum);
    }
  });

  it('covers detail-card semantics, reading order, pressed feedback, and route action meaning', async () => {
    const announcementView = await render(
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

    const announcementElement = AnnouncementCard({
      title: 'Aviso da turma',
      content: 'Conteúdo completo do aviso',
      author: 'Professora Ana',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      onPress: jest.fn(),
    }) as unknown as { props: { style?: unknown } };
    const announcementStyle = flattenPressableStyle(announcementElement);
    expect(flattenPressableStyle(announcementElement, true).opacity).toBeLessThan(
      announcementStyle.opacity ?? 1,
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
      const routeView = await render(
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

      const buttonElement = Button({
        label: routeControl.label,
        accessibilityLabel: routeControl.accessibilityLabel,
        variant: routeControl.variant,
        onPress: jest.fn(),
      }) as unknown as { props: { style?: unknown } };
      const style = flattenPressableStyle(buttonElement);
      if (routeControl.variant === 'destructive') {
        expect(routeControl.accessibilityLabel).toMatch(/Excluir|Sair/);
        expect(style.backgroundColor).toBe(theme.colors.danger);
      }
      expect(flattenPressableStyle(buttonElement, true).opacity).toBeLessThan(style.opacity ?? 1);

      await routeView.unmount();
    }
  });

  it('covers primary-surface names, targets, pressed treatment, and explicit semantics', async () => {
    const headerView = await render(<HomeHeader name="Nome da pessoa" />);
    expect(
      headerView.getByRole('header', { name: /Bem-vindo ao Avisa Aí Professor/ }),
    ).toBeTruthy();

    const emptyView = await render(
      <EmptyClassroomState
        title="Nenhuma turma disponível"
        description="Quando houver novas turmas, elas aparecerão aqui."
        onPress={jest.fn()}
      />,
    );
    expect(emptyView.root?.props.accessibilityRole).toBe('summary');
    expect(emptyView.getByRole('header', { name: 'Nenhuma turma disponível' })).toBeTruthy();
    expectMinimumTarget(emptyView.getByRole('button', { name: 'Ver turmas' }), minimum);

    const cardView = await render(
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
    const cardElement = ClassroomCard({
      name: 'História do Brasil',
      teacher: 'Professora Ana',
      onPress: jest.fn(),
    }) as unknown as {
      props: { children: Array<{ props?: { style?: unknown } } | null> };
    };
    const cardPressStyle = cardElement.props.children[0]?.props?.style;
    expect(flattenPressableStyle({ props: { style: cardPressStyle } }, true).opacity).toBeLessThan(
      flattenPressableStyle({ props: { style: cardPressStyle } }).opacity ?? 1,
    );

    const buttonElement = Button({ label: 'Excluir turma', onPress: jest.fn() }) as unknown as {
      props: { style?: unknown };
    };
    expect(flattenPressableStyle(buttonElement, true).opacity).toBeLessThan(
      flattenPressableStyle(buttonElement).opacity ?? 1,
    );

    expect(actionControl.props.accessibilityLabel).toBe('Excluir turma: História do Brasil');
    expect(
      cardView.getByText('Avaliação da próxima semana').props.accessibilityRole,
    ).toBeUndefined();
    expect(cardView.getByText(/Expira/)).toBeTruthy();
    expect(actionControl.props.accessibilityRole).toBe('button');

    const searchView = await render(
      <FormField label="Buscar turmas" leadingIcon="search-outline" placeholder="Buscar" />,
    );
    const searchInput = searchView.getByLabelText('Buscar turmas');
    const searchStyle = StyleSheet.flatten(searchInput.props.style) as {
      minHeight?: number;
      flex?: number;
    };
    expect(searchStyle.minHeight).toBeGreaterThanOrEqual(minimum);
    expect(searchStyle.flex).toBe(1);
    const searchIcon = searchView.getByTestId('form-field-leading-icon');
    expect(searchIcon.props.name).toBe('search-outline');
    expect(searchIcon.props.accessible).toBe(false);
    expect(searchIcon.props.accessibilityRole).toBeUndefined();
  });
});
