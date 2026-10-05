import Image from 'next/image';

/** Identidad original suministrada por Seven Safe, sin reconstruir el logotipo. */
export function BrandLogo({
  compact = false,
  inverse = false,
  className = '',
}: {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={compact ? '/brand/seven-safe-mark.svg' : '/brand/seven-safe.svg'}
      alt="Seven Safe Aseguradora"
      width={compact ? 750 : 3943}
      height={844}
      loading="eager"
      unoptimized
      className={`brand-logo${compact ? ' brand-logo--compact' : ''}${inverse ? ' brand-logo--inverse' : ''} ${className}`.trim()}
    />
  );
}
