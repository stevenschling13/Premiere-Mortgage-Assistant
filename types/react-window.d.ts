declare module 'react-window' {
  import * as React from 'react';

  export interface VariableSizeListProps {
    height: number;
    width: number | string;
    itemCount: number;
    itemSize: (index: number) => number;
    itemKey?: (index: number) => React.Key;
    children: (props: { index: number; style: React.CSSProperties }) => React.ReactNode;
    className?: string;
  }

  export class VariableSizeList extends React.Component<VariableSizeListProps> {
    scrollToItem(index: number, align?: 'auto' | 'smart' | 'center' | 'end' | 'start'): void;
  }
}
