export interface RecipientNameOptions {
  email?: string | null;
  name?: string | null;
  username?: string | null;
}

const getPreferredRecipientName = ({
    email,
    name,
    username,
  }: RecipientNameOptions): string => {
    const [emailLocalPart = ""] = getTrimmedValue(email).split("@", 1),
      trimmedName = getTrimmedValue(name),
      trimmedUsername = getTrimmedValue(username).replace(/^@/u, "");
    if (trimmedUsername) {
      return trimmedUsername;
    }

    if (
      trimmedName &&
      trimmedName.toLowerCase() !== emailLocalPart.toLowerCase()
    ) {
      return trimmedName.split(/\s+/u, 1)[0] ?? "there";
    }

    return "there";
  },
  getTrimmedValue = (value: string | null | undefined) => value?.trim() ?? "";

export { getPreferredRecipientName };
