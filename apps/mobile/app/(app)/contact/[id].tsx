import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  useContact,
  useUpdateContact,
  useDeleteContact,
} from "../../../src/hooks/useContacts";
import { parseError } from "../../../src/utils/error.utils";
import { formatDate } from "../../../src/utils/date.utils";
import ContactAvatar from "../../../src/components/contacts/ContactAvatar";
import Button from "../../../src/components/common/Button";
import Input from "../../../src/components/common/Input";
import ErrorMessage from "../../../src/components/common/ErrorMessage";

export default function ContactDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: contact, isLoading } = useContact(id!);
  const updateContact = useUpdateContact(id!);
  const deleteContact = useDeleteContact(id!);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    if (!contact) return;
    setEditName(contact.name);
    setEditPhone(contact.phone ?? "");
    setEditEmail(contact.email ?? "");
    setEditCompany(contact.company ?? "");
    setEditNotes(contact.notes ?? "");
    setError(null);
    setIsEditing(true);
  }

  function handleSave() {
    setError(null);

    if (!editName.trim()) {
      setError("Name is required");
      return;
    }

    updateContact.mutate(
      {
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
        email: editEmail.trim() || undefined,
        company: editCompany.trim() || undefined,
        notes: editNotes.trim() || undefined,
      },
      {
        onSuccess: () => setIsEditing(false),
        onError: (err) => setError(parseError(err)),
      },
    );
  }

  function handleDelete() {
    Alert.alert(
      "Delete Contact",
      "Are you sure? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteContact.mutate(undefined, {
              onSuccess: () => router.back(),
              onError: (err) => setError(parseError(err)),
            });
          },
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← BACK</Text>
        </Pressable>
        <View style={styles.skeletonCard} />
        <ActivityIndicator
          color="#FBBF24"
          size="large"
          style={{ marginTop: 24 }}
        />
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.notFound}>Contact not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← BACK</Text>
      </Pressable>

      <View style={styles.headerRow}>
        <ContactAvatar name={contact.name} size={56} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{contact.name}</Text>
          {contact.company ? (
            <Text style={styles.subtitle}>{contact.company}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        {contact.phone ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PHONE</Text>
            <Text style={styles.infoValue}>{contact.phone}</Text>
          </View>
        ) : null}

        {contact.email ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>EMAIL</Text>
            <Text style={styles.infoValue}>{contact.email}</Text>
          </View>
        ) : null}

        {contact.company ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>COMPANY</Text>
            <Text style={styles.infoValue}>{contact.company}</Text>
          </View>
        ) : null}

        {contact.notes ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>NOTES</Text>
            <Text style={styles.infoValue}>{contact.notes}</Text>
          </View>
        ) : null}

        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>ADDED</Text>
          <Text style={styles.infoValue}>{formatDate(contact.createdAt)}</Text>
        </View>
      </View>

      {isEditing ? (
        <View style={[styles.card, { marginTop: 16 }]}>
          <Text style={styles.cardTitle}>EDIT CONTACT</Text>

          <Input
            label="FULL NAME *"
            value={editName}
            onChangeText={setEditName}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <Input
            label="PHONE NUMBER"
            value={editPhone}
            onChangeText={setEditPhone}
            keyboardType="phone-pad"
            returnKeyType="next"
          />
          <Input
            label="EMAIL"
            value={editEmail}
            onChangeText={setEditEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />
          <Input
            label="COMPANY"
            value={editCompany}
            onChangeText={setEditCompany}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <Input
            label="NOTES"
            value={editNotes}
            onChangeText={setEditNotes}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <ErrorMessage message={error} />

          <Button
            title="SAVE CHANGES"
            onPress={handleSave}
            loading={updateContact.isPending}
          />
          <View style={{ height: 8 }} />
          <Button
            title="CANCEL"
            variant="ghost"
            onPress={() => setIsEditing(false)}
          />
        </View>
      ) : (
        <View style={{ marginTop: 16 }}>
          <Button
            title="EDIT CONTACT"
            variant="secondary"
            onPress={startEditing}
          />
        </View>
      )}

      <View style={{ marginTop: 8 }}>
        <ErrorMessage message={!isEditing ? error : null} />
        <Pressable
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={deleteContact.isPending}
        >
          {deleteContact.isPending ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.deleteText}>DELETE CONTACT</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  content: {
    paddingBottom: 48,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  notFound: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  backButton: {
    alignSelf: "flex-start",
  },
  backText: {
    color: "#FBBF24",
    fontWeight: "900",
    fontSize: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 24,
  },
  headerText: {
    marginLeft: 16,
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    fontWeight: "600",
    marginTop: 2,
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 3,
    borderColor: "#000000",
    borderRadius: 0,
    padding: 24,
    shadowOffset: { width: 6, height: 6 },
    shadowColor: "#000000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#000000",
    letterSpacing: 2,
    marginBottom: 24,
  },
  infoRow: {
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#f0f0f0",
  },
  infoLabel: {
    fontSize: 11,
    color: "#999",
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },
  skeletonCard: {
    backgroundColor: "#1a1a1a",
    height: 200,
    borderWidth: 3,
    borderColor: "#333",
    borderRadius: 0,
    marginTop: 24,
  },
  deleteButton: {
    backgroundColor: "#EF4444",
    borderWidth: 3,
    borderColor: "#000",
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 3, height: 3 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  deleteText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
  },
});
