// Applies migrations to DATABASE_URL (or the local embedded DB). Usage: npm run db:migrate
import { getDb } from "../lib/db";

getDb()
  .then(() => {
    console.log("Database is up to date.");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
