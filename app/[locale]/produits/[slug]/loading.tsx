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
      <Block className="h-4 w-64" />

      <div className="mt-8 grid gap-10 md:grid-cols-12">
        {/* Gallery */}
        <div className="md:col-span-7">
          <div className="aspect-square w-full animate-pulse rounded-lg bg-sand-100" />
          <div className="mt-4 grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-sm bg-sand-100"
              />
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="md:col-span-5">
          {/* Title bar */}
          <Block className="h-10 w-3/4" />
          {/* Price bar */}
          <Block className="mt-3 h-5 w-32" />
          {/* 3 short lines */}
          <div className="mt-6 space-y-2">
            <Block className="h-3 w-full" />
            <Block className="h-3 w-5/6" />
            <Block className="h-3 w-4/6" />
          </div>
          {/* Chip row */}
          <div className="mt-6 flex flex-wrap gap-2">
            <Block className="h-7 w-20 rounded-pill" />
            <Block className="h-7 w-24 rounded-pill" />
            <Block className="h-7 w-16 rounded-pill" />
            <Block className="h-7 w-20 rounded-pill" />
          </div>
          {/* 2 CTA bars */}
          <Block className="mt-8 h-12 w-full rounded-md" />
          <Block className="mt-3 h-12 w-full rounded-md" />
        </div>
      </div>
    </Container>
  );
}
