"use client";

import { useState } from "react";

type Props = {
  name: string;
  avatarUrl?: string | null;
};

export default function MemberAvatar({ name, avatarUrl }: Props) {
  const [errored, setErrored] = useState(false);
  const initial = name.charAt(0).toUpperCase();

  if (avatarUrl && !errored) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="w-full h-full object-cover"
        onError={() => setErrored(true)}
      />
    );
  }

  return <>{initial}</>;
}
