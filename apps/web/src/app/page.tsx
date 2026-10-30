import { NewRunForm, RecentRuns } from "@/features/runs";
import { RuntimeInfoCard } from "@/features/runtime";

export default function HomePage() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="grid gap-6">
        <NewRunForm />
        <RuntimeInfoCard />
      </div>
      <RecentRuns />
    </div>
  );
}
