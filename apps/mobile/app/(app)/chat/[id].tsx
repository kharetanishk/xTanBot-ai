import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useConversation } from "../../../src/hooks/useConversations";
import { formatDate } from "../../../src/utils/date.utils";
import MessageBubble from "../../../src/components/chat/MessageBubble";

export default function ChatTranscriptScreen() {
  const router = useRouter();
  const { id: callId } = useLocalSearchParams<{ id: string }>();
  const { data: conversation, isLoading } = useConversation(callId ?? "");

  return (
    <View style={styles.screen}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← BACK</Text>
      </Pressable>
      <View style={styles.header}>
        <Text style={styles.title}>CONVERSATION</Text>
        {conversation?.createdAt && (
          <Text style={styles.subtitle}>
            {formatDate(conversation.createdAt)}
          </Text>
        )}
      </View>

      {isLoading ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeleton} />
          ))}
        </View>
      ) : !conversation || conversation.messages.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>NO TRANSCRIPT</Text>
          <Text style={styles.emptySubtitle}>
            No conversation available for this call
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversation.messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  backButton: { alignSelf: "flex-start" },
  backText: { color: "#FBBF24", fontWeight: "900", fontSize: 14 },
  header: { marginTop: 8, marginBottom: 16 },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 24 },
  skeletonWrap: { flex: 1 },
  skeleton: {
    height: 64,
    backgroundColor: "#1a1a1a",
    borderWidth: 3,
    borderColor: "#333",
    borderRadius: 0,
    marginBottom: 12,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ffffff",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
    textAlign: "center",
  },
});
