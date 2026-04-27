import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="workbench min-h-screen flex items-center justify-center px-6 py-16 bg-[color:var(--canvas)]">
      <SignIn />
    </main>
  );
}
