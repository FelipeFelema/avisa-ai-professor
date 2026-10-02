import { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthField } from '@/components/auth/AuthField';
import { AuthRolePicker, type AuthRoleValue } from '@/components/auth/AuthRolePicker';
import { useTheme } from '@/hooks/useTheme';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { darkTheme, lightTheme } from '@/theme';
import type { Theme } from '@/theme';

jest.mock('react-native', () => {
  const React = jest.requireActual('react');
  const actual = jest.requireActual('react-native');
  const pressableStyles = new Map<string, unknown>();
  const MockPressable = ({ style, testID, ...props }: Record<string, unknown>) => {
    if (typeof testID === 'string') pressableStyles.set(testID, style);
    const resolvedStyle =
      typeof style === 'function'
        ? Reflect.apply(style as Function, undefined, [{ pressed: false }])
        : style;
    return React.createElement(actual.View, {
      ...props,
      accessible: props.accessibilityRole ? true : props.accessible,
      testID,
      style: resolvedStyle,
    });
  };

  return Object.assign(
    new Proxy(actual, {
      get(target, property, receiver) {
        return property === 'Pressable' ? MockPressable : Reflect.get(target, property, receiver);
      },
    }),
    { __pressableStyles: pressableStyles },
  );
});

const mockPressableStyles = (
  require('react-native') as {
    __pressableStyles: Map<string, unknown>;
  }
).__pressableStyles;

function Controls() {
  const { setTheme } = useTheme();
  const [roleValue, setRoleValue] = useState<AuthRoleValue | null>('teacher');

  return (
    <View>
      <AuthField label="Nome" value="Ana" onChangeText={jest.fn()} placeholder="Seu nome" />
      <AuthField label="E-mail inválido" value="x" error="E-mail inválido" />
      <AuthButton testID="theme-auth-button" label="Continuar" onPress={jest.fn()} />
      <AuthButton label="Enviar" loadingLabel="Enviando..." isLoading onPress={jest.fn()} />
      <AuthRolePicker value={roleValue} onChange={setRoleValue} />
      <Text accessibilityRole="button" onPress={() => setTheme('dark')}>
        Select Escuro
      </Text>
      <Text accessibilityRole="button" onPress={() => setTheme('light')}>
        Select Claro
      </Text>
    </View>
  );
}

