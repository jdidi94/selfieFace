import { LoadingState } from '@lumea/ui';

export default function Loading() {
  return (
    <div className="page-enter mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <LoadingState className="py-16" />
    </div>
  );
}
