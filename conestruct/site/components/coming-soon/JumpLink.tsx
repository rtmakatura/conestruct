"use client";

// R49: the sheet's two jump links ("How a plan is made ↓", "What it cites
// ↓").  The browser does the scroll: a plain #hash link, smooth under
// no-preference (globals.css), an instant jump with reduced motion.  Then
// focus moves to the section itself (tabIndex -1), so keyboard and screen-
// reader users land where the page did: on `scrollend`, or after a second
// if no scroll happens (already there) or the browser lacks the event.
// preventScroll: the focus never moves the page itself.
export function JumpLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <a
      className="cs-body cs-link"
      href={`#${to}`}
      onClick={() => {
        const target = document.getElementById(to);
        if (!target) return;
        let done = false;
        const land = () => {
          if (done) return;
          done = true;
          window.removeEventListener("scrollend", land);
          target.focus({ preventScroll: true });
        };
        window.addEventListener("scrollend", land);
        window.setTimeout(land, 1000);
      }}
    >
      {children}
    </a>
  );
}
