import { useEffect, useState } from "react";
import { FlatList, StyleSheet, TextInput, View, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useContacts } from "../../../src/hooks/useContacts";
import ContactCard from "../../../src/components/contacts/ContactCard";
import { Appear, EmptyState, IconButton, Screen, ScreenHeader, Skeleton } from "../../../src/components/ui";
import { colors, radius } from "../../../src/theme";

export default function ContactsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: contacts, isLoading, refetch, isRefetching } = useContacts(debounced || undefined);
  const addContact = () => router.push("/(app)/contact/new");

  return (
    <Screen>
      <ScreenHeader
        title="Contacts"
        subtitle={contacts?.length ? `${contacts.length} people` : "People xTanBot can reach"}
        right={<IconButton icon="person-add" onPress={addContact} accessibilityLabel="Add contact" />}
      />
      <Appear style={s.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textSubtle} />
        <TextInput
          style={s.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, phone or company"
          placeholderTextColor={colors.textSubtle}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {search ? <Ionicons name="close-circle" size={18} color={colors.textSubtle} onPress={() => setSearch("")} /> : null}
      </Appear>
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <Appear index={index}>
            <ContactCard contact={item} onPress={() => router.push(`/(app)/contact/${item.id}`)} />
          </Appear>
        )}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          isLoading ? (
            <View>{[0, 1, 2].map((i) => <Skeleton key={i} />)}</View>
          ) : debounced ? (
            <EmptyState icon="search" title="No matches" subtitle={`Nobody matches “${debounced}”.`} />
          ) : (
            <EmptyState
              icon="people-outline"
              title="No contacts yet"
              subtitle="Add people so xTanBot can call or message them by name."
              action={{ label: "Add contact", onPress: addContact }}
            />
          )
        }
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    maxWidth: 780,
    alignSelf: Platform.OS === "web" ? "center" : "auto",
    width: Platform.OS === "web" ? "100%" : undefined,
  },
  search: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 12,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
  },
  list: { paddingHorizontal: 20, paddingBottom: 24, width: "100%", maxWidth: 820, alignSelf: "center" },
});
