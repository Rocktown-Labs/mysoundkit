import { UpChunk } from "@mux/upchunk";

export const MAX_VIDEO_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

export const SUPPORTED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export const validateVideoFile = (file: File): string | null => {
  if (
    !SUPPORTED_VIDEO_MIME_TYPES.includes(
      file.type as (typeof SUPPORTED_VIDEO_MIME_TYPES)[number]
    )
  ) {
    return "Unsupported file type. Please upload an MP4, MOV, or WebM file.";
  }

  if (file.size > MAX_VIDEO_UPLOAD_SIZE_BYTES) {
    return "File is larger than 2GB. Please compress it and try again.";
  }

  return null;
};

export const uploadVideoFile = async ({
  file,
  onProgress,
  uploadUrl,
}: {
  file: File;
  onProgress: (percent: number) => void;
  uploadUrl: string;
}): Promise<void> => {
  // UpChunk is event-driven and exposes no promise-returning API.
  // eslint-disable-next-line promise/avoid-new
  await new Promise<void>((resolve, reject) => {
    const upload = UpChunk.createUpload({
      chunkSize: 5120,
      endpoint: uploadUrl,
      file,
    });

    upload.on("error", (event) => {
      const detail = event.detail as { message?: string };
      reject(new Error(detail.message ?? "Video upload failed."));
    });
    upload.on("progress", (event) => {
      const detail = event.detail as number;
      if (typeof detail === "number") {
        onProgress(detail);
      }
    });
    upload.on("success", () => {
      onProgress(100);
      resolve();
    });
  });
};
