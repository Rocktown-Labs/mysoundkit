import { PartyCard } from "@/components/cards/party-card";
import { NativeCollectionGrid } from "@/components/native-collection-grid";
import { NativePageScreen } from "@/components/native-page-screen";
import { useListeningPartiesQuery } from "@/lib/soundkit-api";

export default function PartiesScreen() {
  const parties = useListeningPartiesQuery({
    region: "all",
    regionType: "global",
  });

  return (
    <NativePageScreen
      description="Listen together with artists and fans."
      title="Parties"
    >
      <NativeCollectionGrid
        empty="No upcoming listening parties scheduled."
        items={parties.data ?? []}
        keyForItem={(party) => party.id}
        renderItem={(party) => <PartyCard party={party} fluid />}
        isLoading={parties.isLoading}
      />
    </NativePageScreen>
  );
}
