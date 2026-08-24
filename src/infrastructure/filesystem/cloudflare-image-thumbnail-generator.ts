import { THUMBNAIL_SPEC } from "@/constants/filesystem/thumbnail";
import type {
  GeneratedThumbnail,
  ImageThumbnailGenerator,
} from "@/types/filesystem/thumbnail";

export class CloudflareImageThumbnailGenerator
  implements ImageThumbnailGenerator
{
  constructor(private readonly images: ImagesBinding) {}

  async generate(
    source: ReadableStream<Uint8Array>,
  ): Promise<GeneratedThumbnail> {
    const result = await this.images
      .input(source)
      .transform({
        width: THUMBNAIL_SPEC.WIDTH_PX,
        height: THUMBNAIL_SPEC.HEIGHT_PX,
        fit: THUMBNAIL_SPEC.FIT,
      })
      .output({
        format: THUMBNAIL_SPEC.OUTPUT_CONTENT_TYPE,
        quality: THUMBNAIL_SPEC.QUALITY,
        anim: false,
      });

    const contentType = result.contentType();
    const body = await new Response(result.image()).arrayBuffer();
    return { body, contentType };
  }
}
