import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { disconnectDatabase, query, withTransaction } from '../config/database.config';

const migrationsDir = path.resolve(__dirname, '../../migrations');

const runMigrations = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const appliedResult = await query<{ name: string }>(
    'SELECT name FROM schema_migrations',
  );
  const applied = new Set(appliedResult.rows.map((row) => row.name));

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Skipping ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
        file,
      ]);
    });

    console.log(`Applied ${file}`);
  }
};

runMigrations()
  .catch((error) => {
    console.error('Migration failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
