import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import ExcelJS from "exceljs";
import { z } from "zod";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Render: poslušaj na process.env.PORT
const PORT = process.env.PORT || 3000;

// --- DB ---
if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL env var");
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon zahteva SSL; connection string naj vsebuje sslmode=require.
  // Če bi vseeno imel težave, lahko dodaš:
  // ssl: { rejectUnauthorized: false },
});

// --- Security + parsing ---
app.use(helmet({
  // ker servaš static html/css/js iz iste domene
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:"],
    }
  }
}));
app.use(express.json({ limit: "50kb" }));
app.use(cookieParser());

// --- Static frontend ---
app.use(express.static(path.join(__dirname, "../frontend")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// --- Helpers: auth ---
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET env var");
}

function setAuthCookie(res, payload) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
  res.cookie("auth", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function requireAuth(req, res, next) {
  const token = req.cookies?.auth;
  if (!token) return res.status(401).json({ message: "Ni prijavljen." });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, email, username }
    return next();
  } catch {
    return res.status(401).json({ message: "Seja je potekla. Prijavi se znova." });
  }
}

// --- Validation schemas ---
const registerSchema = z.object({
  username: z.string().min(2).max(50),
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

const jobSchema = z.object({
  name: z.string().min(1).max(80).regex(/^[\p{L}\p{N}\s._-]+$/u, "Neveljavno ime službe."),
});

const timeSchema = z.object({
  jobName: z.string().min(1).max(80),
  action: z.enum(["start", "stop"]),
});

// --- Rate limits (brute-force zaščita) ---
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// -------------------- AUTH --------------------

app.post("/api/register", authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Neveljavni podatki." });

  const { username, email, password } = parsed.data;

  const client = await pool.connect();
  try {
    const exists = await client.query("select 1 from users where email=$1", [email]);
    if (exists.rowCount > 0) {
      return res.status(400).json({ message: "Uporabnik s tem e-naslovom že obstaja" });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const inserted = await client.query(
      "insert into users (username, email, password_hash) values ($1,$2,$3) returning id, username, email",
      [username, email, password_hash]
    );

    const user = inserted.rows[0];
    setAuthCookie(res, { userId: user.id, email: user.email, username: user.username });

    return res.json({ message: "Uporabnik uspešno registriran!", username: user.username });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Napaka strežnika." });
  } finally {
    client.release();
  }
});

app.post("/api/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Neveljavni podatki." });

  const { email, password } = parsed.data;

  const client = await pool.connect();
  try {
    const q = await client.query(
      "select id, username, email, password_hash from users where email=$1",
      [email]
    );
    if (q.rowCount === 0) return res.status(401).json({ message: "Napačen e-naslov ali geslo" });

    const user = q.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Napačen e-naslov ali geslo" });

    setAuthCookie(res, { userId: user.id, email: user.email, username: user.username });
    return res.json({ message: "Prijava uspešna!", username: user.username });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Napaka strežnika." });
  } finally {
    client.release();
  }
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("auth", { path: "/" });
  return res.json({ message: "Odjavljen." });
});

app.get("/api/me", requireAuth, (req, res) => {
  return res.json({ email: req.user.email, username: req.user.username });
});

// -------------------- JOBS --------------------

