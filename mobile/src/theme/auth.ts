import type { Theme } from './tokens';

export function getAuthTheme(palette: Theme) {
  return {
    ...palette,
    colors: {
      ...palette.colors,
      surfaceSoft: palette.colors.surfaceMuted,
      primaryDark: palette.colors.primaryPressed,
      primarySoft: palette.colors.primarySubtle,
      primaryBorder: palette.colors.borderStrong,
      muted: palette.colors.textMuted,
      error: palette.colors.danger,
      errorSoft: palette.colors.dangerSubtle,
    },
    typography: {
      title: palette.typography.title.fontSize,
      sectionTitle: palette.typography.sectionTitle.fontSize,
      body: palette.typography.body.fontSize,
      label: palette.typography.label.fontSize,
      caption: palette.typography.caption.fontSize,
    },
  } as const;
}
