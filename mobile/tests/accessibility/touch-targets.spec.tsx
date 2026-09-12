import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { AuthRolePicker } from '@/components/auth';
import { ClassroomCard } from '@/components/home';
import { Button, ScreenState } from '@/components/ui';
import { theme } from '@/theme';

type PlatformTarget = {
  name: 'iOS' | 'Android';
  minimum: number;
};

const platformTargets: PlatformTarget[] = [
  { name: 'iOS', minimum: theme.targets.ios },
  { name: 'Android', minimum: theme.targets.android },
];

function flattenPressableStyle(control: { props: { style?: unknown } }) {
  const style = control.props.style as
    ((state: { pressed: boolean }) => unknown) | unknown | undefined;
  return StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false }) : style) as {
    minHeight?: number;
    minWidth?: number;
  };
}

function expectMinimumTarget(control: { props: { style?: unknown } }, minimum: number) {
  const style = flattenPressableStyle(control);
  expect(style.minHeight ?? 0).toBeGreaterThanOrEqual(minimum);
  expect(style.minWidth ?? 0).toBeGreaterThanOrEqual(minimum);
}

describe.each(platformTargets)('$name touch targets', ({ minimum }) => {
  it('enforces the platform minimum on shared and route-facing controls', async () => {
    const buttonView = await render(<Button label="Salvar" onPress={jest.fn()} />);
    expectMinimumTarget(buttonView.getByRole('button'), minimum);

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
});
