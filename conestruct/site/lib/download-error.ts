// How a failed download reads, one way for every download surface (#203).

// Pull a user-facing message out of a 400 response body.  The render
// service raises HTTPException(400, detail={"error": ..., "message":
// "...", "violations": [...]}); FastAPI serialises that as
// {"detail": {...}}.  Some validators raise with a string detail, in
// which case we fall back to that.  Anything we can't parse becomes
// the safe default "Invalid scenario".
export async function extractValidationMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      detail?: { message?: unknown } | string;
    };
    if (body.detail && typeof body.detail === "object") {
      const m = body.detail.message;
      if (typeof m === "string" && m.length > 0) return m;
    }
    if (typeof body.detail === "string" && body.detail.length > 0) {
      return body.detail;
    }
  } catch {
    // Body wasn't JSON — fall through to default.
  }
  return "Invalid scenario";
}

// The route names the file (render-proxy.ts sets
// `content-disposition: attachment; filename="<plan>.<ext>"`).
function filenameFrom(res: Response, ext: string): string {
  const cd = res.headers.get("content-disposition") ?? "";
  const m = /filename="([^"]+)"/.exec(cd);
  return m ? m[1] : `plan.${ext}`;
}

// #203: a saved plan's download, fetched in the page so a failure stays
// on it.  Resolves to null when the file was saved, or to the message
// the card prints (the wording the sandbox's download cards print for
// the same response; the sandbox's quote button names every failure by
// its status, so on a 400 the saved quote is the more specific of the two).
export async function downloadSavedPart(url: string, ext: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return "Network error";
  }
  if (!res.ok) {
    return res.status === 400
      ? await extractValidationMessage(res)
      : `Render failed (${res.status})`;
  }
  try {
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filenameFrom(res, ext);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  } catch {
    return "Network error";
  }
  return null;
}
