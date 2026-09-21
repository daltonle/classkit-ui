const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const OUTPUT_SIZE = 256;

export class AvatarProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvatarProcessingError";
  }
}

export async function processAvatarImage(source: File): Promise<Blob> {
  if (!source.type.startsWith("image/")) {
    throw new AvatarProcessingError("Choose an image file for the avatar.");
  }
  if (source.size > MAX_SOURCE_BYTES) {
    throw new AvatarProcessingError("Avatar images must be 10 MB or smaller.");
  }

  const image = await createImageBitmap(source);
  try {
    const cropSize = Math.min(image.width, image.height);
    const cropX = (image.width - cropSize) / 2;
    const cropY = (image.height - cropSize) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context)
      throw new AvatarProcessingError("Image processing is unavailable.");
    context.drawImage(
      image,
      cropX,
      cropY,
      cropSize,
      cropSize,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    );

    const processed = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    if (!processed)
      throw new AvatarProcessingError("Avatar image could not be encoded.");
    return processed;
  } finally {
    image.close();
  }
}
