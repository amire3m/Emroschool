import {
  BookOpen,
  Camera,
  Cpu,
  Film,
  Headphones,
  Layers3,
  Mic,
  Palette,
  PenTool,
  PlayCircle,
  Scissors,
  Tv,
  User,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";

const categoryIcons: Record<string, LucideIcon> = {
  BookOpen,
  Camera,
  Cpu,
  Film,
  Headphones,
  Layers3,
  Mic,
  Palette,
  PenTool,
  PlayCircle,
  Scissors,
  Tv,
  User,
  Users,
  Video,
};

export default function CategoryIcon({ name, size = 40, className }: { name?: string | null; size?: number; className?: string }) {
  const Icon = categoryIcons[name || ""] || Film;
  return <Icon size={size} className={className} strokeWidth={1.7} />;
}
