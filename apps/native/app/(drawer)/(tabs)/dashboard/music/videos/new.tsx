import { NativePlaceholderScreen } from "@/components/native-placeholder-screen";

export default function NewVideoScreen() {
  return (
    <NativePlaceholderScreen
      description="Prepare a music video for publishing."
      route="/dashboard/videos/new"
      section="Dashboard"
      sectionHref="/dashboard"
      title="New Video"
    />
  );
}
