import { LoadingState } from '@lumea/ui';

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <LoadingState />
    </div>
  );
}
