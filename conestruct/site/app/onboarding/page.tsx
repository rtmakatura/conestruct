import { OrganizationList } from "@clerk/nextjs";

export default function OnboardingPage() {
  return (
    <main className="workbench min-h-screen flex items-center justify-center px-6 py-16 bg-[color:var(--canvas)]">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--act)] mb-3">
            00 · ONBOARDING
          </div>
          <h1 className="font-sans font-bold text-[28px] leading-[1.05] tracking-tightest text-white mb-3">
            Set up your company
          </h1>
          <p className="font-sans text-[14px] leading-[1.55] text-[color:var(--ink-on-dark-faint)]">
            Plans live inside a company. Create one for your team, or accept an
            invitation if a teammate already added you.
          </p>
        </div>
        <OrganizationList
          hidePersonal
          afterCreateOrganizationUrl="/app"
          afterSelectOrganizationUrl="/app"
        />
      </div>
    </main>
  );
}
