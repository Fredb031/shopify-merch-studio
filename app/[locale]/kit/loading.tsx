import { Container } from '@/components/Container';

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-sm bg-sand-100 ${className}`} />
  );
}

function KitCardSkeleton() {
  return (
    <div className="rounded-lg border border-sand-300 bg-canvas-000 p-5">
      <div className="aspect-[4/3] w-full animate-pulse rounded-md bg-sand-100" />
      <Block className="mt-5 h-6 w-3/4" />
      <Block className="mt-3 h-4 w-full" />
      <Block className="mt-2 h-4 w-5/6" />
      <Block className="mt-6 h-5 w-24" />
      <Block className="mt-6 h-11 w-full rounded-md" />
    </div>
  );
}

export default function Loading() {
  return (
    <Container size="xl" className="py-10">
      {/* Breadcrumbs */}
      <Block className="h-4 w-56" />

      {/* Heading */}
      <Block className="mt-6 h-10 w-3/5" />
      <Block className="mt-3 h-4 w-2/3" />

      {/* 3 kit cards */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <KitCardSkeleton />
        <KitCardSkeleton />
        <KitCardSkeleton />
      </div>
    </Container>
  );
}
