import { Zap, Clock, RotateCcw, Info, AlertTriangle, Check } from 'lucide-react';
import type { EmailAI } from '@/types/mail';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<
  EmailAI['status'],
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  needs_reply: {
    label: 'Needs Reply',
    icon: Zap,
    className: 'text-pink bg-pink/20',
  },
  waiting_on: {
    label: 'Waiting',
    icon: Clock,
    className: 'text-ice bg-ice/20',
  },
  follow_up: {
    label: 'Follow Up',
    icon: RotateCcw,
    className: 'text-accent bg-accent/10',
  },
  fyi: {
    label: 'FYI',
    icon: Info,
    className: 'text-muted-foreground bg-surface-2',
  },
  important: {
    label: 'Important',
    icon: AlertTriangle,
    className: 'text-destructive bg-destructive/10',
  },
  handled: {
    label: 'Handled',
    icon: Check,
    className: 'text-mint bg-mint/20',
  },
};

interface AIStatusBadgeProps {
  ai: EmailAI;
  className?: string;
}

export default function AIStatusBadge({ ai, className }: AIStatusBadgeProps) {
  const config = STATUS_CONFIG[ai.status];
  if (!config) return null;
  const Icon = config.icon;

  const deadlineLabel = ai.deadline
    ? new Date(ai.deadline).toLocaleDateString(undefined, {
        weekday: 'short',
      })
    : null;

  return (
    <span
      title={ai.reason}
      className={cn(
        'inline-flex items-center gap-1 chrome-label px-1.5 py-0.5 rounded normal-case tracking-normal',
        config.className,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      <span className="uppercase tracking-wide">{config.label}</span>
      {deadlineLabel && <span className="opacity-70">· {deadlineLabel}</span>}
    </span>
  );
}
