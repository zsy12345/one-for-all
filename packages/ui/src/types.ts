export interface GridProps {
  colRatio: string; // 列比例
  colGap: string; // 列间距
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  'data-node-key'?: string;
}

export interface InputProps {
  style?: React.CSSProperties;
  children?: React.ReactNode;
  placeholder?: string;
  type?: string;
  'data-node-key'?: string;
}
