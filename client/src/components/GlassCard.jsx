export default function GlassCard({ children, className = '', style = {}, onClick, id }) {
  return (
    <div
      className={`glass ${className}`}
      style={{ padding: 'var(--space-xl)', ...style }}
      onClick={onClick}
      id={id}
    >
      {children}
    </div>
  );
}
