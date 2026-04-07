import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCreateMeeting } from "../../../src/hooks/useMeetings";
import { useContacts } from "../../../src/hooks/useContacts";
import { useAuthStore } from "../../../src/stores/auth.store";
import { parseError } from "../../../src/utils/error.utils";
import ErrorMessage from "../../../src/components/common/ErrorMessage";
import type { Contact } from "../../../src/types/api.types";

// ── helpers ───────────────────────────────────────────────────────────
function pad2(n: string) {
  return n.padStart(2, "0");
}

function toISODate(
  day: string, month: string, year: string,
  hour: string, minute: string,
): string {
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
  ).toISOString();
}

function isValidInt(s: string, min: number, max: number) {
  const n = Number(s);
  return s.trim() !== "" && !isNaN(n) && n >= min && n <= max;
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── Section header ────────────────────────────────────────────────────
function SectionHeader({
  icon, label, required = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  required?: boolean;
}) {
  return (
    <View style={sec.header}>
      <Ionicons name={icon} size={16} color="#9ca3af" />
      <Text style={sec.label}>{label}</Text>
      {required && (
        <View style={sec.badge}>
          <Text style={sec.badgeText}>REQUIRED</Text>
        </View>
      )}
    </View>
  );
}

const sec = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  label:  { fontSize: 12, fontWeight: "900", color: "#9ca3af", letterSpacing: 1.5, flex: 1 },
  badge:  { backgroundColor: "rgba(251,191,36,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: "900", color: "#FBBF24", letterSpacing: 1 },
});

