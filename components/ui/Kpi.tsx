'use client';

export const Kpi = ({
  label,
  title,
  value,
  sub,
  color,
  sem,
  onClick
}: {
  label?: string;
  title?: string;
  value: string | number;
  sub?: string | number | null;
  color?: string;
  sem?: string | null;
  onClick?: () => void;
}) => {
  const semColor = sem || color;
  const textLabel = label || title || '';
  return (
    <div className={`kpi ${onClick ? 'click cursor-pointer' : ''}`} onClick={onClick}>
      {semColor && <span className={`sem ${semColor}`}></span>}
      <div className="l">{textLabel}</div>
      <div className="v">{value}</div>
      {sub != null && sub !== '' && <div className="s">{sub}</div>}
    </div>
  );
};
