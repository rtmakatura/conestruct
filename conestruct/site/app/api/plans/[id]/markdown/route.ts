import { proxyRender } from "@/lib/render-proxy";

// #122: give cold-start / heavy renders headroom under Vercel's function
// limit (60s < the backend's 120s cap) instead of an opaque NetworkError.
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  return proxyRender(params.id, "markdown");
}
