export type Status = "idle" | "generating" | "done";

interface Props {
  status: Status;
}

export function StatusBar({ status }: Props) {
  if (status === "idle") {
    return (
      <div className="status-bar idle">
        <span className="indicator" />
        <span>Awaiting scenario · fill the panel on the left, then generate</span>
      </div>
    );
  }
  if (status === "generating") {
    return (
      <div className="status-bar warn">
        <span className="indicator" />
        <span>COMPUTING · taper · buffer · spacing · sign placement</span>
      </div>
    );
  }
  return (
    <div className="status-bar pass">
      <span className="indicator" />
      <span>GENERATED · 3 validation warnings · all CDOT supplement checks pass</span>
      <span className="pill pass">READY FOR TCS REVIEW</span>
    </div>
  );
}
