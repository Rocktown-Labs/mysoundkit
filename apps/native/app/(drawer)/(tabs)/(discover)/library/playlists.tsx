/* oxlint-disable one-var, sort-vars */
/* eslint-disable one-var, sort-vars */
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
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

import { Container } from "@/components/container";
import { LibraryDataTable } from "@/components/library-data-table";
import type { LibrarySortColumn } from "@/components/library-data-table";
import { PlaylistItemsModal } from "@/components/playlist-items-modal";
import { NAV_THEME } from "@/lib/constants";
import {
  useCreatePlaylistMutation,
  useDeletePlaylistMutation,
  useLibraryPlaylistsQuery,
} from "@/lib/soundkit-api";
import type { PlaylistSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const SORT_COLUMNS: readonly LibrarySortColumn<PlaylistSummary>[] = [
  {
    getValue: (item) => item.title,
    id: "name",
    label: "Playlist Name",
  },
  {
    getValue: (item) => item.trackCount,
    id: "trackCount",
    label: "Tracks",
  },
];

export default function PlaylistsScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    router = useRouter(),
    [createModalOpen, setCreateModalOpen] = useState(false),
    [deleteCandidate, setDeleteCandidate] = useState<null | PlaylistSummary>(
      null
    ),
    [deleteConfirmation, setDeleteConfirmation] = useState(""),
    { data: playlists = [], isLoading } = useLibraryPlaylistsQuery(),
    createPlaylist = useCreatePlaylistMutation(),
    deletePlaylist = useDeletePlaylistMutation(),
    handleCreatePlaylist = async (payload: {
      description: string;
      projectIds: string[];
      title: string;
      trackIds: string[];
    }) => {
      const created = await createPlaylist.mutateAsync(payload);
      setCreateModalOpen(false);
      router.push(`/library/playlists/${created.id}`);
    },
    handleDeletePlaylist = async () => {
      if (!deleteCandidate) {
        return;
      }
      await deletePlaylist.mutateAsync(deleteCandidate.id);
      setDeleteCandidate(null);
      setDeleteConfirmation("");
    };

  return (
    <Container>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Link asChild href="/library">
            <Pressable accessibilityRole="button" style={styles.backRow}>
              <Ionicons color="#B8A3FF" name="arrow-back" size={18} />
              <Text style={styles.backText}>Back to My SoundKit</Text>
            </Pressable>
          </Link>

          <View style={styles.headerTopRow}>
            <View style={styles.headerTitleCol}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: theme.text }]}>
                  My Playlists
                </Text>
              </View>
              <Text style={[styles.subtitle, { color: theme.mutedText }]}>
                Your curated collections
              </Text>
            </View>

            <Pressable
              accessibilityLabel="New Playlist"
              accessibilityRole="button"
              onPress={() => setCreateModalOpen(true)}
              style={({ pressed }) => [
                styles.newPlaylistBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons color="#171717" name="add" size={18} />
              <Text style={styles.newPlaylistBtnText}>New Playlist</Text>
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <View style={[styles.stateBox, { borderColor: "#212121" }]}>
            <ActivityIndicator color="#B8A3FF" />
            <Text style={{ color: theme.mutedText }}>Loading playlists…</Text>
          </View>
        ) : null}

        {!isLoading && playlists.length > 0 ? (
          <LibraryDataTable
            data={playlists}
            emptyMessage="No matching playlists."
            filterPlaceholder="Search playlists..."
            getArtist={(item) => item.description || "No description"}
            getId={(item) => item.id}
            getLeadingIcon={() => "musical-notes"}
            getPrimaryMeta={(item) =>
              `${item.trackCount} ${item.trackCount === 1 ? "track" : "tracks"}`
            }
            getTitle={(item) => item.title}
            itemCountLabel="playlist(s)"
            onRowPress={(item) => router.push(`/library/playlists/${item.id}`)}
            renderRowActions={(item) => (
              <View style={styles.rowActions}>
                <Pressable
                  accessibilityLabel={`View ${item.title}`}
                  accessibilityRole="button"
                  onPress={() => router.push(`/library/playlists/${item.id}`)}
                  style={styles.viewBtn}
                >
                  <Text style={styles.viewBtnText}>View</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Delete ${item.title}`}
                  accessibilityRole="button"
                  onPress={() => {
                    setDeleteCandidate(item);
                    setDeleteConfirmation("");
                  }}
                  style={styles.deleteIconBtn}
                >
                  <Ionicons color="#e05d4d" name="trash-outline" size={16} />
                </Pressable>
              </View>
            )}
            searchKeys={(item) => [item.title, item.description]}
            sortColumns={SORT_COLUMNS}
          />
        ) : null}

        {!isLoading && playlists.length === 0 ? (
          <View style={[styles.stateBox, { borderColor: "#212121" }]}>
            <Ionicons color="#8F8F8F" name="musical-notes-outline" size={36} />
            <Text style={styles.emptyTitle}>No playlists yet</Text>
            <Text style={styles.emptyDesc}>
              Create playlists as you discover songs and projects you want to
              keep together.
            </Text>
            <View style={styles.emptyActionsRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setCreateModalOpen(true)}
                style={styles.browseBtn}
              >
                <Text style={styles.browseBtnText}>Create Playlist</Text>
              </Pressable>
              <Link asChild href="/tracks">
                <Pressable
                  accessibilityRole="button"
                  style={styles.secondaryBtn}
                >
                  <Text style={styles.secondaryBtnText}>Browse Songs</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Create Playlist + Add Tracks/Projects Modal */}
      <PlaylistItemsModal
        isSaving={createPlaylist.isPending}
        mode="create-playlist"
        onClose={() => setCreateModalOpen(false)}
        onSave={handleCreatePlaylist}
        visible={createModalOpen}
      />

      {/* Delete Playlist Confirmation Dialog */}
      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (!deletePlaylist.isPending) {
            setDeleteCandidate(null);
            setDeleteConfirmation("");
          }
        }}
        transparent
        visible={Boolean(deleteCandidate)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>Delete playlist?</Text>
            <Text style={styles.dialogDescription}>
              This permanently removes &ldquo;{deleteCandidate?.title}&rdquo;
              from your library. Type the playlist name below to confirm, or tap
              Delete.
            </Text>
            <TextInput
              editable={!deletePlaylist.isPending}
              onChangeText={setDeleteConfirmation}
              placeholder={deleteCandidate?.title ?? "Playlist name"}
              placeholderTextColor="#71717a"
              style={styles.dialogInput}
              value={deleteConfirmation}
            />
            <View style={styles.dialogFooter}>
              <Pressable
                accessibilityRole="button"
                disabled={deletePlaylist.isPending}
                onPress={() => {
                  setDeleteCandidate(null);
                  setDeleteConfirmation("");
                }}
                style={styles.dialogCancelBtn}
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={deletePlaylist.isPending}
                onPress={() => {
                  void handleDeletePlaylist();
                }}
                style={styles.dialogDeleteBtn}
              >
                {deletePlaylist.isPending ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.dialogDeleteText}>Delete Playlist</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Container>
  );
}

const styles = StyleSheet.create({
  backRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  backText: {
    color: "#B8A3FF",
    fontSize: 13,
    fontWeight: "700",
  },
  browseBtn: {
    backgroundColor: "#B8A3FF",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  browseBtnText: {
    color: "#171717",
    fontSize: 13,
    fontWeight: "800",
  },
  content: {
    gap: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  deleteIconBtn: {
    alignItems: "center",
    backgroundColor: "rgba(224, 93, 77, 0.12)",
    borderColor: "rgba(224, 93, 77, 0.3)",
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  dialogBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  dialogBox: {
    backgroundColor: "#0b0b0d",
    borderColor: "#27272a",
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    maxWidth: 400,
    padding: 20,
    width: "100%",
  },
  dialogCancelBtn: {
    alignItems: "center",
    backgroundColor: "#141417",
    borderColor: "#27272a",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
  },
  dialogCancelText: {
    color: "#e4e4e7",
    fontSize: 13,
    fontWeight: "600",
  },
  dialogDeleteBtn: {
    alignItems: "center",
    backgroundColor: "#e05d4d",
    borderRadius: 10,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
  },
  dialogDeleteText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  dialogDescription: {
    color: "#a1a1aa",
    fontSize: 13,
    lineHeight: 18,
  },
  dialogFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  dialogInput: {
    backgroundColor: "#060606",
    borderColor: "#27272a",
    borderRadius: 10,
    borderWidth: 1,
    color: "#f4f4f5",
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dialogTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  emptyActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  emptyDesc: {
    color: "#8F8F8F",
    fontSize: 13,
    textAlign: "center",
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  header: {
    gap: 8,
  },
  headerTitleCol: {
    flex: 1,
    gap: 4,
  },
  headerTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  newPlaylistBtn: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  newPlaylistBtnText: {
    color: "#171717",
    fontSize: 13,
    fontWeight: "800",
  },
  rowActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  secondaryBtn: {
    backgroundColor: "#141417",
    borderColor: "#27272a",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryBtnText: {
    color: "#e4e4e7",
    fontSize: 13,
    fontWeight: "600",
  },
  stateBox: {
    alignItems: "center",
    backgroundColor: "#060606",
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  subtitle: {
    fontSize: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  viewBtn: {
    backgroundColor: "#141417",
    borderColor: "#27272a",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewBtnText: {
    color: "#e4e4e7",
    fontSize: 12,
    fontWeight: "600",
  },
});
