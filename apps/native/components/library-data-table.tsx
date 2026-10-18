/* eslint-disable one-var, sort-vars, no-nested-ternary */
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { NativeImage } from "@/components/native-image";

export interface LibrarySortColumn<T> {
  getValue: (item: T) => number | string;
  id: string;
  label: string;
}

export interface LibraryBadgeItem {
  color?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
}

export interface LibraryDataTableProps<T> {
  data: readonly T[];
  emptyMessage?: string;
  filterPlaceholder?: string;
  getArtist?: (item: T) => null | string | undefined;
  getBadges?: (item: T) => readonly LibraryBadgeItem[];
  getCoverUrl?: (item: T) => null | string | undefined;
  getId: (item: T) => string;
  getLeadingIcon?: (item: T) => keyof typeof Ionicons.glyphMap;
  getPrimaryMeta?: (item: T) => null | string | undefined;
  getSecondaryMeta?: (item: T) => null | string | undefined;
  getTitle: (item: T) => string;
  itemCountLabel?: string;
  onArtistPress?: (item: T) => void;
  onPlayPress?: (item: T, index: number) => void;
  onRowPress?: (item: T) => void;
  pageSize?: number;
  renderRowActions?: (item: T) => ReactNode;
  searchKeys?: (item: T) => readonly (null | string | undefined)[];
  sortColumns: readonly LibrarySortColumn<T>[];
  toolbarAction?: {
    icon?: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
  };
}

interface SortState {
  columnId: string;
  direction: "asc" | "desc";
}

function filterTableRows<T>(
  data: readonly T[],
  filterText: string,
  getTitle: (item: T) => string,
  getArtist?: (item: T) => null | string | undefined,
  searchKeys?: (item: T) => readonly (null | string | undefined)[]
): T[] {
  const query = filterText.trim().toLowerCase();
  if (!query) {
    return [...data];
  }
  return data.filter((item) => {
    const candidates = searchKeys
      ? searchKeys(item)
      : [getTitle(item), getArtist?.(item)];
    return candidates.some((val) => (val ?? "").toLowerCase().includes(query));
  });
}

function sortTableRows<T>(
  rows: readonly T[],
  sortState: null | SortState,
  sortColumns: readonly LibrarySortColumn<T>[]
): T[] {
  if (!sortState) {
    return [...rows];
  }
  const col = sortColumns.find((c) => c.id === sortState.columnId);
  if (!col) {
    return [...rows];
  }
  const mult = sortState.direction === "asc" ? 1 : -1;
  return [...rows].toSorted((a, b) => {
    const valA = col.getValue(a),
      valB = col.getValue(b);
    if (typeof valA === "number" && typeof valB === "number") {
      return (valA - valB) * mult;
    }
    return (
      String(valA).localeCompare(String(valB), undefined, {
        numeric: true,
        sensitivity: "base",
      }) * mult
    );
  });
}

function getSortIconName(
  isActive: boolean,
  direction?: "asc" | "desc"
): keyof typeof Ionicons.glyphMap {
  if (!isActive) {
    return "swap-vertical-outline";
  }
  if (direction === "asc") {
    return "arrow-up-outline";
  }
  return "arrow-down-outline";
}

