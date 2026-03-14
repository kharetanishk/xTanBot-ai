import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useContacts } from "../../../src/hooks/useContacts";
import ContactCard from "../../../src/components/contacts/ContactCard";

export default function ContactsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: contacts, isLoading, refetch, isRefetching } = useContacts(
    debouncedSearch || undefined,
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>CONTACTS</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => router.push("/(app)/contact/new")}
        >
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Search contacts..."
        placeholderTextColor="#666666"
        autoCapitalize="none"
        returnKeyType="search"
      />

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContactCard
            contact={item}
            onPress={() => router.push(`/(app)/contact/${item.id}`)}
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
              <Text style={styles.emptyTitle}>NO CONTACTS</Text>
              <Text style={styles.emptySubtitle}>
                Tap + to add your first contact
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
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 3, height: 3 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  addButtonText: {
    fontSize: 24,
    fontWeight: "900",
    color: "#000",
  },
  searchInput: {
    backgroundColor: "#1a1a1a",
    borderWidth: 3,
    borderColor: "#333333",
    borderRadius: 0,
    color: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
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
    color: "#666",
    marginTop: 8,
    fontSize: 14,
  },
});
