require('dotenv').config();
const fs = require('fs'), path = require('path');
const express = require('express'), session = require('express-session');
const { Client, GatewayIntentBits } = require('discord.js');
const { CLIENT_ID, CLIENT_SECRET, BOT_TOKEN, BASE_URL, SESSION_SECRET, PORT = 3000 } = process.env;
const REDIRECT = `${BASE_URL}/auth/callback`;

// ===== البوت =====
const bot = new Client({ intents: [GatewayIntentBits.Guilds] });
bot.once('ready', () => console.log(`✅ البوت شغال: ${bot.user.tag}`));
bot.login(BOT_TOKEN);

// ===== الموقع =====
const app = express();
app.set('trust proxy', 1);
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false,
  cookie: { maxAge: 7 * 864e5, secure: 'auto', sameSite: 'lax' } }));
const DATA = path.join(__dirname, 'data'), UP = path.join(DATA, 'uploads');
fs.mkdirSync(UP, { recursive: true });
const CFG = path.join(DATA, 'config.json');
const load = () => { try { return JSON.parse(fs.readFileSync(CFG)); } catch { return {}; } };
const save = d => fs.writeFileSync(CFG, JSON.stringify(d, null, 1));
app.use(express.json({ limit: '6mb' }));
app.use('/uploads', express.static(UP));
app.use(express.static('public'));

const avatarOf = u => u.avatar
  ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
  : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> 22n) % 6n)}.png`;

app.get('/auth/login', (q, r) => r.redirect('https://discord.com/oauth2/authorize?' +
  new URLSearchParams({ client_id: CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT, scope: 'identify guilds' })));

app.get('/auth/callback', async (q, r) => {
  try {
    const t = await (await fetch('https://discord.com/api/oauth2/token', { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code',
        code: q.query.code, redirect_uri: REDIRECT }) })).json();
    const h = { Authorization: `Bearer ${t.access_token}` };
    q.session.user = await (await fetch('https://discord.com/api/users/@me', { headers: h })).json();
    q.session.guilds = await (await fetch('https://discord.com/api/users/@me/guilds', { headers: h })).json();
  } catch (e) { console.error(e); }
  r.redirect('/');
});

app.get('/auth/logout', (q, r) => q.session.destroy(() => r.redirect('/')));

app.get('/api/me', (q, r) => {
  const u = q.session.user;
  if (!u || !u.id) return r.json({ user: null });
  r.json({ user: { id: u.id, name: u.global_name || u.username, username: u.username, avatar: avatarOf(u) } });
});

// السيرفرات الي هو مالكها أو عنده فيها صلاحية Administrator
app.get('/api/guilds', (q, r) => {
  if (!q.session.user) return r.status(401).json([]);
  const list = (q.session.guilds || [])
    .filter(g => g.owner || (BigInt(g.permissions) & 8n) === 8n)
    .map(g => ({
      id: g.id, name: g.name, owner: g.owner,
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null,
      botIn: bot.guilds.cache.has(g.id),
      invite: 'https://discord.com/oauth2/authorize?' + new URLSearchParams({ client_id: CLIENT_ID,
        scope: 'bot applications.commands', permissions: '8', guild_id: g.id, disable_guild_select: 'true' })
    }));
  r.json(list);
});

// ===== المرحلة 2: التذاكر =====
const manage = (q, id) => {
  const g = (q.session.guilds || []).find(x => x.id === id);
  return g && (g.owner || (BigInt(g.permissions) & 8n) === 8n) && bot.guilds.cache.has(id) ? bot.guilds.cache.get(id) : null;
};
const guard = (q, r, next) => { const g = manage(q, q.params.id); if (!g) return r.status(403).json({ error: 'غير مصرح' }); q.guild = g; next(); };

app.get('/api/guild/:id/meta', guard, (q, r) => {
  const g = q.guild;
  r.json({
    channels: g.channels.cache.filter(c => c.type === 0).sort((a, b) => a.position - b.position).map(c => ({ id: c.id, name: c.name })),
    roles: g.roles.cache.filter(x => x.id !== g.id && !x.managed).sort((a, b) => b.position - a.position)
      .map(x => ({ id: x.id, name: x.name, color: x.hexColor }))
  });
});

app.get('/api/guild/:id/tickets', guard, (q, r) =>
  r.json({ categories: [], channelId: '', logId: '', roles: [], bg: '', ...(load()[q.params.id] || {}) }));

app.post('/api/guild/:id/tickets', guard, (q, r) => {
  const g = q.guild, b = q.body || {}, all = load(), old = all[g.id] || {};
  const cats = (Array.isArray(b.categories) ? b.categories : []).map(x => String(x).trim().slice(0, 30)).filter(Boolean).slice(0, 5);
  const ch = id => (g.channels.cache.get(id)?.type === 0 ? id : '');
  all[g.id] = { ...old, categories: cats, channelId: ch(b.channelId), logId: ch(b.logId),
    roles: (Array.isArray(b.roles) ? b.roles : []).filter(id => g.roles.cache.has(id)) };
  save(all); r.json({ ok: true });
});

app.post('/api/guild/:id/background', guard, (q, r) => {
  const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(q.body?.data || '');
  if (!m) return r.status(400).json({ error: 'صيغة غير مدعومة (png / jpg / webp)' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 4 * 1024 * 1024) return r.status(400).json({ error: 'الحجم أكبر من 4MB' });
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1], all = load();
  fs.writeFileSync(path.join(UP, `${q.params.id}.${ext}`), buf);
  all[q.params.id] = { ...(all[q.params.id] || {}), bg: `/uploads/${q.params.id}.${ext}?v=${Date.now()}` };
  save(all); r.json({ bg: all[q.params.id].bg });
});

app.listen(PORT, () => console.log(`🌐 الموقع على ${BASE_URL}`));
