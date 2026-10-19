require('dotenv').config();
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

app.listen(PORT, () => console.log(`🌐 الموقع على ${BASE_URL}`));
