import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { darkTheme, getAuthTheme, lightTheme } from '@/theme';

const semanticColorRoles = [
  'background',
  'surface',
  'surfaceMuted',
  'border',
  'borderStrong',
  'text',
  'textMuted',
  'primary',
  'onPrimary',
  'primaryPressed',
  'primarySubtle',
  'info',
  'onInfo',
  'success',
  'onSuccess',
  'warning',
  'onWarning',
  'danger',
  'onDanger',
  'dangerSubtle',
  'tabBarActive',
  'tabBarInactive',
  'backdrop',
  'white',
] as const;

function channel(value: string) {
  const normalized = value.replace('#', '');
  const component = Number.parseInt(normalized, 16) / 255;
  return component <= 0.03928 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const normalized = hex.replace('#', '');
  return (
    0.2126 * channel(normalized.slice(0, 2)) +
    0.7152 * channel(normalized.slice(2, 4)) +
    0.0722 * channel(normalized.slice(4, 6))
  );
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('visual foundation tokens', () => {
  it('provides the same semantic color roles and shared metrics in both palettes', () => {
    expect(Object.keys(lightTheme.colors).sort()).toEqual(Object.keys(darkTheme.colors).sort());

    for (const palette of [lightTheme, darkTheme]) {
      for (const role of semanticColorRoles) {
        expect(palette.colors[role]).toEqual(expect.any(String));
      }
    }

    expect(lightTheme.spacing).toBe(darkTheme.spacing);
    expect(lightTheme.radius).toBe(darkTheme.radius);
    expect(lightTheme.typography).toBe(darkTheme.typography);
    expect(lightTheme.targets).toBe(darkTheme.targets);
    expect(lightTheme.elevation).toBe(darkTheme.elevation);
  });

  it('derives auth aliases from a supplied palette', () => {
    const authTheme = getAuthTheme(darkTheme);

    expect(authTheme.colors.surfaceSoft).toBe(darkTheme.colors.surfaceMuted);
    expect(authTheme.colors.primaryDark).toBe(darkTheme.colors.primaryPressed);
    expect(authTheme.colors.primarySoft).toBe(darkTheme.colors.primarySubtle);
    expect(authTheme.colors.primaryBorder).toBe(darkTheme.colors.borderStrong);
    expect(authTheme.colors.muted).toBe(darkTheme.colors.textMuted);
    expect(authTheme.colors.error).toBe(darkTheme.colors.danger);
    expect(authTheme.colors.errorSoft).toBe(darkTheme.colors.dangerSubtle);
    expect(authTheme.spacing).toBe(darkTheme.spacing);
    expect(authTheme.radius).toBe(darkTheme.radius);
    expect(authTheme.typography.title).toBe(darkTheme.typography.title.fontSize);
    expect(getAuthTheme(lightTheme).colors.primary).toBe(lightTheme.colors.primary);
  });

  it('provides semantic roles and WCAG AA contrast for normal text', () => {
    expect(lightTheme.colors).toEqual(
      expect.objectContaining({
        background: expect.any(String),
        surface: expect.any(String),
        primary: expect.any(String),
        tabBarActive: expect.any(String),
        tabBarInactive: expect.any(String),
        backdrop: expect.any(String),
        text: expect.any(String),
        textMuted: expect.any(String),
        border: expect.any(String),
        info: expect.any(String),
        success: expect.any(String),
        warning: expect.any(String),
        danger: expect.any(String),
        onPrimary: expect.any(String),
        onInfo: expect.any(String),
        onSuccess: expect.any(String),
        onWarning: expect.any(String),
        onDanger: expect.any(String),
      }),
    );

    const normalTextPairs = [
      ['text', 'background'],
      ['text', 'surface'],
      ['textMuted', 'background'],
      ['textMuted', 'surface'],
      ['onPrimary', 'primary'],
      ['tabBarInactive', 'surface'],
      ['danger', 'surface'],
      ['onInfo', 'info'],
      ['onSuccess', 'success'],
      ['onWarning', 'warning'],
      ['onDanger', 'danger'],
    ] as const;

    for (const [foreground, background] of normalTextPairs) {
      expect(
        contrastRatio(lightTheme.colors[foreground], lightTheme.colors[background]),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('does not keep feature-screen color literals where semantic tokens are required', () => {
    const featureScreens = [
      resolve(__dirname, '../../app/(app)/announcements/[id].tsx'),
      resolve(__dirname, '../../app/(auth)/login.tsx'),
      resolve(__dirname, '../../app/(auth)/register.tsx'),
      resolve(__dirname, '../../app/(app)/(tabs)/_layout.tsx'),
      resolve(__dirname, '../../src/components/ui/ConfirmationDialog.tsx'),
      resolve(__dirname, '../../app/(app)/classrooms/[id]/new-announcement.tsx'),
    ];

    for (const screenPath of featureScreens) {
      const source = readFileSync(screenPath, 'utf8');
      expect(source).not.toMatch(/#(?:DC2626|FFF)\b/i);
      expect(source).not.toMatch(/#(?:205B57|667085)\b/i);
      expect(source).not.toMatch(/rgba\(0,0,0,0\.38\)/i);
    }
  });

  it('keeps the tab bar and confirmation backdrop roles in the semantic palette', () => {
    expect(lightTheme.colors.tabBarActive).toBe(lightTheme.colors.primary);
    expect(lightTheme.colors.tabBarInactive).toBe('#667085');
    expect(lightTheme.colors.backdrop).toBe('rgba(0,0,0,0.38)');
  });

  it.each([
    ['normal text on the screen background', 'text', 'background', 4.5],
    ['large text on the screen background', 'text', 'background', 3],
    ['normal text on a surface', 'text', 'surface', 4.5],
    ['normal text on a muted surface', 'text', 'surfaceMuted', 4.5],
    ['muted text on the screen background', 'textMuted', 'background', 4.5],
    ['muted text on a surface', 'textMuted', 'surface', 4.5],
    ['primary button text', 'onPrimary', 'primary', 4.5],
    ['pressed button text', 'onPrimary', 'primaryPressed', 4.5],
    ['info text', 'onInfo', 'info', 4.5],
    ['success text', 'onSuccess', 'success', 4.5],
    ['warning text', 'onWarning', 'warning', 4.5],
    ['danger text', 'onDanger', 'danger', 4.5],
    ['danger message text', 'danger', 'dangerSubtle', 4.5],
    ['selected action on a subtle surface', 'primaryPressed', 'primarySubtle', 4.5],
    ['selected account-role description', 'text', 'primarySubtle', 4.5],
  ] as const)(
    '%s meets WCAG contrast in both palettes',
    (_name, foreground, background, minimum) => {
      for (const palette of [lightTheme, darkTheme]) {
        expect(
          contrastRatio(palette.colors[foreground], palette.colors[background]),
        ).toBeGreaterThanOrEqual(minimum);
      }
    },
  );

  it('keeps visual colors in app and shared components derived from the active palette', () => {
    const sourceFiles = [
      ...listSourceFiles(resolve(__dirname, '../../app')),
      ...listSourceFiles(resolve(__dirname, '../../src/components')),
    ];

    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');
      const fixedStyles =
        source.match(/const styles\s*=\s*StyleSheet\.create\(\{([\s\S]*?)\n\}\);/g) ?? [];

      expect(source).not.toMatch(/#[\dA-Fa-f]{3,8}\b/);
      expect(source).not.toMatch(
        /import\s*\{\s*(?:AUTH_THEME|theme)\s*\}\s*from\s*['"][^'"]*theme/,
      );
      expect(fixedStyles.join('\n')).not.toMatch(/(?:color|Color)\s*:\s*[^,\n]*(?:theme\.)/);
      expect(fixedStyles.join('\n')).not.toMatch(
        /(?:backgroundColor|borderColor)\s*:\s*#[\dA-Fa-f]{3,8}/,
      );
    }
  });
});

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [path] : [];
  });
}
