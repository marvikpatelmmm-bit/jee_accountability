const { Pool } = require('pg');

// Use the same connection logic as your server
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    try {
        console.log("⏳ Connecting to database...");
        
        // The SQL Command you tried to run
        await pool.query("ALTER TABLE daily_summaries ADD COLUMN IF NOT EXISTS biology_problems INTEGER DEFAULT 0;");
        
        console.log("✅ SUCCESS: 'biology_problems' column added!");
    } catch (err) {
        console.error("❌ ERROR:", err.message);
    } finally {
        pool.end();
    }
}

runMigration();