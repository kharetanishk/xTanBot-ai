import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useCalls } from "../../../src/hooks/useCalls";
import CallCard from "../../../src/components/calls/CallCard";

export default function CallsScreen() {
  const router = useRouter();
  const { data: calls, isLoading, refetch, isRefetching } = useCalls();
  const sorted = [...(calls ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>CALLS</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => router.push("/(app)/call/new")}
        >
          <Text style={styles.addButtonText}>New Call</Text>
        </Pressable>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CallCard
            call={item}
            onPress={() => router.push(`/(app)/call/${item.id}`)}
          />
        )}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          isLoading ? (
            <View>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skeleton} />
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>NO CALLS YET</Text>
              <Text style={styles.emptySubtitle}>
                Tap "New Call" to start a voice call
              </Text>
            </View>
          )
        }
      />
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -1,
  },
  addButton: {
    backgroundColor: "#FBBF24",
    borderWidth: 3,
    borderColor: "#000",
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowOffset: { width: 3, height: 3 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#000",
  },
  skeleton: {
    backgroundColor: "#1a1a1a",
    height: 72,
    borderWidth: 3,
    borderColor: "#333",
    borderRadius: 0,
    marginBottom: 12,
  },
  empty: {
    alignItems: "center",
    marginTop: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffffff",
  },
  emptySubtitle: {
    color: "#6b7280",
    marginTop: 8,
    fontSize: 14,
  },
});
