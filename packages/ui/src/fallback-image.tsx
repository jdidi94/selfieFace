"use client";

import { useState, type ImgHTMLAttributes } from 'react';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'src'> & {
  src?: string;
  fallbackSrc: string;
};

/** Keeps image error handlers inside a client boundary, including on server pages. */
export function FallbackImage({ src, fallbackSrc, alt = '', ...props }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>();
  const resolved = !src || failedSrc === src ? fallbackSrc : src;
  return <img {...props} src={resolved} alt={alt} onError={() => {
    if (src && resolved !== fallbackSrc) setFailedSrc(src);
  }} />;
}
