import {
  classroomDocumentV1Schema,
  type ClassroomDocumentV1,
} from "./document.schema";

export function migrateClassroomDocument(
  rawDocument: unknown,
): ClassroomDocumentV1 {
  if (
    typeof rawDocument !== "object" ||
    rawDocument === null ||
    !("schemaVersion" in rawDocument)
  ) {
    throw new Error("The classroom document does not have a schema version.");
  }

  if (rawDocument.schemaVersion !== 1) {
    throw new Error(
      `Unsupported classroom schema version: ${String(rawDocument.schemaVersion)}`,
    );
  }

  return classroomDocumentV1Schema.parse(rawDocument);
}
