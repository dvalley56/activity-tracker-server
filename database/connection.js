const { createPool } = require('mysql2/promise');

const pool = createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

exports.execute = async (query, params) => {
    const conn = await pool.getConnection();
    try {
        const [rows, fields] = await conn.query(query, params);
        return rows;
    } catch (err) {
        console.log(err);
    } finally {
        conn.release();
    }
}
