import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createResearchRunner } from '@pickler/core';
import { SqliteResearchStore, ExaResearch, PolymarketData } from '@pickler/infrastructure';
import { readEnv } from '../config/env';
import { createModel } from './model';

export async function createContainer() {
  const env = readEnv();
  await mkdir(env.dataDir, { recursive: true, mode: 0o700 });
  const repository = new SqliteResearchStore(`file:${join(env.dataDir, 'pickler.db')}`);
  await repository.init();
  await repository.bindConnectionIdentity(createHash('sha256').update(JSON.stringify([env.MODEL_BASE_URL, env.MODEL_ID, env.MODEL_API_KEY, env.EXA_API_KEY])).digest('hex'));
  const search = new ExaResearch(env.EXA_API_KEY);
  const markets = new PolymarketData();
  const model = createModel(env);
  let checking = false;
  return {
    env, repository, markets,
    execute: createResearchRunner({ repository, search, reader: search, markets, model }),
    async checkConnections() {
      if (checking) throw new Error('Connection check already running');
      checking = true;
      await repository.setConnectionsChecked(false);
      try {
        const result = await model.check();
        const categories = await markets.categories(AbortSignal.timeout(20_000));
        const searchResult = await search.search('Polymarket resolution rules official documentation', AbortSignal.timeout(20_000));
        const sources = searchResult.sources;
        if (!categories.length || !sources.length) throw new Error('Provider returned no verification data');
        const source = await search.read(sources[0]!.url, AbortSignal.timeout(20_000));
        await repository.setConnectionsChecked(true);
        return { modelCheck: result, categories: categories.length, exa: { search: true, read: true, usage: [searchResult.usage, source.providerUsage] } };
      } finally { checking = false; }
    },
  };
}
export type Container = Awaited<ReturnType<typeof createContainer>>;
