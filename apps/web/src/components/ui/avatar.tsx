import { cn } from "@/lib/utils";

// Deterministic vibrant gradient per name so people/owners are recognisable at a glance.
const gradients = [
  "from-orange-500 to-rose-500",
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-violet-500 to-fuchsia-500",
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-blue-600",
  "from-pink-500 to-rose-600",
  "from-lime-500 to-emerald-600"
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

interface AvatarProps {
  name: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-12 w-12 text-base" };

export function Avatar({ name, size = "md", className }: AvatarProps) {
  const label = name?.trim() ? name : "Unassigned";
  const gradient = name?.trim() ? gradients[hash(name) % gradients.length] : "from-slate-400 to-slate-500";
  return (
    <span
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white shadow-sm ring-2 ring-white/60 dark:ring-white/10",
        gradient,
        sizes[size],
        className
      )}
    >
      {initials(label)}
    </span>
  );
}
