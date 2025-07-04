const sql = require('mssql');

const config = {
  user: 'your-username',
  password: 'your-password',
  server: 'your-server.database.windows.net',
  database: 'your-database',
  options: {
    encrypt: true, // Use encryption for Azure SQL Database
  },
};

async function getShowcaseProducts(req, res) {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT * FROM ShowcaseProducts');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error querying Azure SQL Database:', error.message);
    res.status(500).send('Failed to retrieve showcase products');
  }
}

module.exports = { getShowcaseProducts };
