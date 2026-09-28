onst express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const mysql = require("mysql2/promise");
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Set directly to your confirmed Invoke URLs
const DB_ACCESS_URL = "https://xbptb25rog.execute-api.ap-south-1.amazonaws.com/DB-ACCESS";
const RTSS_CONTROL_URL = "https://j2bqq4kzb6.execute-api.ap-south-1.amazonaws.com/Test";

// --- DATABASE POOL ---
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// --- DB ACCESS ---
app.get('/db/getSessions', async (req, res) => {
    try {
        const { chewieId } = req.query;
        const [rows] = await pool.execute(
            `SELECT * FROM Sessions WHERE ChewieId = ? ORDER BY StartTime DESC`,
            [chewieId]
        );
        res.json(rows);
    } catch (err) {
        console.error("DB Session Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/db/getStreamdata', async (req, res) => {
    try {
        const { chewieId, sessionId } = req.query;
        const [rows] = await pool.execute(
            `SELECT
                StreamTransactionId, RawDataTrId, SessionId, Timestamp,
                ChewieId, CurTemp, CurHum, SetTemp, SetHum,
                AS_Lid, AS_Flap, AS_StValve, AS_Auger, AS_HtrFan, AS_ExhFan,
                AS_AddMotor, AS_DCSprayer, AS_FlushSprayer,
                AS_AirValve1, AS_AirValve2, AS_AirValve3,
                AS_Heater, Phase, RemainingDur, WasteCat
             FROM StreamData
             WHERE ChewieId = ? AND SessionId = ?
             ORDER BY Timestamp ASC`,
            [chewieId, sessionId]
        );
        res.json({
            ChewieId: chewieId,
            SessionId: sessionId,
            totalRecords: rows.length,
            streamData: rows
        });
    } catch (err) {
        console.error("DB Stream Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- RTSS CONTROL PROXY (Aligned with Nginx /chewie/rtss/ logic) ---
app.post('/chewie/rtss/start', async (req, res) => {
    try {
        // Points to AWS resource: .../Test/chewie/rtss/start
        const result = await axios.post(`${RTSS_CONTROL_URL}/chewie/rtss/start`, {
            ChewieId: req.body.ChewieId || req.body.chewieId
        });
        res.json(result.data);
    } catch (err) {
        console.error("AWS Start Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/chewie/rtss/stop', async (req, res) => {
    try {
        // Points to AWS resource: .../Test/chewie/rtss/stop
        const result = await axios.post(`${RTSS_CONTROL_URL}/chewie/rtss/stop`, {
            ChewieId: req.body.ChewieId || req.body.chewieId
        });
        res.json(result.data);
    } catch (err) {
        console.error("AWS Stop Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- FRONTEND SERVING ---
app.get('/portal', (req, res) => res.sendFile(path.join(__dirname, 'diagnostic_portal.html')));
app.get('/', (req, res) => res.redirect('/portal'));

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend Proxy running on http://localhost:${PORT}`));
