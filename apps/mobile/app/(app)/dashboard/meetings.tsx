import { SectionList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMeetings, useUpcomingMeetings } from "../../../src/hooks/useMeetings";
import MeetingCard from "../../../src/components/meetings/MeetingCard";
import { isUpcoming } from "../../../src/utils/date.utils";
import { Appear, EmptyState, IconButton, PhoneCallsNotice, Screen, ScreenHeader, Skeleton } from "../../../src/components/ui";
import { colors } from "../../../src/theme";

export default function MeetingsScreen() {
  const router = useRouter();
  const { data: allMeetings, isLoading, refetch, isRefetching } = useMeetings();
  const { data: upcoming = [] } = useUpcomingMeetings();
  const past = (allMeetings ?? []).filter((m) => !isUpcoming(m.endTime));
  const newMeeting = () => router.push("/(app)/meeting/new");

  const sections = [
    { title: "Upcoming", data: upcoming },
    { title: "Past", data: past },
  ].filter((sec) => sec.data.length > 0);

  return (
    <Screen>
      <ScreenHeader
        title="Meetings"
        subtitle={upcoming.length ? `${upcoming.length} coming up` : "Your schedule"}
        right={<IconButton icon="add" onPress={newMeeting} accessibilityLabel="New meeting" />}
      />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={<PhoneCallsNotice message="Your meetings are saved and you still get reminders, but xTanBot won't auto-call attendees for now while we're on a free calling plan." />}
        renderSectionHeader={({ section }) => <Text style={s.section}>{section.title}</Text>}
        renderItem={({ item, index }) => (
          <Appear index={index}>
            <MeetingCard meeting={item} onPress={() => router.push(`/(app)/meeting/${item.id}`)} />
          </Appear>
        )}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          isLoading ? (
            <View>{[0, 1, 2].map((i) => <Skeleton key={i} />)}</View>
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="No meetings yet"
              subtitle="Schedule one here, or tell xTanBot who to meet and when."
              action={{ label: "New meeting", onPress: newMeeting }}
            />
          )
        }
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 24, width: "100%", maxWidth: 820, alignSelf: "center" },
  section: { color: colors.textMuted, fontSize: 13, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 8, marginBottom: 10 },
});