describe('theme-aware auth controls', () => {
  it('updates field, focus, error, button, and selected role colors in place', async () => {
    const view = await render(
      <ThemeProvider>
        <Controls />
      </ThemeProvider>,
    );
    const field = view.getByLabelText('Nome');

    expect(field.props.value).toBe('Ana');
    expect(field.props.placeholderTextColor).toBe(lightTheme.colors.textMuted);
    await fireEvent(field, 'focus');
    expect(StyleSheet.flatten(field.props.style).borderColor).toBe(lightTheme.colors.primary);

    const errorField = view.getByLabelText('E-mail inválido');
    expect(StyleSheet.flatten(errorField.props.style).backgroundColor).toBe(
      lightTheme.colors.dangerSubtle,
    );

    const buttonStyle = () => {
      const style = view.getByRole('button', { name: 'Continuar' }).props.style;
      return StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false }) : style);
    };
    expect(buttonStyle().backgroundColor).toBe(lightTheme.colors.primary);
    const authButtonStyle = mockPressableStyles.get('theme-auth-button') as (state: {
      pressed: boolean;
    }) => StyleProp<ViewStyle>;
    expect(StyleSheet.flatten(authButtonStyle({ pressed: true })).backgroundColor).toBe(
      lightTheme.colors.primaryPressed,
    );

    const roleStyle = () => {
      const style = view.getByRole('button', { name: 'Professor' }).props.style;
      return StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false }) : style);
    };
    const selectedRole = view.getByRole('button', { name: 'Professor' });
    expect(selectedRole.props.accessibilityState.selected).toBe(true);
    expect(roleStyle().backgroundColor).toBe(lightTheme.colors.primarySubtle);

    await fireEvent.press(view.getByText('Select Escuro'));

    expect(field.props.value).toBe('Ana');
    expect(view.getByLabelText('Nome').props.placeholderTextColor).toBe(darkTheme.colors.textMuted);
    expect(StyleSheet.flatten(view.getByLabelText('Nome').props.style).borderColor).toBe(
      darkTheme.colors.primary,
    );
    expect(
      StyleSheet.flatten(view.getByLabelText('E-mail inválido').props.style).backgroundColor,
    ).toBe(darkTheme.colors.dangerSubtle);
    expect(buttonStyle().backgroundColor).toBe(darkTheme.colors.primary);
    const darkAuthButtonStyle = mockPressableStyles.get('theme-auth-button') as (state: {
      pressed: boolean;
    }) => StyleProp<ViewStyle>;
    expect(StyleSheet.flatten(darkAuthButtonStyle({ pressed: true })).backgroundColor).toBe(
      darkTheme.colors.primaryPressed,
    );
    expect(roleStyle().backgroundColor).toBe(darkTheme.colors.primarySubtle);
    expect(view.getByRole('button', { name: 'Enviando...' }).props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });

    await fireEvent.press(view.getByText('Select Claro'));
    expect(view.getByLabelText('Nome').props.placeholderTextColor).toBe(
      lightTheme.colors.textMuted,
    );
  });

  it('keeps account-role descriptions at 4.5:1 in selected, unselected, and pressed states', async () => {
    const view = await render(
      <ThemeProvider>
        <Controls />
      </ThemeProvider>,
    );

    const expectRoleDescriptionsToMeetContrast = (palette: Theme) => {
      const cases = [
        {
          id: 'auth-role-option-responsible',
          label: 'Responsável',
          description: 'Acompanhar comunicados, avisos e rotinas da turma.',
        },
        {
          id: 'auth-role-option-teacher',
          label: 'Professor',
          description: 'Criar uma conta com código de convite da escola.',
        },
      ];

      for (const item of cases) {
        const control = view.getByRole('button', { name: item.label });
        const description = view.getByText(item.description);
        const textStyle = StyleSheet.flatten(description.props.style) as { color: string };
        const pressableStyle = mockPressableStyles.get(item.id) as (state: {
          pressed: boolean;
        }) => StyleProp<ViewStyle>;

        for (const pressed of [false, true]) {
          const selected = control.props.accessibilityState.selected === true;
          const cardStyle = StyleSheet.flatten(pressableStyle({ pressed })) as {
            backgroundColor: string;
            opacity?: number;
          };

          expect(cardStyle.backgroundColor).toBe(
            selected ? palette.colors.primarySubtle : palette.colors.surfaceMuted,
          );
          expect(textStyle.color).toBe(selected ? palette.colors.text : palette.colors.textMuted);
          expect(cardStyle.opacity).toBeUndefined();
          expect(contrastRatio(textStyle.color, cardStyle.backgroundColor)).toBeGreaterThanOrEqual(
            4.5,
          );
        }
      }
    };

    const selectRole = async (label: 'Responsável' | 'Professor', palette: Theme) => {
      await fireEvent.press(view.getByRole('button', { name: label }));
      expect(view.getByRole('button', { name: label }).props.accessibilityState.selected).toBe(
        true,
      );
      expectRoleDescriptionsToMeetContrast(palette);
    };

    expectRoleDescriptionsToMeetContrast(lightTheme);
    await fireEvent.press(view.getByText('Select Escuro'));
    expectRoleDescriptionsToMeetContrast(darkTheme);
    await selectRole('Responsável', darkTheme);
    await fireEvent.press(view.getByText('Select Claro'));
    expectRoleDescriptionsToMeetContrast(lightTheme);
    await selectRole('Professor', lightTheme);
  });
});

function contrastRatio(foreground: string, background: string) {
  const luminance = (color: string) => {
    const channels = color
      .replace('#', '')
      .match(/.{2}/g)!
      .map((channel) => Number.parseInt(channel, 16) / 255)
      .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}
