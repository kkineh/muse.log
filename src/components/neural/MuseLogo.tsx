export function MuseLogo({
  className,
  style,
  as: Tag = 'h1',
}: {
  className?: string;
  style?: React.CSSProperties;
  as?: 'h1' | 'span';
}) {
  return (
    <Tag
      className={className}
      style={{
        fontFamily: 'var(--font-fira-code), monospace',
        color: 'var(--neural-text-primary)',
        fontWeight: 600,
        ...style,
      }}
    >
      <span style={{ display: 'inline-block', transform: 'scaleX(1.38)', margin: '0px 0.14em 0 0' }}>m</span>
      use
      <span style={{ margin: '0px -0.2em 0 -0.1em' }}>.</span>
      <span style={{ marginRight: '-0.04em' }}>l</span>
      og
    </Tag>
  );
}
