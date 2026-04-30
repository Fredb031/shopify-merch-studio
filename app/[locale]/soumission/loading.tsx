import { Container } from '@/components/Container';

function Block({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-sm bg-sand-100 ${className}`} />
  );
}

function FieldRow() {
  return (
    <div className="space-y-2">
      <Block className="h-3 w-32" />
      <Block className="h-11 w-full rounded-md" />
    </div>
  );
}

export default function Loading() {
  return (
    <Container size="md" className="py-10">
      {/* Breadcrumbs */}
      <Block className="h-4 w-56" />

      {/* Heading */}
      <Block className="mt-6 h-10 w-3/4" />
      <Block className="mt-3 h-4 w-full" />
      <Block className="mt-2 h-4 w-5/6" />

      {/* Form */}
      <div className="mt-10 space-y-5">
        <FieldRow />
        <FieldRow />
        <FieldRow />
        <FieldRow />
        <FieldRow />
        <Block className="mt-4 h-12 w-48 rounded-md" />
      </div>
    </Container>
  );
}
