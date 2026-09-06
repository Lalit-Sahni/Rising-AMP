import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  body?: ReactNode;
  actionLabel?: string;
  to?: string;
  onAction?: () => void;
};

export default function EmptyState(props: EmptyStateProps): JSX.Element;
