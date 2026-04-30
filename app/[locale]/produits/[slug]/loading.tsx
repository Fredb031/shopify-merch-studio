import { Container } from '@/components/Container';

export default function Loading() {
  return (
    <Container size="xl" className="py-10">
      <div className="h-4 w-64 animate-pulse rounded-sm bg-sand-100" />
      <div className="mt-8 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-7">
          <div className="aspect-square w-full animate-pulse rounded-lg bg-sand-100" />
          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="aspect-square animate-pulse rounded-sm bg-sand-100" />
            <div className="aspect-square animate-pulse rounded-sm bg-sand-100" />
            <div className="aspect-square animate-pulse rounded-sm bg-sand-100" />
            <div className="aspect-square animate-pulse rounded-sm bg-sand-100" />
          </div>
        </div>
        <div className="md:col-span-5">
          <div className="h-10 w-3/4 animate-pulse rounded-sm bg-sand-100" />
          <div className="mt-3 h-4 w-32 animate-pulse rounded-sm bg-sand-100" />
          <div className="mt-6 h-20 w-full animate-pulse rounded-sm bg-sand-100" />
          <div className="mt-6 h-8 w-40 animate-pulse rounded-sm bg-sand-100" />
          <div className="mt-6 h-12 w-full animate-pulse rounded-sm bg-sand-100" />
          <div className="mt-3 h-12 w-full animate-pulse rounded-sm bg-sand-100" />
          <div className="mt-6 h-14 w-full animate-pulse rounded-md bg-sand-100" />
        </div>
      </div>
    </Container>
  );
}
