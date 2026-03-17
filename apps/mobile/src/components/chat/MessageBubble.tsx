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

const styles = StyleSheet.create({
  row: {
    marginVertical: 4,
    marginHorizontal: 12,
    flexDirection: "row",
  },
  rowRight: {
    justifyContent: "flex-end",
  },
  rowLeft: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "75%",
    padding: 12,
    borderWidth: 2,
    borderRadius: 0,
  },
  userBubble: {
    backgroundColor: "#FBBF24",
    borderColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  aiBubble: {
    backgroundColor: "#ffffff",
    borderColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  toolBubble: {
    backgroundColor: "#6366f1",
    borderColor: "#000",
  },
  userText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "600",
  },
  aiText: {
    color: "#000000",
    fontSize: 14,
  },
  toolLabel: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 4,
  },
});

