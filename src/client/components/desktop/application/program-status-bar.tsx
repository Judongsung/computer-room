interface ProgramStatusBarProps {
  readonly primary: string;
  readonly secondary?: string;
}

export function ProgramStatusBar({ primary, secondary }: ProgramStatusBarProps) {
  return (
    <footer className="desktop-program-status" role="status">
      <span>{primary}</span>
      {secondary ? <span>{secondary}</span> : null}
    </footer>
  );
}
