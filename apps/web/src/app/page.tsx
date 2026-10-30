import { NewRunForm, RecentRuns } from "@/features/runs";

export default function HomePage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <NewRunForm />
      <RecentRuns />
    </div>
  );
}
