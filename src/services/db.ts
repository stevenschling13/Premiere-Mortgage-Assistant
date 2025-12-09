import Dexie, { Table } from 'dexie';
import { Client, DealStage } from '../types';
import { DEFAULT_DEAL_STAGES, INITIAL_CLIENTS } from '../constants';

export class MortgageDatabase extends Dexie {
  clients!: Table<Client, string>;
  dealStages!: Table<DealStage, string>;

  constructor() {
    super('PremiereMortgageDB');
    this.version(1).stores({
      clients: 'id, status, nextActionDate, name',
      dealStages: 'name'
    });
  }
}

export const db = new MortgageDatabase();

const seedDefaults = async () => {
  const [clientCount, stageCount] = await Promise.all([
    db.clients.count(),
    db.dealStages.count()
  ]);

  if (clientCount === 0) {
    await db.clients.bulkAdd(INITIAL_CLIENTS);
  }

  if (stageCount === 0) {
    await db.dealStages.bulkAdd(DEFAULT_DEAL_STAGES);
  }
};

export const loadClientsFromDb = async (): Promise<Client[]> => {
  await seedDefaults();
  return db.clients.toArray();
};

export const loadDealStagesFromDb = async (): Promise<DealStage[]> => {
  await seedDefaults();
  return db.dealStages.toArray();
};

export const persistClientsToDb = async (clients: Client[]) => {
  await db.transaction('rw', db.clients, async () => {
    await db.clients.clear();
    if (clients.length > 0) {
      await db.clients.bulkAdd(clients);
    }
  });
};

export const persistDealStagesToDb = async (dealStages: DealStage[]) => {
  await db.transaction('rw', db.dealStages, async () => {
    await db.dealStages.clear();
    if (dealStages.length > 0) {
      await db.dealStages.bulkAdd(dealStages);
    }
  });
};
