/* eslint-disable one-var, sort-vars, no-nested-ternary */
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { NativeImage } from "@/components/native-image";
import {
  useLibraryRecentQuery,
  useLibrarySavedQuery,
  useLibraryWatchedQuery,
  usePublicProjectsQuery,
  useTracksQuery,
} from "@/lib/soundkit-api";
import type {
  LibraryRecentTrack,
  LibrarySavedTrack,
  LibraryWatchedItem,
  PublicProjectSummary,
  TrackSummary,
} from "@/lib/soundkit-api";

type SourceTab = "projects" | "recent" | "saved" | "tracks" | "watched";

interface SelectableRow {
  artist: string;
  cover: null | string | undefined;
  id: string;
  kind: "project" | "track";
  subtitleBadge?: string;
  title: string;
}

export interface PlaylistItemsModalProps {
  existingTrackIds?: ReadonlySet<string>;
  isSaving?: boolean;
  mode: "add-to-existing" | "create-playlist";
  onClose: () => void;
  onSave: (payload: {
    description: string;
    projectIds: string[];
    title: string;
    trackIds: string[];
  }) => Promise<void> | void;
  visible: boolean;
}

function buildActiveRows(params: {
  activeTab: SourceTab;
  catalogProjects: readonly PublicProjectSummary[];
  catalogTracks: readonly TrackSummary[];
  normalizedSearch: string;
  recentTracks: readonly LibraryRecentTrack[];
  savedTracks: readonly LibrarySavedTrack[];
  watchedItems: readonly LibraryWatchedItem[];
}): SelectableRow[] {
  const {
    activeTab,
    catalogProjects,
    catalogTracks,
    normalizedSearch,
    recentTracks,
    savedTracks,
    watchedItems,
  } = params;

  if (activeTab === "tracks") {
    return catalogTracks
      .filter(
        (t) =>
          !normalizedSearch ||
          t.title.toLowerCase().includes(normalizedSearch) ||
          t.artistName.toLowerCase().includes(normalizedSearch)
      )
      .map((t) => ({
        artist: t.artistName,
        cover: t.coverArtUrl,
        id: t.id,
        kind: "track" as const,
        subtitleBadge: t.duration || undefined,
        title: t.title,
      }));
  }

  if (activeTab === "projects") {
    return catalogProjects
      .filter(
        (p) =>
          !normalizedSearch ||
          p.title.toLowerCase().includes(normalizedSearch) ||
          (p.artistName ?? "").toLowerCase().includes(normalizedSearch)
      )
      .map((p) => ({
        artist: p.artistName ?? "SoundKit Artist",
        cover: p.coverArtUrl,
        id: p.id,
        kind: "project" as const,
        subtitleBadge: "Project",
        title: p.title,
      }));
  }

  if (activeTab === "saved") {
    return savedTracks
      .filter(
        (t) =>
          !normalizedSearch ||
          t.title.toLowerCase().includes(normalizedSearch) ||
          t.artist.toLowerCase().includes(normalizedSearch)
      )
      .map((t) => ({
        artist: t.artist,
        cover: t.cover,
        id: t.id,
        kind: "track" as const,
        subtitleBadge: t.duration || undefined,
        title: t.title,
      }));
  }

  if (activeTab === "recent") {
    return recentTracks
      .filter(
        (t) =>
          !normalizedSearch ||
          t.title.toLowerCase().includes(normalizedSearch) ||
          t.artist.toLowerCase().includes(normalizedSearch)
      )
      .map((t) => ({
        artist: t.artist,
        cover: t.cover,
        id: t.id,
        kind: "track" as const,
        subtitleBadge: t.duration || undefined,
        title: t.title,
      }));
  }

  return watchedItems
    .filter(
      (w) =>
        !normalizedSearch ||
        w.title.toLowerCase().includes(normalizedSearch) ||
        w.creator.toLowerCase().includes(normalizedSearch)
    )
    .map((w) => ({
      artist: w.creator,
      cover: w.thumbnail,
      id: w.id,
      kind: "track" as const,
      subtitleBadge: w.type,
      title: w.title,
    }));
}

function getButtonLabel(
  isAlreadySaved: boolean,
  isStaged: boolean,
  kind: "project" | "track"
): string {
  if (isAlreadySaved) {
    return "Added";
  }
  if (isStaged) {
    return "Selected";
  }
  if (kind === "project") {
    return "Add Project";
  }
  return "Add";
}

