import { useLocalSearchParams } from "expo-router";

import { ProjectCard } from "@/components/cards/project-card";
import { NativeCollectionGrid } from "@/components/native-collection-grid";
import { NativePageScreen } from "@/components/native-page-screen";
import { usePublicProjectsQuery } from "@/lib/soundkit-api";

export default function ProjectsScreen() {
  const params = useLocalSearchParams<{ region?: string }>(),
    region = params.region ?? "all",
    regionType =
      region === "all" ? ("global" as const) : ("north-america" as const),
    projects = usePublicProjectsQuery({
      limit: 24,
      region,
      regionType,
      sort: "date-desc",
    });

  return (
    <NativePageScreen
      description="Albums, EPs, mixtapes, and bundles."
      title="Projects"
    >
      <NativeCollectionGrid
        empty="No projects are live for this view yet."
        items={projects.data ?? []}
        keyForItem={(project) => project.id}
        renderItem={(project) => <ProjectCard project={project} />}
        isLoading={projects.isLoading}
      />
    </NativePageScreen>
  );
}
