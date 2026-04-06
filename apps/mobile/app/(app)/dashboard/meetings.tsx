import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useMeetings, useUpcomingMeetings } from "../../../src/hooks/useMeetings";
import MeetingCard from "../../../src/components/meetings/MeetingCard";
import { isUpcoming } from "../../../src/utils/date.utils";

export default function MeetingsScreen() {
  const router = useRouter();
  const { data: allMeetings, isLoading, refetch, isRefetching } = useMeetings();
  const { data: upcoming = [] } = useUpcomingMeetings();

  const past = (allMeetings ?? []).filter((m) => !isUpcoming(m.endTime));

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>MEETINGS</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => router.push("/(app)/meeting/new")}
        >
          <Text style={styles.addButtonText}>New Meeting</Text>
        </Pressable>
      </View>

      <FlatList
        ListHeaderComponent={
          <>
            <Text style={styles.sectionTitle}>UPCOMING</Text>
            {upcoming.length === 0 && !isLoading && (
              <Text style={styles.emptySection}>No upcoming meetings</Text>
            )}
            {upcoming.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                onPress={() => router.push(`/(app)/meeting/${m.id}`)}
              />
            ))}
            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>PAST</Text>
            {past.length === 0 && !isLoading && (
              <Text style={styles.emptySection}>No past meetings</Text>
            )}
          </>
        }
        data={past}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MeetingCard
            meeting={item}
            onPress={() => router.push(`/(app)/meeting/${item.id}`)}
          />
        )}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={null}
        style={styles.list}
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#6b7280",
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptySection: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 12,
  },
  list: { flex: 1 },
});
