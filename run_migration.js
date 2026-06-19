import pg from 'pg';
import fs from 'fs';

const sql12 = fs.readFileSync('supabase/12_user_verification_flow.sql', 'utf-8');
const sql13 = fs.readFileSync('supabase/13_auto_create_profile.sql', 'utf-8');
const sql = sql12 + '\n\n' + sql13;


const configs = [
  {
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.aecrmddgsnnxtemyikqu',
  },
  {
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.aecrmddgsnnxtemyikqu',
  }
];

async function tryConfig(config) {
  const connectionString = `postgresql://${config.user}:Kolokoy0206!@${config.host}:${config.port}/postgres`;
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`Connected with ${config.user} on ${config.host}:${config.port}`);
    console.log('Running migration...');
    await client.query(sql);
    console.log('Migration completed successfully!');
    await client.end();
    return true;
  } catch (err) {
    console.log(`Failed on ${config.host}:${config.port} - Error: ${err.message}`);
    try { await client.end(); } catch {}
    return false;
  }
}

async function run() {
  for (const config of configs) {
    const success = await tryConfig(config);
    if (success) process.exit(0);
  }
  console.log('Could not connect to database via any pooler config.');
}

run();
