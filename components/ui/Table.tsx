'use client';

import React from 'react';

export const Table = ({
  children,
  className = '',
  style
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <div className={`tbl-wrap ${className}`} style={style}>
    <table className="tbl">{children}</table>
  </div>
);
