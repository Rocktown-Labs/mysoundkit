import { NativePlaceholderScreen } from "@/components/native-placeholder-screen";

export default function PurchasedScreen() {
  return (
    <NativePlaceholderScreen
      description="Access music and releases you purchased from SoundKit."
      route="/library/purchased"
      section="Library"
      sectionHref="/library"
      title="Purchased"
    />
  );
}
