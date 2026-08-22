import { OutlineLoader } from "@/components/OutlineLoader";

function Spinner({ className }: { className?: string }) {
  return <OutlineLoader size={16} className={className} />;
}

export { Spinner };
