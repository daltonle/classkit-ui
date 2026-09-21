import { queryOptions } from "@tanstack/react-query";

import { classkitRepository } from "@/infrastructure/persistence/repository";

export const classKeys = {
  all: ["classes"] as const,
  detail: (classId: string) => ["classes", classId] as const,
};

export const classesQueryOptions = () =>
  queryOptions({
    queryKey: classKeys.all,
    queryFn: ({ signal }) => classkitRepository.listClasses(signal),
  });

export const classQueryOptions = (classId: string) =>
  queryOptions({
    queryKey: classKeys.detail(classId),
    queryFn: ({ signal }) => classkitRepository.getClass(classId, signal),
  });
