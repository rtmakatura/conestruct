"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "system-ui", padding: 32 }}>
        <h1>Something went wrong</h1>
        <p>An unexpected error occurred. The error has been reported.</p>
      </body>
    </html>
  );
}
