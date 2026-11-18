import { NotFoundState } from "@/components/shared/not-found-state";

export default function NotFound() {
  return (
    <NotFoundState
      title="Page not found"
      description="The page or data you requested could not be found."
    />
  );
}
