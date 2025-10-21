import express from "express";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import xlsx from "xlsx";
import dotenv from "dotenv";
dotenv.config();



import { fileURLToPath } from "url";


const app = express();
const PORT = process.env.PORT = 3000;


// konfiguracija poti
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersFile = path.join(__dirname, "users.json");

const dataDir = path.join(process.cwd(), "backend", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// middleware za JSON
app.use(express.json());

// omogoči dostop do frontend datotek
app.use(express.static(path.join(__dirname, "../frontend")));

// API: registracija novega uporabnika
app.post("/api/register", async(req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ message: "Manjkajo podatki" });

  let users = [];
  if (fs.existsSync(usersFile)) {
    users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
  }

  const userExists = users.some((u) => u.email === email);
  if (userExists)
    return res.status(400).json({ message: "Uporabnik s tem e-naslovom že obstaja" });

  const hashedPassword = await bcrypt.hash(password, 10);

  users.push({ username, email, password: hashedPassword });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

  res.json({ message: "Uporabnik uspešno registriran!" });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!fs.existsSync(usersFile)) {
    return res.status(400).json({ message: "Ni registriranih uporabnikov" });
  }

  const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
  const user = users.find((u) => u.email === email);

  if (!user) {
    return res.status(401).json({ message: "Napačen e-naslov ali geslo" });
  }

  // ✅ preverimo hashirano geslo
  const validPassword = await bcrypt.compare(password, user.password);

  if (!validPassword) {
    return res.status(401).json({ message: "Napačen e-naslov ali geslo" });
  }

  res.json({ message: "Prijava uspešna!", username: user.username });
});


// --------------------------
// 🔹 VRNI SLUŽBE uporabnika
// --------------------------
app.get("/api/jobs/:email", (req, res) => {
  const email = req.params.email;

  if (!fs.existsSync(usersFile)) {
    return res.status(400).json({ message: "Ni uporabnikov" });
  }

  const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
  const user = users.find((u) => u.email === email);

  if (!user) return res.status(404).json({ message: "Uporabnik ne obstaja" });

  // preverimo, če ima katera služba aktivno sejo
  const jobs = (user.jobs || []).map(job => {
    const active = job.sessions?.some(s => !s.end);
    return { ...job, active };
  });

  res.json({ jobs });
});


// --------------------------
// 🔹 DODAJ SLUŽBO uporabniku
// --------------------------
app.post("/api/jobs", (req, res) => {
  const { email, name } = req.body;

  if (!email || !name)
    return res.status(400).json({ message: "Manjkajo podatki" });

  if (!fs.existsSync(usersFile)) {
    return res.status(400).json({ message: "Ni uporabnikov" });
  }

  const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
  const user = users.find((u) => u.email === email);

  if (!user) return res.status(404).json({ message: "Uporabnik ne obstaja" });

  // inicializiraj jobs, če še ne obstaja
  if (!user.jobs) user.jobs = [];

  // dodaj novo službo
  user.jobs.push({ name });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

  res.json({ message: "Služba dodana!", jobs: user.jobs });
});
// --------------------------
// 🔹 ODSTRANI SLUŽBO uporabnika
// --------------------------
app.delete("/api/jobs", (req, res) => {
  const { email, name } = req.body;

  if (!email || !name)
    return res.status(400).json({ message: "Manjkajo podatki" });

  if (!fs.existsSync(usersFile))
    return res.status(400).json({ message: "Ni uporabnikov" });

  const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
  const user = users.find((u) => u.email === email);

  if (!user) return res.status(404).json({ message: "Uporabnik ne obstaja" });

  if (!user.jobs) user.jobs = [];

  // filtriraj ven izbrano službo
  const novaSeznam = user.jobs.filter(j => j.name !== name);

  if (novaSeznam.length === user.jobs.length)
    return res.status(404).json({ message: "Služba ni bila najdena" });

  user.jobs = novaSeznam;
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

  res.json({ message: `Služba "${name}" je bila odstranjena.`, jobs: user.jobs });
});

