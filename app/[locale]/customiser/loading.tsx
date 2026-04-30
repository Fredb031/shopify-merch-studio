import { Container } from '@/components/Container';

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-sm bg-sand-100 ${className}`} />
  );
}

export default function Loading() {
  return (
    <Container size="xl" className="py-10">
      {/* Breadcrumbs ghost */}
      <Block className="h-4 w-56" />

      {/* Title */}
      <Block className="mt-6 h-9 w-1/2 max-w-lg" />
      <Block className="mt-3 h-4 w-2/3 max-w-xl" />

      {/* 7-step rail */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-8 w-8 animate-pulse rounded-full bg-sand-100" />
            <Block className="h-3 w-16" />
            {i < 6 ? <Block className="h-px w-6" /> : null}
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="mt-10 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-7">
          <div className="aspect-[4/3] w-full animate-pulse rounded-lg bg-sand-100" />
        </div>
        <div className="md:col-span-5">
          <Block className="h-6 w-1/2" />
          <div className="mt-4 space-y-2">
            <Block className="h-12 w-full rounded-md" />
            <Block className="h-12 w-full rounded-md" />
            <Block className="h-12 w-full rounded-md" />
          </div>
          <Block className="mt-8 h-12 w-full rounded-md" />
        </div>
      </div>
    </Container>
  );
}
