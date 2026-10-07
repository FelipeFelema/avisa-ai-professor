import { useSyncExternalStore } from 'react';
import { Modal, View } from 'react-native';
import { Button, ScreenState } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import {
  cancelAnnouncementPush,
  getAnnouncementPushState,
  retryAnnouncementPush,
  subscribeAnnouncementPush,
} from '@/services/push/announcement-push-navigation';

export function AnnouncementPushFeedback() {
  const state = useSyncExternalStore(
    subscribeAnnouncementPush,
    getAnnouncementPushState,
    getAnnouncementPushState,
  );
  if (state.status !== 'loading' && state.status !== 'error' && state.status !== 'unavailable')
    return null;
  return <Feedback status={state.status} />;
}
function Feedback({ status }: { status: 'loading' | 'error' | 'unavailable' }) {
  const { palette } = useTheme();
  const loading = status === 'loading';
  const unavailable = status === 'unavailable';
  return (
    <Modal visible transparent={false} onRequestClose={cancelAnnouncementPush}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          backgroundColor: palette.colors.background,
          padding: palette.spacing.xl,
        }}
      >
        <ScreenState
          kind={loading ? 'loading' : unavailable ? 'not-found' : 'error'}
          title={
            loading
              ? 'Carregando comunicado'
              : unavailable
                ? 'Comunicado não encontrado'
                : 'Não foi possível carregar o comunicado'
          }
          message={
            loading
              ? 'Verificando acesso.'
              : unavailable
                ? 'Este comunicado não está mais disponível.'
                : 'Tente novamente em um momento.'
          }
          actionLabel={status === 'error' ? 'Tentar novamente' : undefined}
          onAction={() => void retryAnnouncementPush()}
        />
        <Button
          label={unavailable ? 'Voltar' : 'Cancelar'}
          variant="ghost"
          onPress={cancelAnnouncementPush}
        />
      </View>
    </Modal>
  );
}
