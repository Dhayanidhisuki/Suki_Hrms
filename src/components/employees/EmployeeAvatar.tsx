/**
 * Circular employee avatar — profile photo when one exists, otherwise a
 * tinted initials disc. Shared by the profile header and the lifecycle
 * dialogs so they stay visually identical.
 */

'use client';

import { useState } from 'react';

interface Props {
  firstName: string;
  lastName: string;
  photoPath?: string | null;
  /** Pixel diameter. */
  size?: number;
  className?: string;
}

export default function EmployeeAvatar({ firstName, lastName, photoPath, size = 56, className = '' }: Props) {
  const [broken, setBroken] = useState(false);
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  const style = { width: size, height: size, fontSize: Math.round(size * 0.34) };

  if (photoPath && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, arbitrary origin
      <img
        src={photoPath}
        alt={`${firstName} ${lastName}`}
        onError={() => setBroken(true)}
        className={`flex-shrink-0 rounded-full object-cover ${className}`}
        style={style}
      />
    );
  }

  return (
    <div
      aria-label={`${firstName} ${lastName}`}
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-semibold ${className}`}
      style={{ ...style, backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
    >
      {initials}
    </div>
  );
}
