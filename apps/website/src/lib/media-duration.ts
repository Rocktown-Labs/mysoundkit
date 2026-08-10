import { ALL_FORMATS, BlobSource, Input as MediaInput } from "mediabunny";

export const readAudioDurationMs = async (file: File) => {
  const input = new MediaInput({
    formats: ALL_FORMATS,
    source: new BlobSource(file),
  });

  try {
    const metadataDuration = await input.getDurationFromMetadata();
    const durationSeconds =
      metadataDuration ??
      (await input.computeDuration(undefined, { skipLiveWait: true }));

    return Number.isFinite(durationSeconds)
      ? Math.max(0, Math.round(durationSeconds * 1000))
      : null;
  } catch {
    return null;
  } finally {
    input.dispose();
  }
};
