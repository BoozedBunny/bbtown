import { Pool, type PoolClient, type QueryResultRow } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __bbtownPool?: Pool;
};

function getPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!globalForDb.__bbtownPool) {
    globalForDb.__bbtownPool = new Pool({ connectionString: databaseUrl });
  }

  return globalForDb.__bbtownPool;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function oneOrNull<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  client?: PoolClient,
): Promise<T | null> {
  const runner = client ?? getPool();
  const res = await runner.query<T>(sql, params);
  return res.rows[0] ?? null;
}

export async function many<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  client?: PoolClient,
): Promise<T[]> {
  const runner = client ?? getPool();
  const res = await runner.query<T>(sql, params);
  return res.rows;
}
