import { useEffect, useState } from "react";

import type { Student } from "@/domain/student/student.schema";
import { studentInitials } from "@/domain/student/student";
import { classkitRepository } from "@/infrastructure/persistence/repository";
import { cn } from "@/shared/lib/utils";

export function StudentAvatar({
  student,
  className,
}: {
  student: Student;
  className?: string;
}) {
  const [avatarImage, setAvatarImage] = useState<{
    avatarId: string;
    url: string;
  }>();

  useEffect(() => {
    const avatarId = student.avatar?.id;
    let active = true;
    let url: string | undefined;
    if (!avatarId) return;
    void classkitRepository.getAvatar(avatarId).then((image) => {
      if (!active || !image) return;
      url = URL.createObjectURL(image);
      setAvatarImage({ avatarId, url });
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [student.avatar?.id]);

  const imageUrl =
    avatarImage && avatarImage.avatarId === student.avatar?.id
      ? avatarImage.url
      : undefined;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white",
        className,
      )}
      style={{ backgroundColor: student.avatarColor }}
    >
      {imageUrl ? (
        <img
          className="size-full rounded-full object-cover"
          src={imageUrl}
          alt=""
        />
      ) : (
        studentInitials(student)
      )}
    </span>
  );
}
