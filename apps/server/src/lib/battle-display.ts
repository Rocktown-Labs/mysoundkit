/* eslint-disable one-var */
import { canonicalGenreName } from "@/lib/genre-catalog";

export interface BattleDemandRow {
  id: string;
  queueSize: number;
  status: "archived" | "completed" | "live" | "scheduled";
  viewerCount: number;
}

export const formatArtistBattleTitle = (genre: string) =>
  `Artist Battle - ${canonicalGenreName(genre)}`;

export const resolveArtistBattleTitle = (title: string, genre: string) =>
  title === "SoundKit Artist Battle" ? formatArtistBattleTitle(genre) : title;

export const battleDemandScore = ({
  queueSize,
  status,
  viewerCount,
}: Pick<BattleDemandRow, "queueSize" | "status" | "viewerCount">) =>
  status === "live" ? viewerCount : queueSize;

export const rankFeaturedBattleIds = (
  battleRows: BattleDemandRow[],
  limit: number
) =>
  new Map(
    battleRows
      .filter(
        (battle) =>
          (battle.status === "live" || battle.status === "scheduled") &&
          battleDemandScore(battle) > 0
      )
      .toSorted(
        (first, second) =>
          battleDemandScore(second) - battleDemandScore(first) ||
          first.id.localeCompare(second.id)
      )
      .slice(0, limit)
      .map((battle, index) => [battle.id, index + 1])
  );
