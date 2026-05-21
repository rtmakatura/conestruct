import { notFound } from "next/navigation";
import SentryTestClient from "./client";

export default function SentryTestPage() {
  if (process.env.NEXT_PUBLIC_SENTRY_TEST !== "1") {
    notFound();
  }
  return <SentryTestClient />;
}
