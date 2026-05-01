import { proxyRender } from "@/lib/render-proxy";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  return proxyRender(params.id, "markdown");
}