// ── Date picker ───────────────────────────────────────────────────────
function DateRow({
  day, month, year, setDay, setMonth, setYear,
}: {
  day: string; month: string; year: string;
  setDay(v: string): void; setMonth(v: string): void; setYear(v: string): void;
}) {
  const monthRef = useRef<TextInput>(null);
  const yearRef  = useRef<TextInput>(null);

  const showPreview = !!day && !!month && year.length === 4;
  const monthName   = showPreview ? MONTH_NAMES[Number(month) - 1] : null;

  return (
    <View>
      <View style={dt.row}>
        {/* Day */}
        <View style={dt.segWrap}>
          <Text style={dt.segLabel}>DAY</Text>
          <TextInput
            style={dt.seg}
            value={day}
            onChangeText={(v) => {
              const clean = v.replace(/\D/g, "").slice(0, 2);
              setDay(clean);
              if (clean.length === 2) monthRef.current?.focus();
            }}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="DD"
            placeholderTextColor="#4b5563"
            textAlign="center"
          />
        </View>

        <Text style={dt.sep}>/</Text>

        {/* Month */}
        <View style={dt.segWrap}>
          <Text style={dt.segLabel}>MONTH</Text>
          <TextInput
            ref={monthRef}
            style={dt.seg}
            value={month}
            onChangeText={(v) => {
              const clean = v.replace(/\D/g, "").slice(0, 2);
              setMonth(clean);
              if (clean.length === 2) yearRef.current?.focus();
            }}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="MM"
            placeholderTextColor="#4b5563"
            textAlign="center"
          />
        </View>

        <Text style={dt.sep}>/</Text>

        {/* Year */}
        <View style={[dt.segWrap, dt.segYear]}>
          <Text style={dt.segLabel}>YEAR</Text>
          <TextInput
            ref={yearRef}
            style={dt.seg}
            value={year}
            onChangeText={(v) => setYear(v.replace(/\D/g, "").slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="YYYY"
            placeholderTextColor="#4b5563"
            textAlign="center"
          />
        </View>
      </View>

      {showPreview ? (
        <View style={dt.preview}>
          <Ionicons name="calendar-outline" size={13} color="#FBBF24" />
          <Text style={dt.previewText}>
            {monthName} {day}, {year}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Time picker ───────────────────────────────────────────────────────
function TimeRow({
  hour, minute, label, setHour, setMinute,
}: {
  hour: string; minute: string; label: string;
  setHour(v: string): void; setMinute(v: string): void;
}) {
  const minRef = useRef<TextInput>(null);
  const showPreview = !!hour && !!minute;

  return (
    <View>
      <View style={dt.row}>
        <View style={dt.segWrap}>
          <Text style={dt.segLabel}>HH</Text>
          <TextInput
            style={dt.seg}
            value={hour}
            onChangeText={(v) => {
              const clean = v.replace(/\D/g, "").slice(0, 2);
              setHour(clean);
              if (clean.length === 2) minRef.current?.focus();
            }}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="00"
            placeholderTextColor="#4b5563"
            textAlign="center"
          />
        </View>

        <Text style={dt.sep}>:</Text>

        <View style={dt.segWrap}>
          <Text style={dt.segLabel}>MM</Text>
          <TextInput
            ref={minRef}
            style={dt.seg}
            value={minute}
            onChangeText={(v) => setMinute(v.replace(/\D/g, "").slice(0, 2))}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="00"
            placeholderTextColor="#4b5563"
            textAlign="center"
          />
        </View>
      </View>

      {showPreview ? (
        <View style={dt.preview}>
          <Ionicons name="time-outline" size={13} color="#FBBF24" />
          <Text style={dt.previewText}>
            {pad2(hour)}:{pad2(minute)} — {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const dt = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  segWrap: { flex: 1, alignItems: "center" },
  segYear: { flex: 1.6 },
  seg: {
    width: "100%",
    backgroundColor: "#1a1a2e",
    borderWidth: 2,
    borderColor: "#374151",
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: "800",
    color: "#FBBF24",
  },
  segLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#6b7280",
    letterSpacing: 1.5,
    marginBottom: 4,
    textAlign: "center",
  },
  sep: {
    fontSize: 22,
    color: "#374151",
    fontWeight: "700",
    marginBottom: 14,
  },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#FBBF24",
  },
  previewText: { color: "#FBBF24", fontSize: 13, fontWeight: "700" },
});

// ── Contact picker ────────────────────────────────────────────────────
function ContactPicker({
  selected, onToggle, contacts,
}: {
  selected: Contact[];
  onToggle(c: Contact): void;
  contacts: Contact[];
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");

  const filtered = contacts.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  function isSelected(c: Contact) {
    return selected.some((s) => s.id === c.id);
  }

  return (
    <View>
      {/* Selected chips */}
      {selected.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={cp.chipScroll}
          contentContainerStyle={cp.chipContent}
        >
          {selected.map((c) => (
            <Pressable key={c.id} style={cp.chip} onPress={() => onToggle(c)}>
              <Text style={cp.chipName}>{c.name}</Text>
              <Ionicons name="close" size={13} color="#000" style={{ marginLeft: 4 }} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {/* Trigger */}
      <Pressable style={cp.trigger} onPress={() => setOpen(true)}>
        <Ionicons name="person-add-outline" size={16} color="#9ca3af" />
        <Text style={cp.triggerText}>
          {selected.length === 0
            ? "Select attendees from contacts"
            : `${selected.length} attendee${selected.length > 1 ? "s" : ""} selected — tap to change`}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#FBBF24" />
      </Pressable>

      {/* Bottom-sheet modal */}
      <Modal visible={open} animationType="slide" transparent>
        <View style={cp.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        </View>
        <View style={cp.sheet}>
          <View style={cp.handle} />
          <Text style={cp.sheetTitle}>SELECT ATTENDEES</Text>

          {/* Search */}
          <View style={cp.searchWrap}>
            <Ionicons name="search-outline" size={16} color="#6b7280" />
            <TextInput
              style={cp.search}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name or email"
              placeholderTextColor="#6b7280"
            />
          </View>

          {filtered.length === 0 ? (
            <View style={cp.emptyWrap}>
              <Ionicons name="people-outline" size={32} color="#374151" />
              <Text style={cp.emptyText}>
                {contacts.length === 0
                  ? "No contacts saved yet"
                  : "No results for that search"}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(c) => c.id}
              style={{ flex: 1 }}
              renderItem={({ item: c }) => {
                const sel      = isSelected(c);
                const hasEmail = !!c.email;
                return (
                  <Pressable
                    style={[cp.row, sel ? cp.rowSel : null]}
                    onPress={() => { if (hasEmail) onToggle(c); }}
                    disabled={!hasEmail}
                  >
                    <View style={[cp.avatar, sel ? cp.avatarSel : null]}>
                      <Text style={[cp.avatarLetter, sel ? cp.avatarLetterSel : null]}>
                        {c.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={cp.rowInfo}>
                      <Text style={[cp.rowName, !hasEmail ? cp.rowNameDim : null]}>
                        {c.name}
                      </Text>
                      <Text style={cp.rowEmail}>
                        {c.email ?? "No email — cannot be added as attendee"}
                      </Text>
                    </View>

                    {sel ? (
                      <View style={cp.checkWrap}>
                        <Ionicons name="checkmark" size={16} color="#000" />
                      </View>
                    ) : null}
                  </Pressable>
                );
              }}
            />
          )}

          <View style={cp.doneWrap}>
            <Pressable
              style={cp.doneBtn}
              onPress={() => { setOpen(false); setSearch(""); }}
            >
              <Text style={cp.doneBtnText}>
                {selected.length > 0
                  ? `DONE  (${selected.length} selected)`
                  : "DONE"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const cp = StyleSheet.create({
  chipScroll:  { marginBottom: 10 },
  chipContent: { gap: 8, paddingVertical: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBBF24",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  chipName: { color: "#000", fontWeight: "800", fontSize: 13 },

  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1a1a2e",
    borderWidth: 2,
    borderColor: "#374151",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  triggerText: { flex: 1, color: "#9ca3af", fontSize: 14 },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "72%",
    backgroundColor: "#111827",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40, height: 4, backgroundColor: "#374151",
    borderRadius: 2, alignSelf: "center", marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 12, fontWeight: "900", color: "#9ca3af",
    letterSpacing: 2, marginBottom: 14,
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1f2937",
    borderWidth: 1.5,
    borderColor: "#374151",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 10,
  },
  search: { flex: 1, fontSize: 15, color: "#fff" },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { color: "#6b7280", fontSize: 14 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    gap: 12,
  },
  rowSel: { backgroundColor: "rgba(251,191,36,0.06)" },

  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#1f2937",
    borderWidth: 2, borderColor: "#374151",
    alignItems: "center", justifyContent: "center",
  },
  avatarSel:        { borderColor: "#FBBF24", backgroundColor: "rgba(251,191,36,0.15)" },
  avatarLetter:     { color: "#9ca3af", fontWeight: "900", fontSize: 16 },
  avatarLetterSel:  { color: "#FBBF24" },

  rowInfo:    { flex: 1 },
  rowName:    { color: "#fff", fontWeight: "700", fontSize: 15 },
  rowNameDim: { color: "#4b5563" },
  rowEmail:   { color: "#6b7280", fontSize: 12, marginTop: 2 },

  checkWrap: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#FBBF24",
    alignItems: "center", justifyContent: "center",
  },

  doneWrap: { paddingVertical: 16 },
  doneBtn: {
    backgroundColor: "#FBBF24",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },
  doneBtnText: { color: "#000", fontWeight: "900", fontSize: 15, letterSpacing: 1 },
});

// ── Main screen ───────────────────────────────────────────────────────
export default function NewMeetingScreen() {
  const router        = useRouter();
  const createMeeting = useCreateMeeting();
  const token         = useAuthStore((s) => s.token);
  const { data: contacts = [] } = useContacts();

  const [title, setTitle]               = useState("");
  const [day,   setDay]                 = useState("");
  const [month, setMonth]               = useState("");
  const [year,  setYear]                = useState("");
  const [startHour, setStartHour]       = useState("");
  const [startMin,  setStartMin]        = useState("");
  const [endHour,   setEndHour]         = useState("");
  const [endMin,    setEndMin]          = useState("");
  const [selectedContacts, setSelected] = useState<Contact[]>([]);
  const [agenda, setAgenda]             = useState("");
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    setYear(String(new Date().getFullYear()));
  }, []);

  function toggleContact(c: Contact) {
    setSelected((prev) =>
      prev.some((s) => s.id === c.id)
        ? prev.filter((s) => s.id !== c.id)
        : [...prev, c],
    );
  }

  function handleCreate() {
    setError(null);
    if (!token)                        { setError("You must be logged in"); return; }
    if (!title.trim())                 { setError("Meeting title is required"); return; }
    if (!isValidInt(day,   1, 31))     { setError("Enter a valid day (1–31)"); return; }
    if (!isValidInt(month, 1, 12))     { setError("Enter a valid month (1–12)"); return; }
    if (year.length !== 4)             { setError("Enter a valid 4-digit year"); return; }
    if (!isValidInt(startHour, 0, 23)) { setError("Start hour must be 0–23"); return; }
    if (!isValidInt(startMin,  0, 59)) { setError("Start minute must be 0–59"); return; }
    if (!isValidInt(endHour,   0, 23)) { setError("End hour must be 0–23"); return; }
    if (!isValidInt(endMin,    0, 59)) { setError("End minute must be 0–59"); return; }
    if (selectedContacts.length === 0) { setError("Add at least one attendee"); return; }

    const start = toISODate(day, month, year, startHour, startMin);
    const end   = toISODate(day, month, year, endHour, endMin);

    if (new Date(end) <= new Date(start)) {
      setError("End time must be after start time");
      return;
    }

    const attendees = selectedContacts
      .map((c) => c.email)
      .filter((e): e is string => !!e);

    createMeeting.mutate(
      {
        title: title.trim(),
        startTime: start,
        endTime: end,
        attendees,
        ...(agenda.trim() ? { agenda: agenda.trim() } : {}),
      },
      {
        onSuccess: () => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(app)/dashboard/meetings");
          }
        },
        onError:   (err) => setError(parseError(err)),
      },
    );
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <Pressable
        onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/dashboard/meetings")}
        style={s.backBtn}
      >
        <Text style={s.backText}>← BACK</Text>
      </Pressable>
      <Text style={s.pageTitle}>NEW MEETING</Text>
      <Text style={s.pageSub}>Fill in the details to schedule a meeting</Text>

      {/* ── Title ── */}
      <View style={s.card}>
        <SectionHeader icon="pencil-outline" label="MEETING TITLE" required />
        <TextInput
          style={s.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Product sync with team"
          placeholderTextColor="#4b5563"
          returnKeyType="next"
        />
      </View>

      {/* ── Date ── */}
      <View style={s.card}>
        <SectionHeader icon="calendar-outline" label="DATE" required />
        <DateRow
          day={day} month={month} year={year}
          setDay={setDay} setMonth={setMonth} setYear={setYear}
        />
      </View>

      {/* ── Time ── */}
      <View style={s.card}>
        <SectionHeader icon="time-outline" label="TIME" required />
        <View style={s.timeGrid}>
          <View style={s.timeCol}>
            <Text style={s.timeLabel}>START TIME</Text>
            <TimeRow
              hour={startHour} minute={startMin} label="Start"
              setHour={setStartHour} setMinute={setStartMin}
            />
          </View>
          <View style={s.timeDivider} />
          <View style={s.timeCol}>
            <Text style={s.timeLabel}>END TIME</Text>
            <TimeRow
              hour={endHour} minute={endMin} label="End"
              setHour={setEndHour} setMinute={setEndMin}
            />
          </View>
        </View>
      </View>

      {/* ── Attendees ── */}
      <View style={s.card}>
        <SectionHeader icon="people-outline" label="ATTENDEES" required />
        <Text style={s.hint}>
          Select from your saved contacts. Only contacts with an email can be added.
        </Text>
        <ContactPicker
          selected={selectedContacts}
          onToggle={toggleContact}
          contacts={contacts}
        />
      </View>

      {/* ── Agenda ── */}
      <View style={s.card}>
        <SectionHeader icon="document-text-outline" label="MEETING AGENDA" />
        <Text style={s.hint}>
          What should the AI ask or achieve during the auto-call?
        </Text>
        <TextInput
          style={[s.input, s.textArea]}
          value={agenda}
          onChangeText={setAgenda}
          placeholder="e.g. Confirm project deadline, check blockers, get status update"
          placeholderTextColor="#4b5563"
          multiline
          returnKeyType="done"
        />
      </View>

      <ErrorMessage message={error} />

      <Pressable
        style={[s.createBtn, createMeeting.isPending ? s.createBtnDisabled : null]}
        onPress={handleCreate}
        disabled={createMeeting.isPending}
      >
        <Ionicons
          name="checkmark-circle-outline"
          size={20}
          color="#000"
          style={{ marginRight: 8 }}
        />
        <Text style={s.createBtnText}>
          {createMeeting.isPending ? "CREATING…" : "CREATE MEETING"}
        </Text>
      </Pressable>

      <View style={s.bottomPad} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: "#09090b" },
  content: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 32 },

  backBtn:  { alignSelf: "flex-start", marginBottom: 4 },
  backText: { color: "#FBBF24", fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },

  pageTitle: { fontSize: 30, fontWeight: "900", color: "#fff", letterSpacing: -0.5, marginTop: 8 },
  pageSub:   { fontSize: 13, color: "#6b7280", marginTop: 4, marginBottom: 24 },

  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  hint: { fontSize: 12, color: "#4b5563", marginBottom: 12, lineHeight: 18 },

  input: {
    backgroundColor: "#1a1a2e",
    borderWidth: 2,
    borderColor: "#374151",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: "#fff",
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },

  timeGrid: { flexDirection: "row", gap: 4, alignItems: "flex-start" },
  timeCol:  { flex: 1 },
  timeDivider: {
    width: 1.5,
    backgroundColor: "#1f2937",
    alignSelf: "stretch",
    marginHorizontal: 6,
    marginTop: 22,
  },
  timeLabel: {
    fontSize: 10, fontWeight: "900", color: "#6b7280",
    letterSpacing: 1.5, textAlign: "center", marginBottom: 8,
  },

  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBBF24",
    borderRadius: 14,
    paddingVertical: 17,
    marginTop: 8,
    shadowColor: "#FBBF24",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: "#000", fontWeight: "900", fontSize: 16, letterSpacing: 1.5 },

  bottomPad: { height: 40 },
});
