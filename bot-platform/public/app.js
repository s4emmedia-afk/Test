const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function init() {
  const { user } = await (await fetch('/api/me')).json();
  if (!user) return;
  $('auth').innerHTML = `<img src="${esc(user.avatar)}" alt=""><div class="me"><b>${esc(user.name)}</b><small>@${esc(user.username)}</small></div>
    <a class="btn green" href="#" id="goDash">لوحة التحكم</a><a class="btn ghost" href="/auth/logout">تسجيل خروج</a>`;
  $('goDash').onclick = e => { e.preventDefault(); showDash(); };
  showDash();
}

async function showDash() {
  $('hero').hidden = true; $('manage').hidden = true; $('dash').hidden = false;
  const guilds = await (await fetch('/api/guilds')).json();
  $('guilds').innerHTML = guilds.length ? '' : '<p class="sub">ما لقينا سيرفرات تقدر تديرها.</p>';
  guilds.forEach(g => {
    const el = document.createElement('div'); el.className = 'card g';
    el.innerHTML = (g.icon ? `<img src="${esc(g.icon)}" alt="">` : `<div class="ph">${esc(g.name[0])}</div>`) +
      `<b>${esc(g.name)}</b><small>${g.owner ? 'مالك' : 'أدمن'}</small>` +
      (g.botIn ? `<button class="btn gold">إدارة</button>` : `<a class="btn ghost" target="_blank" href="${esc(g.invite)}">إضافة البوت أولاً</a>`);
    if (g.botIn) el.querySelector('button').onclick = () => openManage(g);
    $('guilds').appendChild(el);
  });
}

function openManage(g) { $('dash').hidden = true; $('manage').hidden = false; $('mTitle').textContent = g.name; }
$('back').onclick = showDash;
init();
