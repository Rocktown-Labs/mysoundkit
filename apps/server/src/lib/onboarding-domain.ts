export type CreatorEligibility =
  | "independent"
  | "major_label_affiliated"
  | null
  | undefined;

export const canCompleteArtistOnboarding = ({
  savedEligibility,
  submittedEligibility,
}: {
  savedEligibility: CreatorEligibility;
  submittedEligibility?: CreatorEligibility;
}) =>
  savedEligibility === "independent" &&
  (submittedEligibility === undefined ||
    submittedEligibility === null ||
    submittedEligibility === savedEligibility);
