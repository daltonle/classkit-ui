import Dexie, { type EntityTable } from "dexie";

import { normalizeClassroom } from "@/domain/classroom/classroom";
import type { Classroom } from "@/domain/classroom/classroom.schema";
import { createClassroomDocument } from "@/domain/documents/document.schema";
import { migrateClassroomDocument } from "@/domain/documents/migrations";
import type {
  ClasskitRepository,
  ClassSummary,
  SaveOptions,
  SaveResult,
} from "@/infrastructure/persistence/classkit-repository";
import { PersistenceError } from "@/infrastructure/persistence/persistence-errors";

type ClassRecord = {
  id: string;
  document: unknown;
  revision: string;
  updatedAt: string;
};

type AvatarRecord = { id: string; image: Blob };
type CorruptDocumentRecord = {
  id: string;
  classId: string;
  rawDocument: unknown;
  preservedAt: string;
};

class ClasskitDatabase extends Dexie {
  classes!: EntityTable<ClassRecord, "id">;
  avatars!: EntityTable<AvatarRecord, "id">;
  corruptDocuments!: EntityTable<CorruptDocumentRecord, "id">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      classes: "id, updatedAt",
      avatars: "id",
      corruptDocuments: "id, classId, preservedAt",
    });
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new DOMException("The operation was aborted.", "AbortError");
}

function toSummary(classroom: Classroom): ClassSummary {
  const activeArrangement = classroom.arrangements.find(
    ({ id }) => id === classroom.activeArrangementId,
  );
  return {
    id: classroom.id,
    name: classroom.name,
    ...(classroom.schoolYear ? { schoolYear: classroom.schoolYear } : {}),
    ...(classroom.grade !== undefined ? { grade: classroom.grade } : {}),
    studentCount: classroom.students.length,
    ...(activeArrangement
      ? { activeArrangementName: activeArrangement.name }
      : {}),
    updatedAt: classroom.updatedAt,
  };
}

export class IndexedDbRepository implements ClasskitRepository {
  private readonly database: ClasskitDatabase;

  constructor(databaseName = "classkit") {
    this.database = new ClasskitDatabase(databaseName);
  }

  async listClasses(signal?: AbortSignal): Promise<ClassSummary[]> {
    throwIfAborted(signal);
    const records = await this.database.classes
      .orderBy("updatedAt")
      .reverse()
      .toArray();
    throwIfAborted(signal);
    const summaries: ClassSummary[] = [];

    for (const record of records) {
      try {
        summaries.push(
          toSummary(migrateClassroomDocument(record.document).data),
        );
      } catch (error) {
        await this.preserveCorruptDocument(record, error);
      }
    }

    return summaries;
  }

  async getClass(classId: string, signal?: AbortSignal): Promise<Classroom> {
    throwIfAborted(signal);
    const record = await this.database.classes.get(classId);
    throwIfAborted(signal);

    if (!record) {
      throw new PersistenceError("not_found", "This class could not be found.");
    }

    try {
      return migrateClassroomDocument(record.document).data;
    } catch (error) {
      await this.preserveCorruptDocument(record, error);
      throw new PersistenceError(
        "invalid_document",
        "This class contains invalid saved data. The original has been preserved for recovery.",
        { cause: error },
      );
    }
  }

  async createClass(classroom: Classroom): Promise<void> {
    const existing = await this.database.classes.get(classroom.id);
    if (existing) {
      throw new PersistenceError(
        "conflict",
        "A class with this ID already exists.",
      );
    }
    await this.writeClass(classroom);
  }

  async saveClass(
    classroom: Classroom,
    options?: SaveOptions,
  ): Promise<SaveResult> {
    const existing = await this.database.classes.get(classroom.id);
    if (!existing) {
      throw new PersistenceError("not_found", "This class could not be found.");
    }
    if (
      options?.expectedRevision &&
      options.expectedRevision !== existing.revision
    ) {
      throw new PersistenceError(
        "conflict",
        "This class was changed in another tab.",
      );
    }
    return this.writeClass(classroom);
  }

  async deleteClass(classId: string): Promise<void> {
    const classroom = await this.getClass(classId);
    const avatarIds = classroom.students.flatMap(({ avatar }) =>
      avatar ? [avatar.id] : [],
    );
    await this.database.transaction(
      "rw",
      this.database.classes,
      this.database.avatars,
      async () => {
        await this.database.classes.delete(classId);
        await this.database.avatars.bulkDelete(avatarIds);
      },
    );
  }

  async getAvatar(
    avatarId: string,
    signal?: AbortSignal,
  ): Promise<Blob | undefined> {
    throwIfAborted(signal);
    const record = await this.database.avatars.get(avatarId);
    throwIfAborted(signal);
    return record?.image;
  }

  async saveAvatar(avatarId: string, image: Blob): Promise<void> {
    await this.database.avatars.put({ id: avatarId, image });
  }

  async deleteAvatar(avatarId: string): Promise<void> {
    await this.database.avatars.delete(avatarId);
  }

  private async writeClass(classroom: Classroom): Promise<SaveResult> {
    const normalized = normalizeClassroom(classroom);
    const revision = crypto.randomUUID();
    await this.database.classes.put({
      id: normalized.id,
      document: createClassroomDocument(normalized),
      revision,
      updatedAt: normalized.updatedAt,
    });
    return { revision, updatedAt: normalized.updatedAt };
  }

  private async preserveCorruptDocument(record: ClassRecord, cause: unknown) {
    const alreadyPreserved = await this.database.corruptDocuments
      .where("classId")
      .equals(record.id)
      .first();
    if (!alreadyPreserved) {
      await this.database.corruptDocuments.add({
        id: crypto.randomUUID(),
        classId: record.id,
        rawDocument: record.document,
        preservedAt: new Date().toISOString(),
      });
    }
    console.error("A corrupt classroom document was preserved", {
      classId: record.id,
      error:
        cause instanceof Error ? cause.message : "Unknown validation error",
    });
  }
}
