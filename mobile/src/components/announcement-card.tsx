import { StyleSheet, Text, View } from "react-native";

import type { Announcement } from "@/src/features/announcements/types";

type AnnouncementCardProps = {
  announcement: Announcement;
};

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{announcement.title}</Text>
      <Text style={styles.content}>{announcement.content}</Text>
      <Text style={styles.meta}>Por {announcement.author.name}</Text>
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
  title: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    color: "#374151",
    fontSize: 15,
    lineHeight: 22,
  },
  meta: {
    color: "#6b7280",
    fontSize: 13,
  },
});
