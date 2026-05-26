import { StyleSheet, Text, View } from "react-native";

import type { Classroom } from "@/src/features/classrooms/types";

type ClassroomCardProps = {
  classroom: Classroom;
};

export function ClassroomCard({ classroom }: ClassroomCardProps) {
  const membersCount = classroom.userClassrooms.length;

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{classroom.name}</Text>
      <Text style={styles.meta}>
        {membersCount} {membersCount === 1 ? "participante" : "participantes"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  name: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  meta: {
    color: "#6b7280",
    fontSize: 13,
  },
});
