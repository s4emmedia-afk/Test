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

let cur, cats = [];
const toast = m => { const t = $('toast'); t.textContent = m; t.className = 'show'; setTimeout(() => t.className = '', 2600); };
const post = (u, d) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json());

async function openManage(g) {
  cur = g; $('dash').hidden = true; $('manage').hidden = false; $('mTitle').textContent = g.name;
  const [meta, cfg] = await Promise.all([fetch(`/api/guild/${g.id}/meta`).then(r => r.json()), fetch(`/api/guild/${g.id}/tickets`).then(r => r.json())]);
  const opts = '<option value="">— اختر روم —</option>' + meta.channels.map(c => `<option value="${esc(c.id)}">#${esc(c.name)}</option>`).join('');
  $('chT').innerHTML = $('chL').innerHTML = opts;
  $('chT').value = cfg.channelId; $('chL').value = cfg.logId;
  $('roles').innerHTML = meta.roles.map(r => `<label class="chip"><input type="checkbox" value="${esc(r.id)}" ${cfg.roles.includes(r.id) ? 'checked' : ''}><span ${r.color !== '#000000' ? `style="color:${esc(r.color)}"` : ''}>${esc(r.name)}</span></label>`).join('') || '<small>ما فيه رتب</small>';
  cats = cfg.categories; drawCats(); drawBg(cfg.bg);
}
function drawBg(u) { $('bgPrev').style.backgroundImage = u ? `url("${u}")` : ''; $('bgPrev').textContent = u ? '' : 'ما فيه خلفية بعد'; }
function drawCats() {
  $('cats').innerHTML = cats.map((c, i) => `<span class="chip">${esc(c)}<button data-i="${i}">✕</button></span>`).join('') || '<small>ما أضفت فئات</small>';
  $('cats').querySelectorAll('button').forEach(b => b.onclick = () => { cats.splice(b.dataset.i, 1); drawCats(); });
}
$('catAdd').onclick = () => {
  const v = $('catName').value.trim();
  if (!v) return toast('اكتب اسم الفئة أول');
  if (cats.length >= 5) return toast('الحد الأقصى 5 فئات');
  cats.push(v); $('catName').value = ''; drawCats();
};
$('bgUp').onclick = () => {
  const f = $('bgFile').files[0];
  if (!f) return toast('اختر صورة أول');
  if (f.size > 4 * 1024 * 1024) return toast('الصورة أكبر من 4MB');
  const rd = new FileReader();
  rd.onload = async () => { const r = await post(`/api/guild/${cur.id}/background`, { data: rd.result }); r.bg ? (drawBg(r.bg), toast('تم رفع الخلفية')) : toast(r.error || 'فشل الرفع'); };
  rd.readAsDataURL(f);
};
$('save').onclick = async () => {
  const roles = [...$('roles').querySelectorAll('input:checked')].map(i => i.value);
  const r = await post(`/api/guild/${cur.id}/tickets`, { categories: cats, channelId: $('chT').value, logId: $('chL').value, roles });
  toast(r.ok ? 'تم حفظ الإعدادات' : 'صار خطأ');
};
$('back').onclick = showDash;
init();
