import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Message } from "../../types/api.types";

interface Props {
  message: Message;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";

  return (
    <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? styles.userBubble
            : isTool
            ? styles.toolBubble
            : styles.aiBubble,
        ]}
      >
        {isTool && <Text style={styles.toolLabel}>TOOL USED</Text>}
        <Text style={isUser ? styles.userText : styles.aiText}>
          {message.content}
          {isStreaming ? "▊" : ""}
        </Text>
        <Text style={styles.timestamp}>
          {new Date(message.createdAt).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    </View>
  );
}

// Same look as the live chat screen: user = grey bubble on the right, assistant = dark card.
const styles = StyleSheet.create({
  row: { marginVertical: 5, marginHorizontal: 12, flexDirection: "row" },
  rowRight: { justifyContent: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  bubble: { maxWidth: "80%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  userBubble: { backgroundColor: "#1f2937", borderBottomRightRadius: 6 },
  aiBubble: { backgroundColor: "#111827", borderWidth: 1, borderColor: "#1f2937", borderBottomLeftRadius: 6 },
  toolBubble: { backgroundColor: "rgba(129,140,248,0.14)", borderBottomLeftRadius: 6 },
  userText: { color: "#f9fafb", fontSize: 15, lineHeight: 22 },
  aiText: { color: "#e5e7eb", fontSize: 15, lineHeight: 22 },
  toolLabel: { color: "#818cf8", fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 4 },
  timestamp: { color: "#6b7280", fontSize: 10, marginTop: 6, alignSelf: "flex-end" },
});
