import { FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useCalls } from "../../../src/hooks/useCalls";
import CallCard from "../../../src/components/calls/CallCard";
import { Appear, EmptyState, IconButton, Screen, ScreenHeader, Skeleton } from "../../../src/components/ui";
import { colors } from "../../../src/theme";

export default function CallsScreen() {
  const router = useRouter();
  const { data: calls, isLoading, refetch, isRefetching } = useCalls();
  const sorted = [...(calls ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const newCall = () => router.push("/(app)/call/new");

  return (
    <Screen>
      <ScreenHeader
        title="Calls"
        subtitle={sorted.length ? `${sorted.length} call${sorted.length > 1 ? "s" : ""} placed by xTanBot` : "Calls placed by xTanBot"}
        right={<IconButton icon="add" onPress={newCall} accessibilityLabel="New call" />}
      />
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <Appear index={index}>
            <CallCard call={item} onPress={() => router.push(`/(app)/call/${item.id}`)} />
          </Appear>
        )}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          isLoading ? (
            <View>{[0, 1, 2].map((i) => <Skeleton key={i} />)}</View>
          ) : (
            <EmptyState
              icon="call-outline"
              title="No calls yet"
              subtitle="Place a call yourself, or just ask xTanBot to call someone for you."
              action={{ label: "New call", onPress: newCall }}
            />
          )
        }
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 24, width: "100%", maxWidth: 820, alignSelf: "center", backgroundColor: colors.bg },
});