function getButtonColor(isAlreadySaved: boolean, isStaged: boolean): string {
  if (isAlreadySaved) {
    return "#71717a";
  }
  if (isStaged) {
    return "#171717";
  }
  return "#f4f4f5";
}

function getSubmitButtonText(
  mode: "add-to-existing" | "create-playlist",
  totalStagedCount: number
): string {
  if (mode === "create-playlist") {
    if (totalStagedCount > 0) {
      return `Save Playlist (+${totalStagedCount})`;
    }
    return "Create Playlist";
  }
  return `Save & Persist (${totalStagedCount})`;
}

function CandidateItemRowView({
  idx,
  isAlreadySaved,
  isSaving,
  isStaged,
  onToggle,
  row,
}: {
  idx: number;
  isAlreadySaved: boolean;
  isSaving: boolean;
  isStaged: boolean;
  onToggle: (row: SelectableRow) => void;
  row: SelectableRow;
}) {
  const iconColor = getButtonColor(isAlreadySaved, isStaged),
    buttonLabel = getButtonLabel(isAlreadySaved, isStaged, row.kind),
    fallbackIcon = row.kind === "project" ? "disc-outline" : "musical-note";

  return (
    <Pressable
      disabled={isAlreadySaved || isSaving}
      onPress={() => onToggle(row)}
      style={[
        styles.itemRow,
        idx > 0 && styles.itemRowDivider,
        isStaged && styles.itemRowStaged,
      ]}
    >
      <View style={styles.itemCover}>
        {row.cover ? (
          <NativeImage
            contentFit="cover"
            source={row.cover}
            style={styles.itemCoverImg}
          />
        ) : (
          <View style={styles.itemCoverFallback}>
            <Ionicons color="#B8A3FF" name={fallbackIcon} size={16} />
          </View>
        )}
      </View>

      <View style={styles.itemCopy}>
        <Text numberOfLines={1} style={styles.itemTitle}>
          {row.title}
        </Text>
        <Text numberOfLines={1} style={styles.itemArtist}>
          {row.artist}
          {row.subtitleBadge ? ` • ${row.subtitleBadge}` : ""}
        </Text>
      </View>

      <View
        style={[
          styles.addBtn,
          isAlreadySaved && styles.addBtnDisabled,
          isStaged && styles.addBtnStaged,
        ]}
      >
        <Ionicons
          color={iconColor}
          name={isAlreadySaved || isStaged ? "checkmark" : "add"}
          size={14}
        />
        <Text
          style={[
            styles.addBtnText,
            isAlreadySaved && styles.addBtnTextDisabled,
            isStaged && styles.addBtnTextStaged,
          ]}
        >
          {buttonLabel}
        </Text>
      </View>
    </Pressable>
  );
}

