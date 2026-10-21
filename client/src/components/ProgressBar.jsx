export default function ProgressBar({ value = 0, className = '', animated = true, label }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      className={`progress-track ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeValue)}
      aria-label={label}
    >
      <div
        className={`progress-fill ${animated ? '' : '[&::after]:hidden'}`}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}
