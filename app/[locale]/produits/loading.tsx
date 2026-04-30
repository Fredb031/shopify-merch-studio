import { Container } from '@/components/Container';

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-sm bg-sand-100 ${className}`} />
  );
}

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square w-full animate-pulse rounded-md bg-sand-100" />
      <Block className="h-4 w-3/4" />
      <Block className="h-4 w-1/2" />
    </div>
  );
}

export default function Loading() {
  return (
    <Container size="xl" className="py-10">
      {/* Breadcrumbs ghost */}
      <Block className="h-4 w-56" />

      {/* H1 ghost */}
      <Block className="mt-6 h-10 w-3/5 max-w-xl" />
      <Block className="mt-3 h-4 w-2/5 max-w-md" />

      <div className="mt-10 grid gap-10 md:grid-cols-12">
        {/* Sidebar ghost */}
        <aside className="md:col-span-3">
          <div className="space-y-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Block className="h-4 w-24" />
                <Block className="h-3 w-full" />
                <Block className="h-3 w-5/6" />
                <Block className="h-3 w-4/6" />
              </div>
            ))}
          </div>
        </aside>

        {/* Card grid */}
        <div className="md:col-span-9">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </Container>
  );
}
