import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  useContact,
  useUpdateContact,
  useDeleteContact,
} from "../../../src/hooks/useContacts";
import { parseError } from "../../../src/utils/error.utils";
import { formatDate } from "../../../src/utils/date.utils";
import ContactAvatar from "../../../src/components/contacts/ContactAvatar";
import {
  Screen, Appear, IconTile, PrimaryButton, Skeleton, EmptyState, type IconName,
} from "../../../src/components/ui";
import { colors, radius } from "../../../src/theme";
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const wide = useWindowDimensions().width >= 760;

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

  // Two-tap delete: Alert.alert is a no-op on web, so confirm inline instead.
  function handleDelete() {
    if (!confirmDelete) return setConfirmDelete(true);
    deleteContact.mutate(undefined, {
      onSuccess: () => back(),
      onError: (err) => {
        setConfirmDelete(false);
        setError(parseError(err));
      },
    });
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(app)/dashboard/contacts"));

  if (isLoading) {
    return (
      <Screen>
        <View style={[styles.content, { paddingTop: 12 }]}>
          <Skeleton height={140} />
          <Skeleton height={220} />
        </View>
      </Screen>
    );
  }

  if (!contact) {
    return (
      <Screen>
        <EmptyState icon="person-outline" title="Contact not found" subtitle="It may have been deleted." />
      </Screen>
    );
  }

  const actions: { icon: IconName; label: string; onPress?: () => void }[] = [
    { icon: "call", label: "Call", onPress: contact.phone ? () => void Linking.openURL(`tel:${contact.phone}`) : undefined },
    { icon: "mail", label: "Email", onPress: contact.email ? () => void Linking.openURL(`mailto:${contact.email}`) : undefined },
    { icon: "calendar", label: "Meeting", onPress: () => router.push("/meeting/new") },
    { icon: "create", label: "Edit", onPress: startEditing },
  ];

  const rows: { icon: IconName; label: string; value?: string }[] = [
    { icon: "call-outline", label: "Phone", value: contact.phone },
    { icon: "mail-outline", label: "Email", value: contact.email },
    { icon: "business-outline", label: "Company", value: contact.company },
    { icon: "document-text-outline", label: "Notes", value: contact.notes },
    { icon: "time-outline", label: "Added", value: formatDate(contact.createdAt) },
  ];

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    extra: Partial<React.ComponentProps<typeof Input>> = {},
  ) => (
    <View style={wide ? styles.half : undefined}>
      <Input label={label} value={value} onChangeText={set} {...extra} />
    </View>
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={back} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={16} color={colors.accent} />
          <Text style={styles.backText}>Contacts</Text>
        </Pressable>

        {/* Hero */}
        <Appear index={0}>
          <View style={[styles.hero, wide && styles.heroWide]}>
            <View style={styles.heroGlow} />
            <ContactAvatar name={contact.name} size={wide ? 88 : 76} />
            <View style={[styles.heroText, wide && { alignItems: "flex-start" }]}>
              <Text style={[styles.title, wide && { textAlign: "left" }]}>{contact.name}</Text>
              {contact.company ? <Text style={styles.subtitle}>{contact.company}</Text> : null}
            </View>
            <View style={styles.actions}>
              {actions.map((a) => (
                <Pressable
                  key={a.label}
                  onPress={a.onPress}
                  disabled={!a.onPress}
                  style={({ pressed }) => [styles.action, !a.onPress && { opacity: 0.35 }, pressed && styles.pressed]}
                >
                  <View style={styles.actionIcon}>
                    <Ionicons name={a.icon} size={20} color={colors.accent} />
                  </View>
                  <Text style={styles.actionText}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Appear>

        {isEditing ? (
          <Appear index={1}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Edit contact</Text>
              <View style={wide ? styles.formGrid : undefined}>
                {field("FULL NAME *", editName, setEditName, { autoCapitalize: "words" })}
                {field("PHONE NUMBER", editPhone, setEditPhone, { keyboardType: "phone-pad" })}
                {field("EMAIL", editEmail, setEditEmail, { keyboardType: "email-address", autoCapitalize: "none" })}
                {field("COMPANY", editCompany, setEditCompany, { autoCapitalize: "words" })}
              </View>
              <Input label="NOTES" value={editNotes} onChangeText={setEditNotes} onSubmitEditing={handleSave} />
              <ErrorMessage message={error} />
              <View style={styles.formActions}>
                <PrimaryButton label="Cancel" tone="neutral" onPress={() => setIsEditing(false)} style={{ flex: 1 }} />
                <PrimaryButton label="Save changes" icon="checkmark" onPress={handleSave} loading={updateContact.isPending} style={{ flex: 1.4 }} />
              </View>
            </View>
          </Appear>
        ) : (
          <Appear index={1}>
            <View style={styles.card}>
              {rows.map((r, i) => (
                <View key={r.label} style={[styles.row, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
                  <IconTile icon={r.icon} tone={r.value ? "accent" : "neutral"} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{r.label}</Text>
                    <Text style={[styles.rowValue, !r.value && styles.rowEmpty]} selectable>
                      {r.value || "Not added"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Appear>
        )}

        <Appear index={2}>
          {!isEditing ? <ErrorMessage message={error} /> : null}
          <View style={styles.danger}>
            <Text style={styles.dangerText}>
              {confirmDelete ? "Delete this contact for good? This can't be undone." : "Remove this contact from xTanBot."}
            </Text>
            <View style={styles.dangerActions}>
              {confirmDelete ? (
                <PrimaryButton label="Keep" tone="neutral" onPress={() => setConfirmDelete(false)} />
              ) : null}
              <PrimaryButton
                label={confirmDelete ? "Yes, delete" : "Delete"}
                icon="trash-outline"
                tone="danger"
                onPress={handleDelete}
                loading={deleteContact.isPending}
              />
            </View>
          </View>
        </Appear>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 56, width: "100%", maxWidth: 820, alignSelf: "center", gap: 14 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 6 },
  backText: { color: colors.accent, fontWeight: "700", fontSize: 14 },

  hero: {
    alignItems: "center",
    gap: 12,
    padding: 24,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  heroWide: { flexDirection: "row", flexWrap: "wrap", gap: 20, padding: 28 },
  heroGlow: {
    position: "absolute", width: 300, height: 300, borderRadius: 150, top: -170, right: -60,
    backgroundColor: "rgba(251,191,36,0.09)",
  },
  heroText: { flex: 1, minWidth: 180, alignItems: "center" },
  title: { fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.5, textAlign: "center" },
  subtitle: { fontSize: 15, color: colors.textMuted, fontWeight: "600", marginTop: 4 },

  actions: { flexDirection: "row", gap: 10 },
  action: { alignItems: "center", gap: 6, width: 64 },
  actionIcon: {
    width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: "rgba(251,191,36,0.25)",
  },
  actionText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },

  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 18 },
  cardTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { fontSize: 12, color: colors.textSubtle, fontWeight: "700" },
  rowValue: { fontSize: 16, fontWeight: "600", color: colors.text, marginTop: 2 },
  rowEmpty: { color: colors.textSubtle, fontWeight: "500" },

  formGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 16 },
  half: { width: "48%", flexGrow: 1 },
  formActions: { flexDirection: "row", gap: 12, marginTop: 8 },

  danger: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12,
    padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", backgroundColor: "rgba(239,68,68,0.05)",
  },
  dangerText: { color: colors.textMuted, fontSize: 14, flex: 1, minWidth: 200 },
  dangerActions: { flexDirection: "row", gap: 10 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
