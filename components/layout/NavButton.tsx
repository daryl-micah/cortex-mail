import { cn } from '@/lib/utils';

interface Props {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  count?: number;
  active?: boolean;
}

export default function NavButton({ label, onClick, icon, count, active }: Props) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-[13px] transition-colors text-left',
        active
          ? 'bg-surface-2 border-l-2 border-l-accent font-medium text-foreground -ml-px'
          : 'border-l-2 border-l-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground'
      )}
    >
      {icon && <span className="shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="chrome-label text-[10px] text-muted-foreground bg-surface-2 border border-border rounded px-1 py-px tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}
