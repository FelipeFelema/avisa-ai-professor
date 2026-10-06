import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SecondaryScreen, Button, ScreenState } from '@/components/ui';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/theme';

const statusText = {
  LOADING: {
    title: 'Carregando notificações',
    message: 'Aguarde enquanto consultamos o estado deste dispositivo.',
  },
  NOT_REQUESTED: {
    title: 'Notificações desativadas',
    message: 'A ativação só começa quando você escolher e permitir notificações.',
  },
  DENIED: {
    title: 'Permissão recusada',
    message: 'A permissão foi recusada. Você pode alterá-la nas configurações do dispositivo.',
  },
  UNAVAILABLE: {
    title: 'Notificações indisponíveis neste dispositivo',
    message: 'Use uma build nativa configurada em um dispositivo compatível.',
  },
  REGISTERING: {
    title: 'Ativando notificações',
    message: 'Estamos registrando este dispositivo com segurança.',
  },
  ACTIVE: {
    title: 'Notificações ativas neste dispositivo',
    message: 'Este dispositivo está associado à sua sessão atual.',
  },
  AUTHORIZED_APP_DISABLED: {
    title: 'Notificações desativadas no aplicativo',
    message: 'A permissão do dispositivo permanece separada da sua escolha no aplicativo.',
  },
  ERROR: {
    title: 'Não foi possível atualizar notificações',
    message: 'Verifique sua conexão e tente novamente.',
  },
  RECOVERY: {
    title: 'Recuperação necessária',
    message: 'O armazenamento privado de notificações precisa ser recuperado.',
  },
  PENDING_CLEANUP: {
    title: 'Desativação pendente',
    message: 'A desativação será concluída quando houver conexão.',
  },
} as const;

export default function ProfileNotificationsScreen() {
  const push = usePushNotifications();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const presentation = statusText[push.status];
  const message = push.message ?? presentation.message;
  const unavailable = push.status === 'UNAVAILABLE';
  const pending = push.status === 'PENDING_CLEANUP' || push.isBusy;

  if (push.status === 'LOADING') {
    return (
      <SecondaryScreen fallbackHref="/(app)/(tabs)/profile">
        <ScreenState kind="loading" title={presentation.title} message={presentation.message} />
      </SecondaryScreen>
    );
  }

  return (
    <SecondaryScreen fallbackHref="/(app)/(tabs)/profile">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View testID="push-notifications-screen" style={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>
            Notificações neste dispositivo
          </Text>
          <Text style={styles.intro}>
            Escolha se deseja receber notificações nesta instalação. A permissão do dispositivo e a
            ativação no aplicativo são controles separados.
          </Text>
          <View accessibilityRole="summary" style={styles.status}>
            <Text accessibilityRole="header" style={styles.statusTitle}>
              {presentation.title}
            </Text>
            <Text style={styles.message}>{message}</Text>
          </View>

          {push.status === 'ACTIVE' ? (
            <>
              <Button
                label={
                  push.isTestBusy
                    ? 'Enviando teste...'
                    : push.testCooldownActive
                      ? 'Aguarde para enviar teste'
                      : 'Enviar teste de notificação'
                }
                loading={push.isTestBusy}
                disabled={push.isTestBusy || push.testCooldownActive || pending}
                onPress={() => void push.sendTest()}
              />
              {push.testMessage && (
                <Text accessibilityRole="summary" style={styles.message}>
                  {push.testMessage}
                </Text>
              )}
              <Button
                label="Desativar notificações"
                variant="destructive"
                loading={pending}
                disabled={push.isTestBusy}
                onPress={() => void push.deactivate()}
              />
            </>
          ) : push.status === 'DENIED' ? (
            <Button
              label="Abrir configurações do dispositivo"
              variant="secondary"
              onPress={() => void push.openSettings()}
            />
          ) : (
            <Button
              label={pending ? 'Aguarde...' : 'Ativar notificações'}
              loading={pending}
              disabled={unavailable || push.status === 'RECOVERY' || push.status === 'REGISTERING'}
              onPress={() => void push.activate()}
            />
          )}

          {(push.status === 'ERROR' || push.status === 'RECOVERY') && (
            <Button
              label="Tentar novamente"
              variant="secondary"
              disabled={pending}
              onPress={() => void push.refresh()}
            />
          )}
        </View>
      </ScrollView>
    </SecondaryScreen>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    scrollContent: { flexGrow: 1, padding: theme.spacing.xl },
    content: {
      flex: 1,
      gap: theme.spacing.lg,
      padding: theme.spacing.xl,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
    },
    title: { ...theme.typography.title, color: theme.colors.text },
    intro: { ...theme.typography.body, color: theme.colors.textMuted },
    status: { gap: theme.spacing.xs },
    statusTitle: { ...theme.typography.sectionTitle, color: theme.colors.text },
    message: { ...theme.typography.body, color: theme.colors.textMuted },
  });
}
