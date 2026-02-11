import { Button } from '../ui/button';

interface Props {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

export default function NavButton({ label, onClick, icon }: Props) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="justify-start w-full hover:border-primary/50"
      onClick={onClick}
    >
      {icon}
      {label}
    </Button>
  );
}
