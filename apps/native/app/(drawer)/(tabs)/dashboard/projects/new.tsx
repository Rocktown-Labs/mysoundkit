import { NativePlaceholderScreen } from "@/components/native-placeholder-screen";

export default function NewProjectScreen() {
  return (
    <NativePlaceholderScreen
      description="Create an album, EP, or mixtape."
      route="/dashboard/projects/new"
      section="Dashboard"
      sectionHref="/dashboard"
      title="New Project"
    />
  );
}
