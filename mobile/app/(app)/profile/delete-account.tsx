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
              <Text style={styles.body}>
                Sua conta, credencial, todas as sessões e registros de exclusões anteriores de
                turmas serão removidos.
              </Text>
              {impact.role === 'PARENT' ? (
                <Text style={styles.body}>
                  Suas participações serão removidas. Turmas e conteúdos de outras pessoas serão
                  preservados, exceto seus comunicados e recursos vinculados às suas turmas
                  próprias.
                </Text>
              ) : impact.role === 'PROFESSOR' ? (
                <Text style={styles.body}>
                  Suas turmas e todos os conteúdos e participações nelas serão removidos. Contas dos
                  participantes serão preservadas.
                </Text>
              ) : (
                <Text style={styles.body}>Você perderá também seu acesso administrativo.</Text>
              )}
              <Text style={styles.body}>Turmas próprias: {impact.ownedClassroomsCount}</Text>
              <Text style={styles.body}>
                Comunicados nas suas turmas: {impact.announcementsInOwnedClassroomsCount}
              </Text>
              <Text style={styles.body}>
                Participações em turmas de outras pessoas: {impact.externalMembershipsCount}
              </Text>
              <Text style={styles.body}>
                Seus comunicados em turmas de outras pessoas:{' '}
                {impact.authoredAnnouncementsInOtherClassroomsCount}
              </Text>
              <Text style={styles.body}>
                Turmas próprias serão excluídas com todos os comunicados, inclusive expirados e de
                outras pessoas, e todas as participações. Em turmas de outras pessoas, apenas suas
                participações e seus comunicados serão removidos; os demais membros e conteúdos
                permanecerão.
              </Text>
              <Text style={styles.body}>
                Códigos de convite e a preferência de tema deste dispositivo serão preservados.
                Contas de outras pessoas e recursos sem vínculo com você permanecerão.
              </Text>
              <Text style={styles.body}>
                Este resumo pode mudar. Os vínculos vigentes serão recalculados no momento da
                exclusão.
              </Text>
              {!impact.canDelete ? (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={styles.warning}
                >
                  Sua conta é a última ADMIN. A exclusão está bloqueada para preservar o acesso
                  administrativo.
                </Text>
              ) : null}
              <Text style={styles.body}>
                Para confirmar, informe sua senha atual e digite exatamente EXCLUIR MINHA CONTA.
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
                  Confirmação revisada. Pressione Excluir minha conta para enviar uma única
                  solicitação.
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
                  message="Aguarde. A solicitação de exclusão não será reenviada automaticamente."
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
                    : 'Envia uma única solicitação irreversível após nova confirmação'
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
