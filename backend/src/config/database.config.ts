import { Pool, PoolClient, QueryResult, QueryResultRow, types } from 'pg';
import { Env } from './env.config';
import { logger } from '../utils/logger';

types.setTypeParser(20, (value) => parseInt(value, 10));
types.setTypeParser(1700, (value) => parseFloat(value));

const pool = new Pool({
  connectionString: Env.DATABASE_URL,
});

const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> => pool.query<T>(text, params);

const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const connectDatabase = async () => {
  try {
    await pool.query('SELECT 1');
    logger.info('Connected to PostgreSQL database');
  } catch (error) {
    logger.error('Error connecting to PostgreSQL database', error);
    process.exit(1);
  }
};

const disconnectDatabase = async () => {
  try {
    await pool.end();
    logger.info('Disconnected from PostgreSQL database');
  } catch (error) {
    logger.error('Error disconnecting from PostgreSQL database', error);
    process.exit(1);
  }
};

export { connectDatabase, disconnectDatabase, pool, query, withTransaction };
