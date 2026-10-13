import { BattleCard } from "@/components/cards/battle-card";
import { NativeCollectionGrid } from "@/components/native-collection-grid";
import { NativePageScreen } from "@/components/native-page-screen";
import { useBattlesQuery } from "@/lib/soundkit-api";

export default function BattlesScreen() {
  const battles = useBattlesQuery({ region: "all", regionType: "global" });

  return (
    <NativePageScreen
      description="Live matchups, voting rounds, and replays."
      title="Battles"
    >
      <NativeCollectionGrid
        empty="No battles are live for this view yet."
        items={battles.data ?? []}
        keyForItem={(battle) => battle.id}
        renderItem={(battle) => <BattleCard battle={battle} />}
        isLoading={battles.isLoading}
      />
    </NativePageScreen>
  );
}
