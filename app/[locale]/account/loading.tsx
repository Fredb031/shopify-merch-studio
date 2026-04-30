import { Container } from '@/components/Container';

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-sm bg-sand-100 ${className}`} />
  );
}

function ActivityCardSkeleton() {
  return (
    <div className="rounded-lg border border-sand-300 bg-canvas-000 p-5">
      <div className="flex items-center justify-between">
        <Block className="h-5 w-40" />
        <Block className="h-4 w-20" />
      </div>
      <div className="mt-4 space-y-2">
        <Block className="h-3 w-full" />
        <Block className="h-3 w-5/6" />
        <Block className="h-3 w-2/3" />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Block className="h-9 w-32 rounded-md" />
        <Block className="h-9 w-28 rounded-md" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <Container size="lg" className="py-10">
      {/* Breadcrumbs */}
      <Block className="h-4 w-40" />

      {/* Heading */}
      <Block className="mt-6 h-10 w-2/3" />
      <Block className="mt-3 h-4 w-5/6" />

      {/* 4 stacked activity cards */}
      <div className="mt-10 space-y-5">
        <ActivityCardSkeleton />
        <ActivityCardSkeleton />
        <ActivityCardSkeleton />
        <ActivityCardSkeleton />
      </div>
    </Container>
  );
}
