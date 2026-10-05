import { useEffect, useMemo, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ScreenState, SecondaryScreen } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useTeacherInvite } from '@/hooks/useTeacherInvite';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/theme';

export default function AdminTeacherInvitesScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { state, generate, copy } = useTeacherInvite();
  const { palette } = useTheme();
  const [now, setNow] = useState(() => Date.now());
  const styles = createStyles(palette);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/login');
    else if (user.role !== 'ADMIN' || state.access === 'invalid')
      router.replace('/(app)/(tabs)/profile');
  }, [isLoading, router, state.access, user]);

  const expired = useMemo(
    () => !!state.result && Date.parse(state.result.expiresAt) <= now,
    [now, state.result],
  );
  if (isLoading || !user || user.role !== 'ADMIN')
    return <ScreenState kind="loading" title="Verificando acesso" message="Aguarde um momento." />;

  const checking = state.access === 'checking';
  const blocked = checking || state.access !== 'authorized' || state.operation !== 'idle';
  return (
    <SecondaryScreen fallbackHref="/(app)/(tabs)/profile" backPending={state.operation !== 'idle'}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.title}>
          Convites de professores
        </Text>
        <Text style={styles.body}>
          Gere um convite pessoal para cadastrar uma conta PROFESSOR. O código vale por sete dias e
          só pode ser usado uma vez.
        </Text>
        {state.access === 'indeterminate' ? (
          <Text accessibilityRole="alert" style={styles.feedback}>
            Não foi possível confirmar sua autorização. Verifique a conexão e tente novamente ao
            voltar para esta tela.
          </Text>
        ) : null}
        {state.feedback.kind === 'error' ? (
          <Text accessibilityRole="alert" style={styles.feedback}>
            {state.feedback.category === 'copy-failed'
              ? 'Não foi possível copiar. Selecione o código ou tente copiar novamente.'
              : state.feedback.category === 'forbidden'
                ? 'Seu perfil não tem autorização para gerar convites.'
                : 'Não foi possível validar a resposta. Tente novamente.'}
          </Text>
        ) : null}
        {state.feedback.kind === 'uncertain' ? (
          <Text accessibilityRole="alert" style={styles.feedback}>
            Não foi possível confirmar se o convite foi criado. Nenhuma repetição automática foi
            feita; uma nova geração será uma ação separada.
          </Text>
        ) : null}
        {state.feedback.kind === 'success' && state.feedback.category === 'generated' ? (
          <Text accessibilityLiveRegion="polite" style={styles.feedback}>
            Convite gerado.
          </Text>
        ) : null}
        {state.feedback.kind === 'success' && state.feedback.category === 'copied' ? (
          <Text accessibilityLiveRegion="polite" style={styles.feedback}>
            Código copiado.
          </Text>
        ) : null}
        {state.result ? (
          <View style={styles.result}>
            <Text style={styles.label}>Código do convite</Text>
            <Text
              selectable
              accessibilityLabel="Código do convite, texto selecionável"
              accessibilityLiveRegion="none"
              style={styles.code}
            >
              {state.result.code}
            </Text>
            <Text style={styles.body}>Perfil: PROFESSOR</Text>
            <Text style={styles.body}>Criado em: {formatLocal(state.result.createdAt)}</Text>
            <Text style={styles.body}>Expira em: {formatLocal(state.result.expiresAt)}</Text>
            <Text style={styles.body}>{expired ? 'Prazo encerrado' : 'Ativo na geração'}</Text>
            <Text style={styles.body}>O convite é pessoal e de uso único.</Text>
          </View>
        ) : null}
        {state.result ? (
          <Button
            label="Copiar código"
            loading={state.operation === 'copying'}
            loadingLabel="Copiando..."
            disabled={blocked || expired}
            accessibilityHint="Copia somente o código do convite para a área de transferência"
            onPress={() => void copy()}
          />
        ) : null}
        <Button
          label="Gerar convite de professor"
          loading={state.operation === 'generating'}
          loadingLabel="Gerando convite..."
          disabled={blocked}
          accessibilityHint="Gera um código pessoal para uma conta PROFESSOR, válido por sete dias e para um uso"
          onPress={() => void generate()}
        />
        {state.result ? (
          <Text style={styles.body}>Gerar outro código não revoga o anterior.</Text>
        ) : null}
      </ScrollView>
    </SecondaryScreen>
  );
}

function formatLocal(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    content: { flexGrow: 1, padding: theme.spacing.xl, gap: theme.spacing.lg },
    title: {
      color: theme.colors.text,
      fontSize: theme.typography.title.fontSize,
      lineHeight: theme.typography.title.lineHeight,
      fontWeight: '800',
    },
    body: {
      color: theme.colors.text,
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
    },
    label: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.caption.fontSize,
      fontWeight: '700',
    },
    code: {
      color: theme.colors.text,
      fontSize: theme.typography.sectionTitle.fontSize,
      lineHeight: theme.typography.sectionTitle.lineHeight,
      fontWeight: '800',
      flexWrap: 'wrap',
    },
    result: {
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
    },
    feedback: {
      color: theme.colors.text,
      fontSize: theme.typography.body.fontSize,
      lineHeight: theme.typography.body.lineHeight,
    },
  });
}
