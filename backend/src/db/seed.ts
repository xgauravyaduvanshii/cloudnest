import 'dotenv/config';
import { disconnectDatabase, withTransaction } from '../config/database.config';
import { Env } from '../config/env.config';
import StorageModel from '../models/storage.model';
import UserModel from '../models/user.model';

const seedUser = {
  name: process.env.SEED_NAME || 'Demo User',
  email: process.env.SEED_EMAIL || 'demo@example.com',
  password: process.env.SEED_PASSWORD || 'password123',
};

const runSeed = async () => {
  await withTransaction(async (client) => {
    const existingUser = await UserModel.findByEmail(seedUser.email, client);

    if (existingUser) {
      await StorageModel.createForUser(existingUser._id, client);
      if (existingUser.email.toLowerCase() === Env.ADMIN_EMAIL.toLowerCase()) {
        await UserModel.updateAdminFields(existingUser._id, { role: 'ADMIN' }, client);
      }
      console.log(`Seed user already exists: ${seedUser.email}`);
      return;
    }

    const user = await UserModel.create(
      {
        ...seedUser,
        role:
          seedUser.email.toLowerCase() === Env.ADMIN_EMAIL.toLowerCase()
            ? 'ADMIN'
            : 'USER',
      },
      client,
    );
    await StorageModel.createForUser(user._id, client);

    console.log(`Seeded user: ${seedUser.email}`);
  });
};

runSeed()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
