import { Loader2 } from "lucide-react";

export default function Loader() {
  return (
    <output className="flex h-full items-center justify-center pt-8">
      <Loader2 aria-hidden className="animate-spin" />
      <span className="sr-only">Loading</span>
    </output>
  );
}
