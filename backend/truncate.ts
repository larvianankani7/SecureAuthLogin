import { db } from './src/db/client.js'; import { sql } from 'drizzle-orm'; await db.execute(sql`TRUNCATE TABLE users CASCADE`); console.log('truncated'); process.exit(0);
