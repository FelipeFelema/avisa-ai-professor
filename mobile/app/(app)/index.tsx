import { View, Text, Pressable } from 'react-native';
import { useAuth } from '@/hooks/useAuth';

export default function Home() {
  const { logout } = useAuth();
  return (
    <View>
      <Text>Usuário autenticado!</Text>
      <Pressable onPress={logout}>
        <Text>Sair</Text>
      </Pressable>
    </View>
  );
}
