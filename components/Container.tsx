import type { HTMLAttributes, ReactNode } from 'react';

type ContainerSize = 'md' | 'lg' | 'xl' | '2xl';

type Props = HTMLAttributes<HTMLDivElement> & {
  size?: ContainerSize;
  children: ReactNode;
};

const sizeClass: Record<ContainerSize, string> = {
  md: 'max-w-container-md',
  lg: 'max-w-container-lg',
  xl: 'max-w-container-xl',
  '2xl': 'max-w-container-2xl',
};

export function Container({ size = 'xl', className = '', children, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`mx-auto w-full px-6 md:px-8 ${sizeClass[size]} ${className}`}
    >
      {children}
    </div>
  );
}
