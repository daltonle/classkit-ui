import type { Classroom } from "@/domain/classroom/classroom.schema";

export type ClassSummary = {
  id: string;
  name: string;
  schoolYear?: string;
  grade?: number;
  studentCount: number;
  activeArrangementName?: string;
  updatedAt: string;
};

export type SaveOptions = { expectedRevision?: string };
export type SaveResult = { revision: string; updatedAt: string };

export interface ClasskitRepository {
  listClasses(signal?: AbortSignal): Promise<ClassSummary[]>;
  getClass(classId: string, signal?: AbortSignal): Promise<Classroom>;
  createClass(classroom: Classroom): Promise<void>;
  saveClass(classroom: Classroom, options?: SaveOptions): Promise<SaveResult>;
  deleteClass(classId: string): Promise<void>;
  getAvatar(avatarId: string, signal?: AbortSignal): Promise<Blob | undefined>;
  saveAvatar(avatarId: string, image: Blob): Promise<void>;
  deleteAvatar(avatarId: string): Promise<void>;
}
