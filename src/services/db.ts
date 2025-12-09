import Dexie, { Table } from 'dexie';

export interface StorageRecord {
  key: string;
  value: string;
  updatedAt: number;
}

class StorageDatabase extends Dexie {
  public records!: Table<StorageRecord, string>;

  constructor() {
    super('PremiereStorage');
    this.version(1).stores({
      records: '&key, updatedAt',
    });
  }
}

export const storageDb = new StorageDatabase();

export const openDatabase = async () => {
  if (!storageDb.isOpen()) {
    await storageDb.open();
  }
  return storageDb;
};

export const resetDatabase = async () => {
  if (storageDb.isOpen()) {
    storageDb.close();
  }
  await storageDb.delete();
  await openDatabase();
};

export const readAllRecords = async (): Promise<StorageRecord[]> => {
  await openDatabase();
  return storageDb.records.toArray();
};

export const readRecord = async (key: string): Promise<StorageRecord | undefined> => {
  await openDatabase();
  return storageDb.records.get(key);
};

export const writeRecord = async (key: string, value: string) => {
  await openDatabase();
  return storageDb.records.put({ key, value, updatedAt: Date.now() });
};

export const bulkWriteRecords = async (records: StorageRecord[]) => {
  await openDatabase();
  return storageDb.records.bulkPut(records);
};