function CoverCellView({
  coverUrl,
  leadingIcon,
  onCoverPress,
  onPlayPress,
  title,
}: {
  coverUrl: null | string | undefined;
  leadingIcon: keyof typeof Ionicons.glyphMap | undefined;
  onCoverPress?: () => void;
  onPlayPress?: () => void;
  title: string;
}) {
  if (onPlayPress) {
    return (
      <Pressable
        accessibilityLabel={`Play ${title}`}
        accessibilityRole="button"
        onPress={onPlayPress}
        style={({ pressed }) => [styles.coverCell, pressed && { opacity: 0.8 }]}
      >
        {coverUrl ? (
          <NativeImage
            contentFit="cover"
            source={coverUrl}
            style={styles.coverImage}
          />
        ) : (
          <View style={styles.coverFallback}>
            <Ionicons
              color="#B8A3FF"
              name={leadingIcon ?? "musical-note"}
              size={18}
            />
          </View>
        )}
        <View style={styles.playOverlay}>
          <Ionicons color="#ffffff" name="play" size={14} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      disabled={!onCoverPress}
      onPress={onCoverPress}
      style={styles.coverCell}
    >
      {coverUrl ? (
        <NativeImage
          contentFit="cover"
          source={coverUrl}
          style={styles.coverImage}
        />
      ) : (
        <View style={styles.coverFallback}>
          <Ionicons
            color="#B8A3FF"
            name={leadingIcon ?? "musical-notes-outline"}
            size={18}
          />
        </View>
      )}
    </Pressable>
  );
}

function LibraryDataRowView<T>({
  absoluteIndex,
  getArtist,
  getBadges,
  getCoverUrl,
  getLeadingIcon,
  getPrimaryMeta,
  getSecondaryMeta,
  getTitle,
  idx,
  item,
  onArtistPress,
  onPlayPress,
  onRowPress,
  renderRowActions,
}: {
  absoluteIndex: number;
  getArtist?: (item: T) => null | string | undefined;
  getBadges?: (item: T) => readonly LibraryBadgeItem[];
  getCoverUrl?: (item: T) => null | string | undefined;
  getLeadingIcon?: (item: T) => keyof typeof Ionicons.glyphMap;
  getPrimaryMeta?: (item: T) => null | string | undefined;
  getSecondaryMeta?: (item: T) => null | string | undefined;
  getTitle: (item: T) => string;
  idx: number;
  item: T;
  onArtistPress?: (item: T) => void;
  onPlayPress?: (item: T, index: number) => void;
  onRowPress?: (item: T) => void;
  renderRowActions?: (item: T) => ReactNode;
}) {
  const title = getTitle(item),
    artist = getArtist?.(item),
    coverUrl = getCoverUrl?.(item),
    leadingIcon = getLeadingIcon?.(item),
    primaryMeta = getPrimaryMeta?.(item),
    secondaryMeta = getSecondaryMeta?.(item),
    badges = getBadges?.(item) ?? [],
    handleArtistTap = () => {
      if (onArtistPress) {
        onArtistPress(item);
        return;
      }
      onRowPress?.(item);
    };

  return (
    <View style={[styles.tableRow, idx > 0 && styles.tableRowDivider]}>
      <CoverCellView
        coverUrl={coverUrl}
        leadingIcon={leadingIcon}
        onCoverPress={onRowPress ? () => onRowPress(item) : undefined}
        onPlayPress={
          onPlayPress ? () => onPlayPress(item, absoluteIndex) : undefined
        }
        title={title}
      />

      <View style={styles.mainCell}>
        <Pressable disabled={!onRowPress} onPress={() => onRowPress?.(item)}>
          <Text numberOfLines={1} style={styles.rowTitle}>
            {title}
          </Text>
        </Pressable>

        {artist ? (
          <Pressable
            disabled={!onArtistPress && !onRowPress}
            onPress={handleArtistTap}
          >
            <Text numberOfLines={1} style={styles.rowArtist}>
              {artist}
            </Text>
          </Pressable>
        ) : null}

        {badges.length > 0 ? (
          <View style={styles.badgeRow}>
            {badges.map((badge) => (
              <View key={badge.label} style={styles.badgePill}>
                {badge.icon ? (
                  <Ionicons
                    color={badge.color ?? "#B8A3FF"}
                    name={badge.icon}
                    size={11}
                  />
                ) : null}
                <Text
                  style={[
                    styles.badgeText,
                    badge.color ? { color: badge.color } : null,
                  ]}
                >
                  {badge.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {primaryMeta || secondaryMeta ? (
        <View style={styles.metaCell}>
          {primaryMeta ? (
            <Text numberOfLines={1} style={styles.primaryMetaText}>
              {primaryMeta}
            </Text>
          ) : null}
          {secondaryMeta ? (
            <Text numberOfLines={1} style={styles.secondaryMetaText}>
              {secondaryMeta}
            </Text>
          ) : null}
        </View>
      ) : null}

      {renderRowActions ? (
        <View style={styles.actionsCell}>{renderRowActions(item)}</View>
      ) : null}
    </View>
  );
}

export function LibraryDataTable<T>({
  data,
  emptyMessage = "No results.",
  filterPlaceholder = "Filter songs...",
  getArtist,
  getBadges,
  getCoverUrl,
  getId,
  getLeadingIcon,
  getPrimaryMeta,
  getSecondaryMeta,
  getTitle,
  itemCountLabel = "track(s)",
  onArtistPress,
  onPlayPress,
  onRowPress,
  pageSize = 10,
  renderRowActions,
  searchKeys,
  sortColumns,
  toolbarAction,
}: LibraryDataTableProps<T>) {
  const [filterText, setFilterText] = useState(""),
    [pageIndex, setPageIndex] = useState(0),
    [sortState, setSortState] = useState<null | SortState>(null),
    filteredData = filterTableRows(
      data,
      filterText,
      getTitle,
      getArtist,
      searchKeys
    ),
    sortedData = sortTableRows(filteredData, sortState, sortColumns),
    totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize)),
    safePageIndex = Math.min(pageIndex, totalPages - 1),
    paginatedRows = sortedData.slice(
      safePageIndex * pageSize,
      (safePageIndex + 1) * pageSize
    ),
    canPreviousPage = safePageIndex > 0,
    canNextPage = safePageIndex < totalPages - 1,
    handleToolbarPress = () => {
      toolbarAction?.onPress();
    },
    toggleSort = (columnId: string) => {
      setPageIndex(0);
      setSortState((prev) => {
        if (!prev || prev.columnId !== columnId) {
          return { columnId, direction: "asc" };
        }
        if (prev.direction === "asc") {
          return { columnId, direction: "desc" };
        }
        return null;
      });
    };

  return (
    <View style={styles.container}>
      <View style={styles.toolbarRow}>
        <View style={styles.searchBox}>
          <Ionicons color="#8F8F8F" name="search-outline" size={16} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(text) => {
              setFilterText(text);
              setPageIndex(0);
            }}
            placeholder={filterPlaceholder}
            placeholderTextColor="#71717a"
            style={styles.searchInput}
            value={filterText}
          />
          {filterText.length > 0 ? (
            <Pressable
              accessibilityLabel="Clear filter"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                setFilterText("");
                setPageIndex(0);
              }}
            >
              <Ionicons color="#8F8F8F" name="close-circle" size={16} />
            </Pressable>
          ) : null}
        </View>

        {toolbarAction ? (
          <Pressable
            accessibilityLabel={toolbarAction.label}
            accessibilityRole="button"
            onPress={handleToolbarPress}
            style={({ pressed }) => [
              styles.toolbarBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            {toolbarAction.icon ? (
              <Ionicons color="#171717" name={toolbarAction.icon} size={16} />
            ) : null}
            <Text style={styles.toolbarBtnText}>{toolbarAction.label}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.tableBox}>
        {sortColumns.length > 0 ? (
          <ScrollView
            contentContainerStyle={styles.headerScrollContent}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tableHeaderBar}
          >
            {sortColumns.map((col) => {
              const isActive = sortState?.columnId === col.id,
                iconName = getSortIconName(isActive, sortState?.direction);

              return (
                <Pressable
                  accessibilityLabel={`Sort by ${col.label}`}
                  accessibilityRole="button"
                  key={col.id}
                  onPress={() => toggleSort(col.id)}
                  style={({ pressed }) => [
                    styles.headerColBtn,
                    isActive && styles.headerColBtnActive,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text
                    style={[
                      styles.headerColText,
                      isActive && styles.headerColTextActive,
                    ]}
                  >
                    {col.label}
                  </Text>
                  <Ionicons
                    color={isActive ? "#B8A3FF" : "#8F8F8F"}
                    name={iconName}
                    size={13}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {paginatedRows.length > 0 ? (
          paginatedRows.map((item, idx) => (
            <LibraryDataRowView
              absoluteIndex={safePageIndex * pageSize + idx}
              getArtist={getArtist}
              getBadges={getBadges}
              getCoverUrl={getCoverUrl}
              getLeadingIcon={getLeadingIcon}
              getPrimaryMeta={getPrimaryMeta}
              getSecondaryMeta={getSecondaryMeta}
              getTitle={getTitle}
              idx={idx}
              item={item}
              key={getId(item)}
              onArtistPress={onArtistPress}
              onPlayPress={onPlayPress}
              onRowPress={onRowPress}
              renderRowActions={renderRowActions}
            />
          ))
        ) : (
          <View style={styles.emptyTableBox}>
            <Text style={styles.emptyTableText}>{emptyMessage}</Text>
          </View>
        )}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerCount}>
          {sortedData.length} {itemCountLabel} total
        </Text>

        <View style={styles.paginationRow}>
          <Pressable
            accessibilityLabel="Previous page"
            accessibilityRole="button"
            disabled={!canPreviousPage}
            onPress={() => setPageIndex((p) => Math.max(0, p - 1))}
            style={({ pressed }) => [
              styles.pageBtn,
              !canPreviousPage && styles.pageBtnDisabled,
              pressed && canPreviousPage && { backgroundColor: "#161616" },
            ]}
          >
            <Text style={styles.pageBtnText}>Previous</Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Next page"
            accessibilityRole="button"
            disabled={!canNextPage}
            onPress={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
            style={({ pressed }) => [
              styles.pageBtn,
              !canNextPage && styles.pageBtnDisabled,
              pressed && canNextPage && { backgroundColor: "#161616" },
            ]}
          >
            <Text style={styles.pageBtnText}>Next</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionsCell: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginLeft: 4,
  },
  badgePill: {
    alignItems: "center",
    backgroundColor: "#141417",
    borderColor: "#242429",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  badgeText: {
    color: "#a1a1aa",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  container: {
    gap: 12,
    width: "100%",
  },
  coverCell: {
    borderRadius: 8,
    height: 48,
    overflow: "hidden",
    position: "relative",
    width: 48,
  },
  coverFallback: {
    alignItems: "center",
    backgroundColor: "#16161a",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  coverImage: {
    backgroundColor: "#111111",
    height: "100%",
    width: "100%",
  },
  emptyTableBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 36,
  },
  emptyTableText: {
    color: "#8F8F8F",
    fontSize: 13,
    textAlign: "center",
  },
  footerCount: {
    color: "#8F8F8F",
    fontSize: 12,
    fontWeight: "500",
  },
  footerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 2,
  },
  headerColBtn: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerColBtnActive: {
    backgroundColor: "rgba(184, 163, 255, 0.12)",
  },
  headerColText: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "600",
  },
  headerColTextActive: {
    color: "#B8A3FF",
    fontWeight: "700",
  },
  headerScrollContent: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  mainCell: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  metaCell: {
    alignItems: "flex-end",
    gap: 2,
    justifyContent: "center",
  },
  pageBtn: {
    alignItems: "center",
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 12,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    color: "#f4f4f5",
    fontSize: 12,
    fontWeight: "600",
  },
  paginationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  playOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  primaryMetaText: {
    color: "#e4e4e7",
    fontSize: 12,
    fontWeight: "600",
  },
  rowArtist: {
    color: "#8F8F8F",
    fontSize: 12,
  },
  rowTitle: {
    color: "#f4f4f5",
    fontSize: 14,
    fontWeight: "600",
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
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
  secondaryMetaText: {
    color: "#71717a",
    fontSize: 11,
  },
  tableBox: {
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  tableHeaderBar: {
    backgroundColor: "#0b0b0d",
    borderBottomColor: "#212121",
    borderBottomWidth: 1,
  },
  tableRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  tableRowDivider: {
    borderTopColor: "#161618",
    borderTopWidth: 1,
  },
  toolbarBtn: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 14,
  },
  toolbarBtnText: {
    color: "#171717",
    fontSize: 13,
    fontWeight: "700",
  },
  toolbarRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
});
