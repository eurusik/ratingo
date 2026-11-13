import Image from 'next/image';

export function CardGlow({ imageUrl }: { imageUrl?: string }) {
  if (!imageUrl) return null;

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <Image src={imageUrl} alt="" fill unoptimized className="scale-125 object-cover blur-2xl" />
      <span className="glow-veil absolute inset-0" />
    </span>
  );
}
