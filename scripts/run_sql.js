const fs = require('fs')
const { Client } = require('pg')

async function main() {
  const [,, conn, sqlPath] = process.argv
  if (!conn || !sqlPath) {
    console.error('Usage: node scripts/run_sql.js <connection-string> <sql-file>')
    process.exit(1)
  }
  const sql = fs.readFileSync(sqlPath, 'utf8')
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log('Migration executed successfully:', sqlPath)
  } catch (e) {
    await client.query('ROLLBACK').catch(()=>{})
    console.error('Migration failed:', e)
    process.exit(2)
  } finally {
    await client.end()
  }
}

main()


