import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const MANAGED_DIR = path.join(process.cwd(), "managed");

export async function GET(
  _req: Request,
  { params }: { params: { path: string[] } },
): Promise<NextResponse> {
  const [subdir, filename] = params.path;
  if (subdir !== "keys" && subdir !== "zkir") {
    return new NextResponse("not found", { status: 404 });
  }
  if (!filename || /\.\./.test(filename)) {
    return new NextResponse("bad request", { status: 400 });
  }
  const filePath = path.join(MANAGED_DIR, subdir, filename);
  try {
    const contents = await readFile(filePath);
    const mime = subdir === "keys" ? "application/octet-stream" : "application/octet-stream";
    return new NextResponse(new Uint8Array(contents), {
      headers: { "content-type": mime },
    });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
