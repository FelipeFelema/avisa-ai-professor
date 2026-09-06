import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { theme } from '@/theme';

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
  it('provides semantic roles and WCAG AA contrast for normal text', () => {
    expect(theme.colors).toEqual(
      expect.objectContaining({
        background: expect.any(String),
        surface: expect.any(String),
        primary: expect.any(String),
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
      ['onInfo', 'info'],
      ['onSuccess', 'success'],
      ['onWarning', 'warning'],
      ['onDanger', 'danger'],
    ] as const;

    for (const [foreground, background] of normalTextPairs) {
      expect(
        contrastRatio(theme.colors[foreground], theme.colors[background]),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('does not keep feature-screen color literals where semantic tokens are required', () => {
    const featureScreens = [
      resolve(__dirname, '../../app/(app)/announcements/[id].tsx'),
      resolve(__dirname, '../../app/(auth)/login.tsx'),
      resolve(__dirname, '../../app/(auth)/register.tsx'),
    ];

    for (const screenPath of featureScreens) {
      const source = readFileSync(screenPath, 'utf8');
      expect(source).not.toMatch(/#(?:DC2626|FFF)\b/i);
    }
  });
});