// --------------------------
// 🔹 ZAČNI / USTAVI DELO (posodobljeno z mesečnimi Excel poročili)
// --------------------------
app.post("/api/time", (req, res) => {
  const { email, jobName, action } = req.body;

  if (!email || !jobName || !action)
    return res.status(400).json({ message: "Manjkajo podatki" });

  const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
  const user = users.find((u) => u.email === email);
  if (!user) return res.status(404).json({ message: "Uporabnik ne obstaja" });

  const job = user.jobs.find((j) => j.name === jobName);
  if (!job) return res.status(404).json({ message: "Služba ne obstaja" });

  if (!job.sessions) job.sessions = [];

  // pot do Excel datoteke za tega uporabnika
  const filePath = path.join(dataDir, `${email.replace(/[@.]/g, "_")}.xlsx`);

  // 🔹 ZAČETEK DELA
  if (action === "start") {
    const active = job.sessions.find((s) => !s.end);
    if (active)
      return res.status(400).json({ message: "Ta služba je že aktivna!" });

    job.sessions.push({ start: new Date().toISOString() });
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

    return res.json({
      message: `Začel si delo v službi "${jobName}".`,
      jobs: user.jobs,
    });
  }

  // 🔹 USTAVITEV DELA
  if (action === "stop") {
  const activeSession = job.sessions.find((s) => !s.end);
  if (!activeSession)
    return res.status(400).json({ message: "Ta služba ni aktivna!" });

  activeSession.end = new Date().toISOString();
  const diffMs = new Date(activeSession.end) - new Date(activeSession.start);
  activeSession.duration = Math.round(diffMs / 60000); // minute

  // pot do Excel datoteke
  const filePath = path.join(dataDir, `${email.replace(/[@.]/g, "_")}.xlsx`);

  let wb, ws, rows;
  if (fs.existsSync(filePath)) {
    wb = xlsx.readFile(filePath);
    ws = wb.Sheets["Delo"];
    rows = xlsx.utils.sheet_to_json(ws);
  } else {
    wb = xlsx.utils.book_new();
    ws = xlsx.utils.json_to_sheet([]);
    xlsx.utils.book_append_sheet(wb, ws, "Delo");
    rows = [];
  }

  // dodaj novo vrstico dela
  const datum = new Date(activeSession.start);
  const mesec = datum.toLocaleString("sl-SI", { month: "long", year: "numeric" });

  rows.push({
    Datum: datum.toLocaleDateString("sl-SI"),
    Služba: jobName,
    "Začetek": new Date(activeSession.start).toLocaleTimeString("sl-SI"),
    "Konec": new Date(activeSession.end).toLocaleTimeString("sl-SI"),
    "Trajanje (min)": activeSession.duration,
    "Mesec": mesec,
  });

  // izračunaj skupno trajanje v tem mesecu
  const mesecneUre = rows
    .filter(r => r.Mesec === mesec && r["Trajanje (min)"])
    .reduce((acc, r) => acc + r["Trajanje (min)"], 0);

  // odstranimo stare vrstice "Skupaj" za ta mesec (če obstajajo)
  const brezStarih = rows.filter(r => !(r.Služba && r.Služba.startsWith("Skupaj ")));

  // dodamo novo vrstico s skupnimi urami
  brezStarih.push({
    Služba: `Skupaj (${mesec})`,
    "Trajanje (min)": mesecneUre,
    "Trajanje (ur)": (mesecneUre / 60).toFixed(2),
  });

  // zapiši nazaj
  ws = xlsx.utils.json_to_sheet(brezStarih);
  wb.Sheets["Delo"] = ws;
  xlsx.writeFile(wb, filePath);

  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

  return res.json({
    message: `Ustavil si delo v službi "${jobName}".`,
    jobs: user.jobs
  });
}
});


// --------------------------
// 🔹 PRENOS EXCELA
// --------------------------
app.get("/api/download/:email", (req, res) => {
  const email = req.params.email;
  const filePath = path.join(dataDir, `${email.replace(/[@.]/g, "_")}.xlsx`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "Ni Excel datoteke za tega uporabnika." });
  }

  res.download(filePath, "belezenje_ur.xlsx", (err) => {
    if (err) {
      console.error("Napaka pri prenosu datoteke:", err);
      res.status(500).send("Napaka pri prenosu datoteke.");
    }
  });
});



// zagon strežnika
app.listen(PORT, () => console.log(`✅ Server teče na http://localhost:${PORT}`));
