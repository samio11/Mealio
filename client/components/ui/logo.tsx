import Image from "next/image";

import logoImage from "@/components/ui/logo.svg";

export function Logo({ className = "size-8" }: { className?: string }) {
  return <Image src={logoImage} alt="Mealio" className={className} priority />;
}
