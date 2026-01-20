import fs from 'fs';
import path from 'path';
import pool from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('Running migrations...');
    
    // Read initial schema migration
    const migration1Path = path.join(process.cwd(), 'src', 'migrations', '001_initial_schema.sql');
    let migration1SQL: string;
    
    if (fs.existsSync(migration1Path)) {
      migration1SQL = fs.readFileSync(migration1Path, 'utf8');
    } else {
      const altPath = path.join(__dirname, '001_initial_schema.sql');
      migration1SQL = fs.readFileSync(altPath, 'utf8');
    }
    
    // Read targets and KPIs migration
    const migration2Path = path.join(process.cwd(), 'src', 'migrations', '002_add_targets_and_kpis.sql');
    let migration2SQL: string = '';
    
    if (fs.existsSync(migration2Path)) {
      migration2SQL = fs.readFileSync(migration2Path, 'utf8');
    } else {
      const altPath = path.join(__dirname, '002_add_targets_and_kpis.sql');
      if (fs.existsSync(altPath)) {
        migration2SQL = fs.readFileSync(altPath, 'utf8');
      }
    }
    
    // Execute migrations
    await client.query('BEGIN');
    await client.query(migration1SQL);
    if (migration2SQL) {
      await client.query(migration2SQL);
    }
    await client.query('COMMIT');
    
    console.log('Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations()
  .then(() => {
    console.log('Database setup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database setup failed:', error);
    process.exit(1);
  });

