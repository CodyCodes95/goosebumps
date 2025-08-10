import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LoaderProps = {
  className?: string;
};

// Just the spinner, extendable with classnames
export default function Loader({ className }: LoaderProps) {
  return <Loader2 className={cn("animate-spin", className)} />;
}

// Container for full-page loading states
export function LoaderContainer() {
  return (
    <div className="flex h-full items-center justify-center pt-8">
      <Loader />
    </div>
  );
}
