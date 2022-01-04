import React from 'react';

export interface Props {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  placeholder?: string;
  cols?: number;
  rows?: number;
  minLength?: number;
  maxLength?: number;
}

function Textarea(props: Props): JSX.Element {
  const { placeholder, cols, rows, minLength, maxLength } = props;

  return (
    <div>
      <textarea
        placeholder={placeholder || '请输入内容'}
        cols={cols} rows={rows}
        minLength={minLength}
        maxLength={maxLength}> </textarea>
    </div>
  );
}

export default Textarea;
