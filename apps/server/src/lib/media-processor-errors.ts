export class MediaProcessorValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MediaProcessorValidationError";
  }
}
