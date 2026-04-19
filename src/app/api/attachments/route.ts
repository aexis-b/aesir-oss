import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";

export const runtime = "nodejs";

const DEFAULT_DATA_ROOT = process.env.AESIR_DATA_DIR ?? process.cwd();
const ATTACHMENTS_DIR = join(DEFAULT_DATA_ROOT, "data", "attachments");

function inferExtension(file: File) {
  const fromName = extname(file.name || "").trim();
  if (fromName) {
    return fromName.toLowerCase();
  }

  switch (file.type) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return ".png";
  }
}

export async function POST(request: Request) {
  const form = await request.formData();
  const image = form.get("image");

  if (!(image instanceof File)) {
    return Response.json({ error: "Image file required" }, { status: 400 });
  }

  if (!image.type.startsWith("image/")) {
    return Response.json({ error: "Only image uploads are supported" }, { status: 400 });
  }

  await mkdir(ATTACHMENTS_DIR, { recursive: true });
  const extension = inferExtension(image);
  const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}${extension}`;
  const targetPath = join(ATTACHMENTS_DIR, filename);
  const buffer = Buffer.from(await image.arrayBuffer());
  await writeFile(targetPath, buffer);

  return Response.json({
    path: targetPath,
    name: image.name || filename,
    mimeType: image.type,
  });
}