export function PlaylistItemsModal({
  existingTrackIds,
  isSaving = false,
  mode,
  onClose,
  onSave,
  visible,
}: PlaylistItemsModalProps) {
  const [activeTab, setActiveTab] = useState<SourceTab>("tracks"),
    [description, setDescription] = useState(""),
    [searchQuery, setSearchQuery] = useState(""),
    [stagedProjectIds, setStagedProjectIds] = useState<Set<string>>(
      () => new Set()
    ),
    [stagedTrackIds, setStagedTrackIds] = useState<Set<string>>(
      () => new Set()
    ),
    [title, setTitle] = useState(""),
    tracksQuery = useTracksQuery({
      limit: 50,
      region: "all",
      regionType: "global",
      scope: "public",
      sort: "plays-desc",
    }),
    projectsQuery = usePublicProjectsQuery({
      limit: 30,
      region: "all",
      regionType: "global",
      sort: "date-desc",
    }),
    savedQuery = useLibrarySavedQuery(),
    recentQuery = useLibraryRecentQuery(),
    watchedQuery = useLibraryWatchedQuery(),
    catalogTracks = tracksQuery.data ?? [],
    catalogProjects = projectsQuery.data ?? [],
    savedTracks = savedQuery.data ?? [],
    recentTracks = recentQuery.data ?? [],
    watchedItems = watchedQuery.data ?? [],
    normalizedSearch = searchQuery.trim().toLowerCase(),
    activeRows = buildActiveRows({
      activeTab,
      catalogProjects,
      catalogTracks,
      normalizedSearch,
      recentTracks,
      savedTracks,
      watchedItems,
    }),
    totalStagedCount = stagedTrackIds.size + stagedProjectIds.size,
    canSubmit =
      !isSaving &&
      (mode === "create-playlist"
        ? title.trim().length > 0
        : totalStagedCount > 0),
    submitText = getSubmitButtonText(mode, totalStagedCount),
    toggleItem = (row: SelectableRow) => {
      if (row.kind === "project") {
        setStagedProjectIds((prev) => {
          const next = new Set(prev);
          if (next.has(row.id)) {
            next.delete(row.id);
          } else {
            next.add(row.id);
          }
          return next;
        });
        return;
      }
      if (existingTrackIds?.has(row.id)) {
        return;
      }
      setStagedTrackIds((prev) => {
        const next = new Set(prev);
        if (next.has(row.id)) {
          next.delete(row.id);
        } else {
          next.add(row.id);
        }
        return next;
      });
    },
    resetAndClose = () => {
      if (isSaving) {
        return;
      }
      setTitle("");
      setDescription("");
      setSearchQuery("");
      setStagedTrackIds(new Set());
      setStagedProjectIds(new Set());
      onClose();
    },
    handleSubmit = async () => {
      if (!canSubmit) {
        return;
      }
      await onSave({
        description: description.trim(),
        projectIds: [...stagedProjectIds],
        title: title.trim(),
        trackIds: [...stagedTrackIds],
      });
      setTitle("");
      setDescription("");
      setSearchQuery("");
      setStagedTrackIds(new Set());
      setStagedProjectIds(new Set());
    },
    tabs = [
      { id: "tracks" as const, label: `Tracks (${catalogTracks.length})` },
      {
        id: "projects" as const,
        label: `Projects (${catalogProjects.length})`,
      },
      { id: "saved" as const, label: `Saved (${savedTracks.length})` },
      { id: "recent" as const, label: `Recent (${recentTracks.length})` },
      { id: "watched" as const, label: `Watched (${watchedItems.length})` },
    ];

  return (
    <Modal
      animationType="slide"
      onRequestClose={resetAndClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerTitle}>
              {mode === "create-playlist"
                ? "Create New Playlist"
                : "Add Songs & Projects"}
            </Text>
            <Text style={styles.headerSubtitle}>
              {mode === "create-playlist"
                ? "Name your playlist, add tracks or full projects, then save to persist."
                : "Select catalog tracks, full projects, or library songs, then save."}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Close modal"
            accessibilityRole="button"
            disabled={isSaving}
            onPress={resetAndClose}
            style={styles.closeBtn}
          >
            <Ionicons color="#a1a1aa" name="close" size={20} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {mode === "create-playlist" ? (
            <View style={styles.formSection}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Playlist Name</Text>
                <TextInput
                  onChangeText={setTitle}
                  placeholder="e.g. Late Night Sessions"
                  placeholderTextColor="#71717a"
                  style={styles.input}
                  value={title}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Description (Optional)</Text>
                <TextInput
                  multiline
                  numberOfLines={2}
                  onChangeText={setDescription}
                  placeholder="What's this playlist about?"
                  placeholderTextColor="#71717a"
                  style={[styles.input, styles.textarea]}
                  value={description}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.pickerSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {mode === "create-playlist"
                  ? "Add Tracks & Projects"
                  : "Browse Sources"}
              </Text>
              {totalStagedCount > 0 ? (
                <View style={styles.stagedBadge}>
                  <Text style={styles.stagedBadgeText}>
                    {totalStagedCount} selected to save
                  </Text>
                </View>
              ) : null}
            </View>

            <ScrollView
              contentContainerStyle={styles.tabsRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {tabs.map((tab) => {
                const isSelected = activeTab === tab.id;
                return (
                  <Pressable
                    accessibilityRole="tab"
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    style={[styles.tabPill, isSelected && styles.tabPillActive]}
                  >
                    <Text
                      style={[
                        styles.tabPillText,
                        isSelected && styles.tabPillTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.searchBar}>
              <Ionicons color="#8F8F8F" name="search-outline" size={16} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setSearchQuery}
                placeholder={
                  activeTab === "projects"
                    ? "Search projects by title or artist..."
                    : "Search songs by title or artist..."
                }
                placeholderTextColor="#71717a"
                style={styles.searchInput}
                value={searchQuery}
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Ionicons color="#8F8F8F" name="close-circle" size={16} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.listBox}>
              {activeRows.length > 0 ? (
                activeRows.map((row, idx) => (
                  <CandidateItemRowView
                    idx={idx}
                    isAlreadySaved={
                      row.kind === "track" &&
                      Boolean(existingTrackIds?.has(row.id))
                    }
                    isSaving={isSaving}
                    isStaged={
                      row.kind === "project"
                        ? stagedProjectIds.has(row.id)
                        : stagedTrackIds.has(row.id)
                    }
                    key={`${row.kind}-${row.id}`}
                    onToggle={toggleItem}
                    row={row}
                  />
                ))
              ) : (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    No items found in this category.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={resetAndClose}
            style={styles.cancelBtn}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={() => {
              void handleSubmit();
            }}
            style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
          >
            {isSaving ? (
              <ActivityIndicator color="#171717" size="small" />
            ) : (
              <>
                <Ionicons
                  color="#171717"
                  name="checkmark-circle-outline"
                  size={18}
                />
                <Text style={styles.saveBtnText}>{submitText}</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    alignItems: "center",
    backgroundColor: "#141417",
    borderColor: "#27272a",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addBtnDisabled: {
    backgroundColor: "transparent",
    borderColor: "#1f1f23",
  },
  addBtnStaged: {
    backgroundColor: "#B8A3FF",
    borderColor: "#B8A3FF",
  },
  addBtnText: {
    color: "#f4f4f5",
    fontSize: 12,
    fontWeight: "600",
  },
  addBtnTextDisabled: {
    color: "#71717a",
  },
  addBtnTextStaged: {
    color: "#171717",
    fontWeight: "800",
  },
  bodyContent: {
    gap: 20,
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  cancelBtn: {
    alignItems: "center",
    backgroundColor: "#111111",
    borderColor: "#27272a",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 18,
  },
  cancelBtnText: {
    color: "#e4e4e7",
    fontSize: 14,
    fontWeight: "600",
  },
  closeBtn: {
    alignItems: "center",
    backgroundColor: "#141417",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    color: "#8F8F8F",
    fontSize: 13,
  },
  fieldGroup: {
    gap: 6,
  },
  footer: {
    alignItems: "center",
    backgroundColor: "#09090b",
    borderTopColor: "#212121",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  formSection: {
    backgroundColor: "#09090b",
    borderColor: "#212121",
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  header: {
    alignItems: "flex-start",
    borderBottomColor: "#212121",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerSubtitle: {
    color: "#8F8F8F",
    fontSize: 12,
    lineHeight: 17,
  },
  headerTextCol: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  input: {
    backgroundColor: "#060606",
    borderColor: "#27272a",
    borderRadius: 10,
    borderWidth: 1,
    color: "#f4f4f5",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemArtist: {
    color: "#8F8F8F",
    fontSize: 12,
  },
  itemCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  itemCover: {
    borderRadius: 8,
    height: 44,
    overflow: "hidden",
    width: 44,
  },
  itemCoverFallback: {
    alignItems: "center",
    backgroundColor: "#18181b",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  itemCoverImg: {
    height: "100%",
    width: "100%",
  },
  itemRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemRowDivider: {
    borderTopColor: "#161618",
    borderTopWidth: 1,
  },
  itemRowStaged: {
    backgroundColor: "rgba(184, 163, 255, 0.08)",
  },
  itemTitle: {
    color: "#f4f4f5",
    fontSize: 14,
    fontWeight: "600",
  },
  label: {
    color: "#e4e4e7",
    fontSize: 13,
    fontWeight: "600",
  },
  listBox: {
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  pickerSection: {
    gap: 12,
  },
  saveBtn: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 12,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 18,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: "#171717",
    fontSize: 14,
    fontWeight: "800",
  },
  searchBar: {
    alignItems: "center",
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: "#f4f4f5",
    flex: 1,
    fontSize: 13,
    paddingVertical: 8,
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#f4f4f5",
    fontSize: 15,
    fontWeight: "700",
  },
  sheet: {
    backgroundColor: "#020202",
    flex: 1,
  },
  stagedBadge: {
    backgroundColor: "rgba(184, 163, 255, 0.16)",
    borderColor: "rgba(184, 163, 255, 0.4)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  stagedBadgeText: {
    color: "#B8A3FF",
    fontSize: 11,
    fontWeight: "700",
  },
  tabPill: {
    backgroundColor: "#0b0b0d",
    borderColor: "#212121",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tabPillActive: {
    backgroundColor: "#B8A3FF",
    borderColor: "#B8A3FF",
  },
  tabPillText: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "600",
  },
  tabPillTextActive: {
    color: "#171717",
    fontWeight: "800",
  },
  tabsRow: {
    gap: 8,
  },
  textarea: {
    minHeight: 64,
    textAlignVertical: "top",
  },
});
