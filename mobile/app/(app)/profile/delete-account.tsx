import { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthField } from '@/components/auth';
import { Button, ScreenState, SecondaryScreen } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useDeleteAccount } from '@/hooks/useDeleteAccount';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/theme';
import {
  deleteAccountSchema,
  type DeleteAccountFormData,
} from '@/validations/deleteAccount.schema';

const emptyForm: DeleteAccountFormData = { currentPassword: '', confirmationPhrase: '' };

export default function DeleteAccountScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const router = useRouter();
  const {
    impact,
    isLoading,
    feedback,
    flowState,
    isPending,
    reload,
    submit,
    verifySession,
    clearTransientFeedback,
  } = useDeleteAccount();
  const [reviewed, setReviewed] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    setFocus,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<DeleteAccountFormData>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: emptyForm,
  });
  const clear = useCallback(() => {
    reset(emptyForm);
    setReviewed(false);
    clearTransientFeedback();
  }, [clearTransientFeedback, reset]);
  useFocusEffect(
    useCallback(() => {
      clear();
      return clear;
    }, [clear]),
  );
  useEffect(() => {
    if (!user || !impact || !impact.canDelete) reset(emptyForm);
  }, [user, impact, reset]);
  useEffect(() => {
    if (feedback?.field) {
      setError(feedback.field, { type: 'server', message: feedback.message });
      setFocus(feedback.field);
    }
  }, [feedback, setError, setFocus]);
  useEffect(() => {
    const message = errors.currentPassword?.message ?? errors.confirmationPhrase?.message;
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [errors.currentPassword?.message, errors.confirmationPhrase?.message]);
  usePreventRemove(isPending && Boolean(user), () => {
    AccessibilityInfo.announceForAccessibility(
      'Aguarde a confirmação do resultado antes de sair desta tela.',
    );
  });
  useEffect(() => {
    if (!isPending || !user) return;
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => backSubscription.remove();
  }, [isPending, user]);

  useEffect(() => {
    if (isPending) AccessibilityInfo.announceForAccessibility('Exclusão em andamento.');
  }, [isPending]);
  const cancel = () => {
    if (isPending) return;
    clear();
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  const submitDeletion = handleSubmit(
    async (data) => {
      setReviewed(false);
      reset(emptyForm);
      const result = await submit(data);
      if (result === 'field-error')
        AccessibilityInfo.announceForAccessibility('Confira os campos.');
    },
    (invalid) => setFocus(invalid.currentPassword ? 'currentPassword' : 'confirmationPhrase'),
  );

  if (authLoading || !user)
    return (
      <SecondaryScreen fallbackHref="/profile">
        <ScreenState
          kind={authLoading ? 'loading' : 'not-found'}
          title={authLoading ? 'Carregando conta' : 'Sessão encerrada'}
          message="Entre novamente para consultar sua conta."
          actionLabel={authLoading ? undefined : 'Entrar'}
          onAction={() => router.replace('/login')}
        />
      </SecondaryScreen>
    );

  return (
    <SecondaryScreen fallbackHref="/profile">
      <KeyboardAvoidingView
        testID="deletion-keyboard"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <ScrollView
          testID="deletion-scroll"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text accessibilityRole="header" style={styles.title}>
            Excluir minha conta
          </Text>
          <Text style={styles.warning}>A exclusão é permanente e não pode ser desfeita.</Text>
          {isLoading ? (
            <ScreenState
              kind="loading"
              title="Calculando impacto"
              message="Consultando os vínculos atuais da sua conta."
            />
          ) : !impact && feedback ? (
            <ScreenState
              kind="error"
              title="Resumo indisponível"
              message={feedback.message}
              actionLabel="Tentar novamente"
              onAction={() => void reload()}
            />
          ) : null}
          {impact ? (
            <>
              <Text style={styles.body}>Sua conta será excluída e você sairá do aplicativo.</Text>
              {impact.ownedClassroomsCount > 0 ? (
                <Text style={styles.body}>
                  Suas turmas ({impact.ownedClassroomsCount}) serão excluídas com todos os
                  comunicados e participações. As contas dos participantes serão mantidas.
                </Text>
              ) : impact.role !== 'PARENT' ? (
                <Text style={styles.body}>Você não tem turmas próprias.</Text>
              ) : null}
              {impact.externalMembershipsCount > 0 ? (
                <Text style={styles.body}>
                  Você sairá de {impact.externalMembershipsCount}{' '}
                  {impact.externalMembershipsCount === 1 ? 'turma' : 'turmas'} de outras pessoas.
                </Text>
              ) : impact.role === 'PARENT' ? (
                <Text style={styles.body}>Você não participa de nenhuma turma.</Text>
              ) : null}
              {impact.role !== 'PARENT' &&
              impact.authoredAnnouncementsInOtherClassroomsCount > 0 ? (
                <Text style={styles.body}>
                  Os comunicados que você publicou em outras turmas (
                  {impact.authoredAnnouncementsInOtherClassroomsCount}) também serão removidos.
                </Text>
              ) : null}
              <Text style={styles.body}>
                {impact.role === 'PARENT'
                  ? 'As turmas e os comunicados das outras pessoas continuarão disponíveis.'
                  : 'Em outras turmas, os demais participantes e comunicados serão mantidos.'}
              </Text>
              {impact.role === 'ADMIN' ? (
                <Text style={styles.body}>
                  Você perderá o acesso administrativo. As outras contas do aplicativo serão
                  mantidas.
                </Text>
              ) : null}
              {!impact.canDelete ? (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={styles.warning}
                >
                  Você é o último administrador. Sua conta não pode ser excluída enquanto não houver
                  outro administrador.
                </Text>
              ) : null}
              <Text style={styles.body}>
                Para confirmar, informe sua senha e digite EXCLUIR MINHA CONTA.
              </Text>
              {(['currentPassword', 'confirmationPhrase'] as const).map((name) => (
                <Controller
                  key={name}
                  control={control}
                  name={name}
                  render={({ field: { value, onChange, onBlur, ref } }) => (
                    <AuthField
                      label={name === 'currentPassword' ? 'Senha atual' : 'Frase de confirmação'}
                      value={value}
                      onChangeText={(next) => {
                        setReviewed(false);
                        clearErrors(name);
                        clearTransientFeedback();
                        onChange(next);
                      }}
                      onBlur={onBlur}
                      inputRef={ref}
                      secureTextEntry={name === 'currentPassword'}
                      autoComplete="off"
                      textContentType="none"
                      importantForAutofill="no"
                      autoCorrect={false}
                      autoCapitalize="none"
                      editable={impact.canDelete && !isPending && !isLoading}
                      error={errors[name]?.message}
                    />
                  )}
                />
              ))}
              <Button
                label="Revisar confirmação"
                variant="secondary"
                disabled={!impact.canDelete || isLoading || isPending}
                onPress={handleSubmit(
                  () => {
                    setReviewed(true);
                  },
                  (invalid) =>
                    setFocus(invalid.currentPassword ? 'currentPassword' : 'confirmationPhrase'),
                )}
              />
              {reviewed ? (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={styles.body}
                >
                  Confirmação revisada. Toque em Excluir minha conta para concluir.
                </Text>
              ) : null}
              {feedback ? (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={styles.body}
                >
                  {feedback.message}
                </Text>
              ) : null}
              {flowState === 'pending' || flowState === 'verification' ? (
                <ScreenState
                  kind="loading"
                  title={flowState === 'pending' ? 'Exclusão em andamento' : 'Verificando sessão'}
                  message="Aguarde enquanto confirmamos o resultado."
                />
              ) : null}
              {flowState === 'indeterminate' ? (
                <Button
                  label="Verificar sessão"
                  variant="secondary"
                  onPress={() => void verifySession()}
                />
              ) : null}
              <Button
                label="Excluir minha conta"
                variant="destructive"
                disabled={!impact.canDelete || !reviewed || isPending || isLoading}
                onPress={submitDeletion}
                accessibilityHint={
                  isPending
                    ? 'Aguarde a confirmação da solicitação atual'
                    : 'Exclui sua conta permanentemente após a confirmação'
                }
              />
              <Button
                label="Recarregar resumo"
                variant="secondary"
                disabled={isPending}
                onPress={() => {
                  clear();
                  void reload();
                }}
              />
            </>
          ) : null}
          <Button label="Cancelar" variant="secondary" disabled={isPending} onPress={cancel} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SecondaryScreen>
  );
}

function createStyles(palette: Theme) {
  return StyleSheet.create({
    keyboard: { flex: 1, backgroundColor: palette.colors.background },
    content: { padding: palette.spacing.xl, gap: palette.spacing.lg },
    title: { ...palette.typography.title, fontWeight: '800', color: palette.colors.text },
    body: { ...palette.typography.body, color: palette.colors.text },
    warning: { ...palette.typography.body, fontWeight: '700', color: palette.colors.danger },
  });
}
