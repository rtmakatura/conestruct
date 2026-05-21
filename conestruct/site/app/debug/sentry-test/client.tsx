"use client";

import { useState } from "react";

export default function SentryTestClient() {
  const [serverStatus, setServerStatus] = useState<string>("");

  return (
    <main style={{ padding: 32, fontFamily: "monospace" }}>
      <h1>Sentry verification</h1>
      <p>This page only exists when NEXT_PUBLIC_SENTRY_TEST=1.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
        <button
          style={{ padding: 12, border: "1px solid #444" }}
          onClick={() => {
            throw new Error("Sentry frontend verification: intentional client error");
          }}
        >
          Throw client error (browser)
        </button>
        <button
          style={{ padding: 12, border: "1px solid #444" }}
          onClick={async () => {
            const res = await fetch("/api/debug/sentry-test?kind=500");
            setServerStatus(`API responded ${res.status}`);
          }}
        >
          Throw server error (Next.js API 500)
        </button>
        {serverStatus && <pre>{serverStatus}</pre>}
      </div>
    </main>
  );
}