app.get("/api/jobs", requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const client = await pool.connect();
  try {
    const jobs = await client.query(
      `
      select j.id, j.name,
        exists (
          select 1 from sessions s
          where s.job_id = j.id and s.end_time is null
        ) as active
      from jobs j
      where j.user_id = $1
      order by j.created_at asc
      `,
      [userId]
    );

    return res.json({ jobs: jobs.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Napaka strežnika." });
  } finally {
    client.release();
  }
});

app.post("/api/jobs", requireAuth, async (req, res) => {
  const parsed = jobSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Neveljavno ime službe." });

  const userId = req.user.userId;
  const { name } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query(
      "insert into jobs (user_id, name) values ($1,$2) on conflict (user_id, name) do nothing",
      [userId, name]
    );

    const jobs = await client.query(
      `select j.id, j.name,
        exists (select 1 from sessions s where s.job_id=j.id and s.end_time is null) as active
       from jobs j where j.user_id=$1 order by j.created_at asc`,
      [userId]
    );

    return res.json({ message: "Služba dodana!", jobs: jobs.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Napaka strežnika." });
  } finally {
    client.release();
  }
});

app.delete("/api/jobs", requireAuth, async (req, res) => {
  const parsed = jobSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Neveljavno ime službe." });

  const userId = req.user.userId;
  const { name } = parsed.data;

  const client = await pool.connect();
  try {
    const del = await client.query(
      "delete from jobs where user_id=$1 and name=$2",
      [userId, name]
    );

    if (del.rowCount === 0) return res.status(404).json({ message: "Služba ni bila najdena" });

    const jobs = await client.query(
      `select j.id, j.name,
        exists (select 1 from sessions s where s.job_id=j.id and s.end_time is null) as active
       from jobs j where j.user_id=$1 order by j.created_at asc`,
      [userId]
    );

    return res.json({ message: "Služba odstranjena.", jobs: jobs.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Napaka strežnika." });
  } finally {
    client.release();
  }
});

// -------------------- TIME (START/STOP) --------------------

app.post("/api/time", requireAuth, async (req, res) => {
  const parsed = timeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Neveljavni podatki." });

  const userId = req.user.userId;
  const { jobName, action } = parsed.data;

  const client = await pool.connect();
  try {
    const jobQ = await client.query(
      "select id, name from jobs where user_id=$1 and name=$2",
      [userId, jobName]
    );
    if (jobQ.rowCount === 0) return res.status(404).json({ message: "Služba ne obstaja" });

    const jobId = jobQ.rows[0].id;

    if (action === "start") {
      const open = await client.query(
        "select 1 from sessions where job_id=$1 and end_time is null",
        [jobId]
      );
      if (open.rowCount > 0) return res.status(400).json({ message: "Ta služba je že aktivna!" });

      await client.query("insert into sessions (job_id, start_time) values ($1, now())", [jobId]);
      return res.json({ message: `Začel si delo v službi "${jobName}".` });
    }

    // stop
    const s = await client.query(
      "select id, start_time from sessions where job_id=$1 and end_time is null order by start_time desc limit 1",
      [jobId]
    );
    if (s.rowCount === 0) return res.status(400).json({ message: "Ta služba ni aktivna!" });

    const sessionId = s.rows[0].id;
    await client.query(
      `
      update sessions
      set end_time = now(),
          duration_minutes = greatest(1, round(extract(epoch from (now() - start_time)) / 60))
      where id = $1
      `,
      [sessionId]
    );

    return res.json({ message: `Ustavil si delo v službi "${jobName}".` });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Napaka strežnika." });
  } finally {
    client.release();
  }
});

// -------------------- EXCEL DOWNLOAD (GENERATE ON THE FLY) --------------------

function minutesToHHMM(min) {
  const m = Math.max(0, Number(min || 0));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

app.get("/api/download", requireAuth, async (req, res) => {
  const userId = req.user.userId;

  const client = await pool.connect();
  try {
    const q = await client.query(
      `
      select
        j.name as job_name,
        s.start_time,
        s.end_time,
        s.duration_minutes
      from sessions s
      join jobs j on j.id = s.job_id
      where j.user_id = $1
        and s.end_time is not null
      order by s.start_time asc
      `,
      [userId]
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Beleženje ur";

    // Sheet 1: Delo
    const ws = workbook.addWorksheet("Delo", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    ws.columns = [
      { header: "Datum", key: "date", width: 14 },
      { header: "Služba", key: "job", width: 22 },
      { header: "Začetek", key: "start", width: 12 },
      { header: "Konec", key: "end", width: 12 },
      { header: "Trajanje (HH:MM)", key: "hhmm", width: 18 },
      { header: "Trajanje (min)", key: "min", width: 14 },
      { header: "Mesec", key: "month", width: 18 },
    ];

    ws.getRow(1).font = { bold: true };

    // Sheet 2: Povzetek
    const sum = workbook.addWorksheet("Povzetek", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    sum.columns = [
      { header: "Mesec", key: "month", width: 18 },
      { header: "Skupaj (HH:MM)", key: "hhmm", width: 16 },
      { header: "Skupaj (min)", key: "min", width: 14 },
    ];
    sum.getRow(1).font = { bold: true };

    const monthTotals = new Map();

    for (const r of q.rows) {
      const start = new Date(r.start_time);
      const end = new Date(r.end_time);
      const month = start.toLocaleString("sl-SI", { month: "long", year: "numeric" });

      ws.addRow({
        date: start.toLocaleDateString("sl-SI"),
        job: r.job_name,
        start: start.toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" }),
        end: end.toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" }),
        hhmm: minutesToHHMM(r.duration_minutes),
        min: r.duration_minutes,
        month,
      });

      monthTotals.set(month, (monthTotals.get(month) || 0) + Number(r.duration_minutes || 0));
    }

    // povzetek po mesecih
    for (const [month, totalMin] of monthTotals.entries()) {
      sum.addRow({
        month,
        hhmm: minutesToHHMM(totalMin),
        min: totalMin,
      });
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="belezenje_ur.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Napaka pri generiranju Excela." });
  } finally {
    client.release();
  }
});

// --- Start ---
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server teče na portu ${PORT}`);
});
