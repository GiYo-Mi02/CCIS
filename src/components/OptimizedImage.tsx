import React, { useState } from 'react';
import type { MediaVariant } from '../lib/media';

interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'width' | 'height'> {
  src: string;
  width: number;
  height: number;
  variants?: MediaVariant[];
  fallbackSrc?: string;
  loading?: 'eager' | 'lazy';
}

export default function OptimizedImage({
  src,
  width,
  height,
  variants = [],
  fallbackSrc,
  loading = 'lazy',
  alt,
  onError,
  ...props
}: OptimizedImageProps) {
  const [failed, setFailed] = useState(false);
  const effectiveSrc = failed && fallbackSrc ? fallbackSrc : src;
  const srcSet = variants.length > 0
    ? [...variants, { publicUrl: src, width }].map(variant => `${variant.publicUrl} ${variant.width}w`).join(', ')
    : undefined;

  return (
    <img
      {...props}
      src={effectiveSrc}
      srcSet={failed ? undefined : srcSet}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      onError={(event) => {
        if (fallbackSrc && !failed) setFailed(true);
        onError?.(event);
      }}
    />
  );
}
