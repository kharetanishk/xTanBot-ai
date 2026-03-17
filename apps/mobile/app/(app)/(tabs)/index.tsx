import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../../src/stores/auth.store";
import { useCalls } from "../../../src/hooks/useCalls";
import { useUpcomingMeetings } from "../../../src/hooks/useMeetings";
import { useContacts } from "../../../src/hooks/useContacts";
import CallCard from "../../../src/components/calls/CallCard";
import MeetingCard from "../../../src/components/meetings/MeetingCard";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: calls = [], isLoading: callsLoading } = useCalls({ refetchInterval: 5000 });
  const { data: upcomingMeetings = [], isLoading: meetingsLoading } = useUpcomingMeetings();
  const { data: contacts = [], isLoading: contactsLoading } = useContacts();

  const sortedCalls = [...calls].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const recentCalls = sortedCalls.slice(0, 3);
  const nextMeetings = upcomingMeetings.slice(0, 3);
  const activeCalls = calls.filter(
    (c) => c.status === "in-progress" || c.status === "ringing" || c.status === "initiated",
  );

  const loading = callsLoading || meetingsLoading || contactsLoading;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()}, {user?.name ?? "there"}</Text>
        <Text style={styles.subtitle}>{getFormattedDate()}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{loading ? "—" : calls.length}</Text>
          <Text style={styles.statLabel}>TOTAL CALLS</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{loading ? "—" : upcomingMeetings.length}</Text>
          <Text style={styles.statLabel}>UPCOMING</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{loading ? "—" : contacts.length}</Text>
          <Text style={styles.statLabel}>CONTACTS</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{loading ? "—" : activeCalls.length}</Text>
          <Text style={styles.statLabel}>ACTIVE NOW</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={styles.actionButton}
          onPress={() => router.push("/(app)/call/new")}
        >
          <Text style={styles.actionEmoji}>📞</Text>
          <Text style={styles.actionText}>NEW CALL</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => router.push("/(app)/meeting/new")}
        >
          <Text style={styles.actionEmoji}>📅</Text>
          <Text style={styles.actionText}>NEW MEETING</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECENT CALLS</Text>
          <Pressable onPress={() => router.push("/(app)/(tabs)/calls")}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {loading ? (
          [0, 1, 2].map((i) => <View key={i} style={styles.skeleton} />)
        ) : recentCalls.length === 0 ? (
          <Text style={styles.empty}>No calls yet</Text>
        ) : (
          recentCalls.map((call) => (
            <CallCard
              key={call.id}
              call={call}
              onPress={() => router.push(`/(app)/call/${call.id}`)}
            />
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>UPCOMING</Text>
          <Pressable onPress={() => router.push("/(app)/(tabs)/meetings")}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {loading ? (
          [0, 1, 2].map((i) => <View key={i} style={styles.skeleton} />)
        ) : nextMeetings.length === 0 ? (
          <Text style={styles.empty}>No upcoming meetings</Text>
        ) : (
          nextMeetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onPress={() => router.push(`/(app)/meeting/${meeting.id}`)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 32 },
  header: { marginBottom: 24 },
  greeting: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#ffffff",
    borderWidth: 3,
    borderColor: "#000",
    borderRadius: 0,
    padding: 16,
    shadowOffset: { width: 4, height: 4 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FBBF24",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#6b7280",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#FBBF24",
    borderWidth: 3,
    borderColor: "#000",
    borderRadius: 0,
    padding: 20,
    alignItems: "center",
    shadowOffset: { width: 4, height: 4 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  actionEmoji: { fontSize: 24, marginBottom: 8 },
  actionText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#000",
  },
  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#6b7280",
    letterSpacing: 1,
  },
  seeAll: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FBBF24",
  },
  skeleton: {
    height: 72,
    backgroundColor: "#1a1a1a",
    borderWidth: 3,
    borderColor: "#333",
    borderRadius: 0,
    marginBottom: 12,
  },
  empty: {
    fontSize: 14,
    color: "#6b7280",
  },
});
