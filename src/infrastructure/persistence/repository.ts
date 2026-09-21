import { googleAuth } from "@/infrastructure/auth/google-auth";
import { GoogleDriveRepository } from "./google-drive-repository";
import { IndexedDbRepository } from "./indexeddb-repository";
import {
  SynchronizedRepository,
  type SyncStatus,
} from "./synchronized-repository";

export const synchronizedRepository = new SynchronizedRepository(
  new IndexedDbRepository(),
  new GoogleDriveRepository(() => googleAuth.getAccessToken()),
);

export const classkitRepository = synchronizedRepository;
export type { SyncStatus };
