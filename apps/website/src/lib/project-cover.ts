/* eslint-disable one-var, sort-vars */

const extensionFromMimeType = (mimeType: string) => {
  switch (mimeType) {
    case "image/jpeg": {
      return ".jpg";
    }
    case "image/png": {
      return ".png";
    }
    case "image/webp": {
      return ".webp";
    }
    default: {
      return ".jpg";
    }
  }
};

export const projectCoverFile = (file: File, projectTitle: string) => {
  const stem =
      projectTitle
        .trim()
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/gu, "-")
        .replaceAll(/^-|-$/gu, "") || "project",
    extension =
      file.name.match(/\.[a-z0-9]+$/iu)?.[0].toLowerCase() ??
      extensionFromMimeType(file.type);

  return new File([file], `${stem}-cover${extension}`, {
    lastModified: file.lastModified,
    type: file.type,
  });
};
