import { Pool, PoolClient } from 'pg';
import { config } from '../config/environment';

export const pool = new Pool({
  connectionString: config.database.url || 
    `postgresql://${config.database.user}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.name}`
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export const connectDatabase = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL connected');
    client.release();
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error);
    throw error;
  }
};

export const disconnectDatabase = async () => {
  try {
    await pool.end();
    console.log('✅ PostgreSQL disconnected');
  } catch (error) {
    console.error('❌ PostgreSQL disconnection failed:', error);
  }
};

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export const getClient = (): Promise<PoolClient> => {
  return pool.connect();
};
