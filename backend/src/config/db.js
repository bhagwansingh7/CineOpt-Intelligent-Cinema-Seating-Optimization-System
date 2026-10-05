const mysql = require('mysql2/promise');
const { db } = require('./env');

// All queries use placeholders (?) so user input is never concatenated into SQL.
const pool = mysql.createPool({
  host: db.host,
  port: db.port,
  user: db.user,
  password: db.password,
  database: db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z',
});

module.exports = pool;
