declare module "lucide-react/icons/*" {
declare module "lucide-react/dist/esm/icons/*" {
  import { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";
  export interface LucideProps extends Partial<SVGProps<SVGSVGElement>>, RefAttributes<SVGSVGElement> {
    size?: string | number;
    absoluteStrokeWidth?: boolean;
  }
  const icon: ForwardRefExoticComponent<LucideProps>;
  export default icon;
}

declare module "react-window" {
  import * as React from "react";

  export interface ListChildComponentProps {
    index: number;
    style: React.CSSProperties;
    data: any;
  }

  export class List<T = any> extends React.Component<any> {}
  export function areEqual(a: any, b: any): boolean;
}
