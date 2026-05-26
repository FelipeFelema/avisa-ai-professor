import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ClassroomCard } from "@/src/components/classroom-card";
import { useAuth } from "@/src/features/auth/auth-context";
import { useClassrooms } from "@/src/hooks/use-classrooms";

export default function ClassroomsScreen() {
  const { logout } = useAuth();
  const { classrooms, error, isLoading } = useClassrooms();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Turmas</Text>
          <Text style={styles.subtitle}>Suas turmas cadastradas.</Text>
        </View>

        <Pressable onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Sair</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.mutedText}>Carregando...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={classrooms}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.mutedText}>Nenhuma turma encontrada.</Text>
          }
          renderItem={({ item }) => <ClassroomCard classroom={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f7fb",
    paddingHorizontal: 20,
    paddingTop: 64,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 14,
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  logoutText: {
    color: "#111827",
    fontWeight: "700",
  },
  center: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  listContent: {
    gap: 12,
    paddingBottom: 32,
  },
  mutedText: {
    color: "#6b7280",
    fontSize: 15,
  },
  error: {
    color: "#b91c1c",
    fontSize: 15,
    textAlign: "center",
  },
});
