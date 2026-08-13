/* XpertOne CRM
   ------------------------------------------------------------------
   Inquiry log, job pipeline and team accounts on top of Supabase.
   Connection details come from /assets/js/config.js so there is a
   single place to change them for the whole site.
   ------------------------------------------------------------------ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const CFG = (window.XO_CONFIG && window.XO_CONFIG.SUPABASE) || {};
if (!CFG.url || !CFG.key) {
  document.getElementById('boot').textContent =
    'Configuration missing — assets/js/config.js did not load.';
  throw new Error('Missing Supabase config');
}
const sb = createClient(CFG.url, CFG.key);

/* ---------------- pipeline definition (mirrors stage_role() in SQL) ------- */

const STAGES = [
  { id: 'details',          label: 'Details & logo',       role: 'sales' },
  { id: 'mockup',           label: 'Designer mockup',      role: 'designer' },
  { id: 'approval',         label: 'Client approval',      role: 'sales' },
  { id: 'quote',            label: 'Quotation',            role: 'sales' },
  { id: 'purchase_request', label: 'Purchase request',     role: 'sales' },
  { id: 'purchasing',       label: 'Purchasing',           role: 'purchasing' },
  { id: 'production',       label: 'Printing / embroidery', role: 'production' },
  { id: 'pasting',          label: 'Pasting',              role: 'pasting' },
  { id: 'delivery',         label: 'Delivery',             role: 'delivery' },
  { id: 'payment',          label: 'Payment',              role: 'accounts' },
  { id: 'invoiced',         label: 'Final invoice',        role: 'accounts' },
  { id: 'completed',        label: 'Done',                 role: null },
  { id: 'on_hold',          label: 'On hold',              role: null },
  { id: 'cancelled',        label: 'Cancelled',            role: null }
];
const BOARD_STAGES = STAGES.filter(s => !['on_hold', 'cancelled'].includes(s.id));
const stageOf = id => STAGES.find(s => s.id === id) || { id, label: id, role: null };

const SOURCE_LABEL = {
  whatsapp: 'WhatsApp', facebook_ad: 'Facebook ad', instagram_ad: 'Instagram ad',
  website: 'Website', phone: 'Phone', walk_in: 'Walk in', referral: 'Referral', other: 'Other'
};
const STATUS_CLASS = {
  new: 'b-new', assigned: 'b-live', contacted: 'b-live', qualified: 'b-live',
  quoted: 'b-live', won: 'b-good', lost: 'b-bad', dormant: 'b-mute'
};
const OPEN_STATUSES = ['new', 'assigned', 'contacted', 'qualified', 'quoted'];
const ROLE_LABEL = {
  admin: 'Admin', sales: 'Sales', designer: 'Designer', purchasing: 'Purchasing',
  production: 'Production', pasting: 'Pasting', delivery: 'Delivery', accounts: 'Accounts'
};

/* ---------------- tiny helpers ------------------------------------------- */

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = v => String(v ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('on'), 2600);
}
function say(el, text, kind) {
  const n = typeof el === 'string' ? $(el) : el;
  n.textContent = text;
  n.className = 'msg on ' + (kind || 'err');
  if (kind === 'ok') setTimeout(() => n.classList.remove('on'), 4000);
}
function hide(el) { (typeof el === 'string' ? $(el) : el).classList.remove('on'); }

function ago(iso) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return mins + 'm';
  const h = Math.floor(mins / 60);
  if (h < 24) return h + 'h';
  const d = Math.floor(h / 24);
  return d < 30 ? d + 'd' : Math.floor(d / 30) + 'mo';
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB',
    { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function money(n) {
  if (n === null || n === undefined || n === '') return '—';
  return 'AED ' + Number(n).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const clientName = c => !c ? 'Unknown client'
  : (c.company_name || c.contact_name || c.phone || 'Unknown client');

/* ---------------- state --------------------------------------------------- */

const S = {
  me: null,          // profile row of the signed-in user
  view: 'inbox',
  inquiries: [],
  jobs: [],
  clients: [],
  team: []
};
const isAdmin  = () => S.me && S.me.role === 'admin';
const isSales  = () => S.me && S.me.role === 'sales';
const canLog   = () => isAdmin() || isSales();
const canMove  = job => isAdmin() || (S.me && S.me.role === stageOf(job.stage).role);

/* ---------------- boot ---------------------------------------------------- */

(async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return showGate();
  await loadMe(session.user.id);
})();

sb.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') location.reload();
});

function showGate() {
  $('#boot').style.display = 'none';
  $('#app').style.display = 'none';
  $('#gate').style.display = 'grid';
}

async function loadMe(uid) {
  const { data, error } = await sb.from('profiles')
    .select('id, full_name, phone, role, is_active').eq('id', uid).maybeSingle();

  if (error || !data) {
    await sb.auth.signOut();
    showGate();
    return say('#loginMsg', 'We could not load your profile. Ask an admin to check your account.');
  }
  if (!data.is_active || !data.role) {
    await sb.auth.signOut();
    showGate();
    return say('#loginMsg', 'Your account is not active yet. An admin needs to switch it on.');
  }

  S.me = data;
  $('#whoName').textContent = data.full_name || 'Team member';
  $('#whoRole').textContent = ROLE_LABEL[data.role] || data.role;
  $('#boot').style.display = 'none';
  $('#gate').style.display = 'none';
  $('#app').style.display = 'block';

  applyPermissions();
  await refreshAll();
}

function applyPermissions() {
  // Tabs each role is allowed to open.
  const allowed = {
    inbox:    isAdmin() || isSales(),
    pipeline: true,
    clients:  isAdmin() || isSales() || S.me.role === 'designer',
    team:     isAdmin()
  };
  $$('#tabs button').forEach(b => {
    if (!allowed[b.dataset.view]) b.style.display = 'none';
  });
  if (!allowed.inbox) switchView('pipeline');
  if (!canLog()) $('#addCard').style.display = 'none';
}

/* ---------------- sign in / out ------------------------------------------- */

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('#loginBtn');
  btn.disabled = true; btn.textContent = 'Signing in…';
  hide('#loginMsg');

  const { data, error } = await sb.auth.signInWithPassword({
    email: $('#email').value.trim(),
    password: $('#pw').value
  });
  btn.disabled = false; btn.textContent = 'Sign in';

  if (error) return say('#loginMsg', error.message || 'That did not work.');
  await loadMe(data.user.id);
});

$('#signOut').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });

/* ---------------- tabs ---------------------------------------------------- */

$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-view]');
  if (b) switchView(b.dataset.view);
});
function switchView(v) {
  S.view = v;
  $$('#tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === v)));
  $$('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
}

/* ---------------- data loading -------------------------------------------- */

async function refreshAll() {
  await Promise.all([loadTeam(), loadInquiries(), loadJobs(), loadClients()]);
  fillPeopleSelects();
}

async function loadTeam() {
  const { data, error } = await sb.from('profiles')
    .select('id, full_name, phone, role, is_active').order('full_name');
  if (error) return;
  S.team = data || [];
  renderTeam();
}

async function loadInquiries() {
  const { data, error } = await sb.from('inquiries')
    .select('*, client:clients(*), assignee:profiles!inquiries_assigned_to_fkey(id, full_name)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) { console.warn(error); return; }
  S.inquiries = data || [];
  renderInbox();
}

async function loadJobs() {
  const { data, error } = await sb.from('jobs')
    .select('*, client:clients(id, company_name, contact_name, phone), ' +
            'owner:profiles!jobs_owner_id_fkey(id, full_name), inquiry:inquiries(ref)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) { console.warn(error); return; }
  S.jobs = data || [];
  renderBoard();
}

async function loadClients() {
  const { data, error } = await sb.from('clients')
    .select('*').order('created_at', { ascending: false }).limit(500);
  if (error) return;
  S.clients = data || [];
  renderClients();
}

function fillPeopleSelects() {
  const sales = S.team.filter(p => p.is_active && ['sales', 'admin'].includes(p.role));
  const opts = sales.map(p => `<option value="${p.id}">${esc(p.full_name || 'Unnamed')}</option>`).join('');

  const add = $('#addAssign');
  if (add) add.innerHTML = `<option value="">Nobody yet</option>${opts}`;

  const filter = $('#fWho');
  if (filter) {
    filter.innerHTML = `<option value="">Everyone</option><option value="__none">Unassigned</option>` +
      (S.me ? `<option value="${S.me.id}">Just mine</option>` : '') + opts;
  }
}

/* ---------------- inquiries: quick add ------------------------------------ */

$('#addForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const btn = $('#addBtn');
  const phone = f.phone.value.trim();
  const email = f.email.value.trim();

  if (!phone && !email) return say('#addMsg', 'Give at least a phone number or an email address.');

  btn.disabled = true; btn.textContent = 'Saving…';
  hide('#addMsg');

  const { data: ref, error } = await sb.rpc('log_inquiry', {
    p_company: f.company.value.trim(),
    p_contact: f.contact.value.trim(),
    p_phone: phone,
    p_email: email,
    p_product: f.product.value.trim(),
    p_qty: f.qty.value ? Number(f.qty.value) : null,
    p_source: f.source.value,
    p_notes: f.notes.value.trim()
  });

  btn.disabled = false; btn.textContent = 'Save inquiry';
  if (error) return say('#addMsg', error.message || 'Could not save that.');

  // Assign straight away if a salesperson was picked.
  const who = f.assigned.value;
  if (who) {
    const { data: row } = await sb.from('inquiries').select('id').eq('ref', ref).maybeSingle();
    if (row) {
      await sb.from('inquiries')
        .update({ assigned_to: who, assigned_at: new Date().toISOString(), status: 'assigned' })
        .eq('id', row.id);
    }
  }

  f.reset();
  say('#addMsg', `Saved as inquiry #${ref}. Nothing lost.`, 'ok');
  await loadInquiries();
  await loadClients();
});

/* ---------------- inquiries: list ----------------------------------------- */

['#qInbox', '#fStatus', '#fWho'].forEach(sel => {
  const el = $(sel);
  if (el) el.addEventListener('input', renderInbox);
});

function inboxFiltered() {
  const q = ($('#qInbox').value || '').toLowerCase().trim();
  const st = $('#fStatus').value;
  const who = $('#fWho').value;

  return S.inquiries.filter(i => {
    if (st === 'open' && !OPEN_STATUSES.includes(i.status)) return false;
    if (st && st !== 'open' && i.status !== st) return false;
    if (who === '__none' && i.assigned_to) return false;
    if (who && who !== '__none' && i.assigned_to !== who) return false;
    if (!q) return true;
    const hay = [
      i.client?.company_name, i.client?.contact_name, i.client?.phone,
      i.client?.email, i.product_interest, i.notes, '#' + i.ref
    ].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

function renderInbox() {
  const rows = inboxFiltered();
  const body = $('#inboxRows');

  body.innerHTML = rows.map(i => {
    const stale = OPEN_STATUSES.includes(i.status) && !i.first_response_at &&
      (Date.now() - new Date(i.created_at).getTime()) > 864e5;
    return `<tr data-id="${i.id}">
      <td><b>#${i.ref}</b></td>
      <td><b>${esc(clientName(i.client))}</b>
          <div class="hint">${esc(i.client?.phone || '')}</div></td>
      <td>${esc(i.product_interest || '—')}
          ${i.quantity_est ? `<span class="chip">${i.quantity_est} pcs</span>` : ''}</td>
      <td><span class="chip">${esc(SOURCE_LABEL[i.source] || i.source)}</span></td>
      <td><span class="badge ${STATUS_CLASS[i.status] || 'b-mute'}">${esc(i.status)}</span></td>
      <td>${i.assignee ? esc(i.assignee.full_name) : '<span class="badge b-bad">unassigned</span>'}</td>
      <td class="${stale ? 'overdue' : ''}">${ago(i.created_at)}</td>
    </tr>`;
  }).join('');

  $('#inboxEmpty').style.display = rows.length ? 'none' : 'block';

  const open = S.inquiries.filter(i => OPEN_STATUSES.includes(i.status));
  $('#sUnassigned').textContent = open.filter(i => !i.assigned_to).length;
  $('#sOpen').textContent = open.length;
  $('#sMine').textContent = S.me ? open.filter(i => i.assigned_to === S.me.id).length : 0;
  $('#sStale').textContent = open.filter(i => !i.first_response_at &&
    (Date.now() - new Date(i.created_at).getTime()) > 864e5).length;
  $('#cInbox').textContent = open.length;
}

$('#inboxRows').addEventListener('click', e => {
  const tr = e.target.closest('tr[data-id]');
  if (tr) openInquiry(tr.dataset.id);
});

/* ---------------- inquiry drawer ------------------------------------------ */

async function openInquiry(id) {
  const i = S.inquiries.find(x => x.id === id);
  if (!i) return;

  const { data: notes } = await sb.from('inquiry_notes')
    .select('*, author:profiles(id, full_name)')
    .eq('inquiry_id', id).order('created_at', { ascending: false });

  const jobs = S.jobs.filter(j => j.inquiry_id === id);
  const mayEdit = isAdmin() || (isSales() && (!i.assigned_to || i.assigned_to === S.me.id));
  const salesOpts = S.team.filter(p => p.is_active && ['sales', 'admin'].includes(p.role))
    .map(p => `<option value="${p.id}" ${p.id === i.assigned_to ? 'selected' : ''}>${esc(p.full_name || 'Unnamed')}</option>`).join('');

  const body = `
    <dl class="dl">
      <dt>Client</dt><dd><b>${esc(clientName(i.client))}</b></dd>
      <dt>Contact</dt><dd>${esc(i.client?.contact_name || '—')}</dd>
      <dt>Phone</dt><dd>${i.client?.phone
        ? `<a href="https://wa.me/${esc(i.client.phone.replace(/[^0-9]/g, ''))}" target="_blank" rel="noopener">${esc(i.client.phone)}</a>`
        : '—'}</dd>
      <dt>Email</dt><dd>${esc(i.client?.email || '—')}</dd>
      <dt>Wants</dt><dd>${esc(i.product_interest || '—')}${i.quantity_est ? ` · ${i.quantity_est} pcs` : ''}</dd>
      <dt>Came from</dt><dd>${esc(SOURCE_LABEL[i.source] || i.source)}</dd>
      <dt>Logged</dt><dd>${fmtWhen(i.created_at)}</dd>
    </dl>

    ${i.notes ? `<div class="card" style="margin:14px 0 0;background:#fffdf3"><b>First message</b><div style="margin-top:6px;white-space:pre-wrap">${esc(i.notes)}</div></div>` : ''}

    ${mayEdit ? `
    <div class="card" style="margin:14px 0 0">
      <div class="grid2">
        <div class="fld"><label>Status</label>
          <select id="dStatus">
            ${['new','assigned','contacted','qualified','quoted','won','lost','dormant']
              .map(s => `<option value="${s}" ${s === i.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="fld"><label>Salesperson</label>
          <select id="dAssign"><option value="">Unassigned</option>${salesOpts}</select>
        </div>
        <div class="fld"><label>Follow up on</label>
          <input type="date" id="dFollow" value="${i.next_follow_up || ''}">
        </div>
        <div class="fld" style="justify-content:flex-end">
          <button class="btn sm" id="dSave">Save changes</button>
        </div>
      </div>
      ${!i.first_response_at
        ? `<button class="btn sec sm" id="dReplied" style="margin-top:10px">Mark as replied to</button>`
        : `<p class="hint" style="margin:10px 0 0">First reply ${fmtWhen(i.first_response_at)}</p>`}
    </div>` : ''}

    <h3 style="margin:18px 0 6px;font-size:14px">Jobs from this inquiry</h3>
    ${jobs.length
      ? `<div>${jobs.map(j => `<div class="jcard" data-job="${j.id}" style="margin-bottom:8px">
           <div class="no">Job #${j.job_no}</div>
           <div class="ttl">${esc(j.product_title || 'Untitled')}</div>
           <div class="meta"><span class="chip">${j.quantity} pcs</span>
             <span class="chip">${esc(j.decoration_method)}</span>
             <span class="badge b-live">${esc(stageOf(j.stage).label)}</span></div>
         </div>`).join('')}</div>`
      : '<p class="hint">None yet.</p>'}

    ${canLog() ? `
    <div class="card" style="margin-top:12px">
      <h2>Start a job</h2>
      <div class="grid2">
        <div class="fld"><label>What is being made</label><input type="text" id="njTitle" placeholder="Safety vest — navy" value="${esc(i.product_interest || '')}"></div>
        <div class="fld"><label>Quantity</label><input type="number" id="njQty" min="1" value="${i.quantity_est || 1}"></div>
        <div class="fld"><label>Decoration</label>
          <select id="njMethod">
            <option value="printing">Printing (2 working days)</option>
            <option value="embroidery">Embroidery (3 working days)</option>
            <option value="none">Plain, no decoration</option>
          </select>
        </div>
        <div class="fld" style="justify-content:flex-end"><button class="btn sm" id="njAdd">Add job</button></div>
      </div>
    </div>` : ''}

    <h3 style="margin:18px 0 6px;font-size:14px">Notes</h3>
    <div class="fld"><textarea id="dNote" placeholder="What happened on this inquiry…"></textarea></div>
    <button class="btn sec sm" id="dAddNote" style="margin-top:8px">Add note</button>
    <ul class="timeline" style="margin-top:14px">
      ${(notes || []).map(n => `<li>
        <div>${esc(n.body)}</div>
        <div class="when">${esc(n.author?.full_name || 'Someone')} · ${fmtWhen(n.created_at)}</div>
      </li>`).join('') || '<li class="hint">No notes yet.</li>'}
    </ul>`;

  openDrawer(`Inquiry #${i.ref}`, body, '');

  const on = (sel, fn) => { const el = $(sel); if (el) el.addEventListener('click', fn); };

  on('#dSave', async () => {
    const patch = {
      status: $('#dStatus').value,
      assigned_to: $('#dAssign').value || null,
      next_follow_up: $('#dFollow').value || null
    };
    if (patch.assigned_to && patch.assigned_to !== i.assigned_to) patch.assigned_at = new Date().toISOString();
    const { error } = await sb.from('inquiries').update(patch).eq('id', i.id);
    if (error) return toast(error.message);
    toast('Saved');
    await loadInquiries();
    closeDrawer();
  });

  on('#dReplied', async () => {
    const { error } = await sb.from('inquiries')
      .update({ first_response_at: new Date().toISOString() }).eq('id', i.id);
    if (error) return toast(error.message);
    toast('Marked as replied');
    await loadInquiries();
    closeDrawer();
  });

  on('#dAddNote', async () => {
    const body = $('#dNote').value.trim();
    if (!body) return;
    const { error } = await sb.from('inquiry_notes')
      .insert({ inquiry_id: i.id, author_id: S.me.id, body });
    if (error) return toast(error.message);
    openInquiry(i.id);
  });

  on('#njAdd', async () => {
    const title = $('#njTitle').value.trim();
    if (!title) return toast('Give the job a name');
    const { error } = await sb.from('jobs').insert({
      inquiry_id: i.id,
      client_id: i.client_id,
      product_title: title,
      quantity: Number($('#njQty').value) || 1,
      decoration_method: $('#njMethod').value,
      stage: 'details',
      created_by: S.me.id
    });
    if (error) return toast(error.message);
    toast('Job added to the pipeline');
    await loadJobs();
    openInquiry(i.id);
  });

  $$('#drawerBody .jcard[data-job]').forEach(c =>
    c.addEventListener('click', () => openJob(c.dataset.job)));
}

/* ---------------- pipeline board ------------------------------------------ */

$('#qJobs').addEventListener('input', renderBoard);
$('#onlyMine').addEventListener('change', renderBoard);
$('#refreshJobs').addEventListener('click', async () => { await loadJobs(); toast('Refreshed'); });

function renderBoard() {
  const q = ($('#qJobs').value || '').toLowerCase().trim();
  const mineOnly = $('#onlyMine').checked;

  const list = S.jobs.filter(j => {
    if (mineOnly && stageOf(j.stage).role !== S.me.role && !isAdmin()) return false;
    if (!q) return true;
    return [j.product_title, j.client?.company_name, j.client?.contact_name, '#' + j.job_no]
      .join(' ').toLowerCase().includes(q);
  });

  const today = new Date().toISOString().slice(0, 10);

  $('#board').innerHTML = BOARD_STAGES.map(st => {
    const cards = list.filter(j => j.stage === st.id);
    return `<div class="col">
      <h3>${esc(st.label)}<em>${cards.length}</em></h3>
      <div class="slot">
        ${cards.map(j => {
          const late = j.due_date && j.due_date < today &&
            !['completed', 'invoiced'].includes(j.stage);
          const mine = st.role === S.me.role;
          return `<div class="jcard ${mine ? 'mine' : ''}" data-job="${j.id}">
            <div class="no">Job #${j.job_no}${j.inquiry ? ` · from #${j.inquiry.ref}` : ''}</div>
            <div class="ttl">${esc(j.product_title || 'Untitled')}</div>
            <div class="hint" style="margin-bottom:5px">${esc(clientName(j.client))}</div>
            <div class="meta">
              <span class="chip">${j.quantity} pcs</span>
              <span class="chip">${esc(j.decoration_method)}</span>
              ${j.due_date ? `<span class="${late ? 'overdue' : 'chip'}">due ${fmtDate(j.due_date)}</span>` : ''}
            </div>
          </div>`;
        }).join('') || '<p class="hint" style="padding:4px 2px">—</p>'}
      </div>
    </div>`;
  }).join('');

  const held = S.jobs.filter(j => ['on_hold', 'cancelled'].includes(j.stage)).length;
  $('#boardHint').textContent = held
    ? `${held} job(s) on hold or cancelled — search to find them.` : '';
  $('#cJobs').textContent = S.jobs.filter(j => !['completed', 'cancelled'].includes(j.stage)).length;

  $$('#board .jcard[data-job]').forEach(c =>
    c.addEventListener('click', () => openJob(c.dataset.job)));
}

async function openJob(id) {
  const j = S.jobs.find(x => x.id === id);
  if (!j) return;

  const { data: events } = await sb.from('job_events')
    .select('*, actor:profiles(id, full_name)')
    .eq('job_id', id).order('created_at', { ascending: false });

  const mayMove = canMove(j);
  const owner = stageOf(j.stage).role;

  const body = `
    <dl class="dl">
      <dt>Client</dt><dd><b>${esc(clientName(j.client))}</b></dd>
      <dt>Making</dt><dd>${esc(j.product_title || '—')}</dd>
      <dt>Quantity</dt><dd>${j.quantity} pcs</dd>
      <dt>Decoration</dt><dd>${esc(j.decoration_method)}</dd>
      <dt>Stage</dt><dd><span class="badge b-live">${esc(stageOf(j.stage).label)}</span></dd>
      <dt>Sits with</dt><dd>${owner ? esc(ROLE_LABEL[owner] || owner) : '—'}</dd>
      <dt>Due</dt><dd>${fmtDate(j.due_date)}</dd>
      <dt>Unit price</dt><dd>${money(j.unit_price)}</dd>
      <dt>Order value</dt><dd>${money(j.total_amount)}</dd>
      ${j.invoice_no ? `<dt>Invoice</dt><dd>${esc(j.invoice_no)}</dd>` : ''}
    </dl>

    ${mayMove ? `
    <div class="card" style="margin:14px 0 0">
      <h2>Move it on</h2>
      <div class="grid2">
        <div class="fld"><label>Stage</label>
          <select id="jStage">
            ${STAGES.map(s => `<option value="${s.id}" ${s.id === j.stage ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
          </select>
        </div>
        <div class="fld"><label>Due date</label><input type="date" id="jDue" value="${j.due_date || ''}"></div>
        <div class="fld"><label>Unit price (AED)</label><input type="number" step="0.01" id="jUnit" value="${j.unit_price ?? ''}"></div>
        <div class="fld"><label>Order value (AED)</label><input type="number" step="0.01" id="jTotal" value="${j.total_amount ?? ''}"></div>
        <div class="fld"><label>Mockup link</label><input type="text" id="jMockup" value="${esc(j.mockup_url)}" placeholder="https://…"></div>
        <div class="fld"><label>Invoice number</label><input type="text" id="jInv" value="${esc(j.invoice_no)}"></div>
      </div>
      <div class="fld" style="margin-top:10px"><label>Notes</label><textarea id="jNotes">${esc(j.notes)}</textarea></div>
      <button class="btn" id="jSave" style="margin-top:10px">Save</button>
      <p class="hint" style="margin:8px 0 0">
        Moving to printing or embroidery sets the due date automatically —
        2 working days for printing, 3 for embroidery.
      </p>
    </div>`
    : `<p class="hint" style="margin-top:14px">
         This job is with <b>${owner ? esc(ROLE_LABEL[owner] || owner) : 'nobody'}</b> right now,
         so only they or an admin can move it.
       </p>`}

    <h3 style="margin:18px 0 6px;font-size:14px">History</h3>
    <ul class="timeline">
      ${(events || []).map(ev => `<li>
        <div>${ev.from_stage
          ? `${esc(stageOf(ev.from_stage).label)} → <b>${esc(stageOf(ev.to_stage).label)}</b>`
          : `<b>${esc(ev.note || 'created')}</b>`}</div>
        <div class="when">${esc(ev.actor?.full_name || 'System')} · ${fmtWhen(ev.created_at)}</div>
      </li>`).join('') || '<li class="hint">Nothing yet.</li>'}
    </ul>`;

  openDrawer(`Job #${j.job_no}`, body, '');

  const saveBtn = $('#jSave');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const patch = {
      stage: $('#jStage').value,
      due_date: $('#jDue').value || null,
      unit_price: $('#jUnit').value === '' ? null : Number($('#jUnit').value),
      total_amount: $('#jTotal').value === '' ? null : Number($('#jTotal').value),
      mockup_url: $('#jMockup').value.trim(),
      invoice_no: $('#jInv').value.trim(),
      notes: $('#jNotes').value.trim()
    };
    const { error } = await sb.from('jobs').update(patch).eq('id', j.id);
    if (error) return toast(error.message);
    toast('Saved');
    await loadJobs();
    closeDrawer();
  });
}

/* ---------------- clients -------------------------------------------------- */

$('#qClients').addEventListener('input', renderClients);

function renderClients() {
  const q = ($('#qClients').value || '').toLowerCase().trim();
  const rows = S.clients.filter(c => !q ||
    [c.company_name, c.contact_name, c.phone, c.email].join(' ').toLowerCase().includes(q));

  $('#clientRows').innerHTML = rows.map(c => {
    const n = S.inquiries.filter(i => i.client_id === c.id).length;
    return `<tr data-client="${c.id}">
      <td><b>${esc(c.company_name || '—')}</b></td>
      <td>${esc(c.contact_name || '—')}</td>
      <td>${esc(c.phone || '—')}</td>
      <td>${esc(c.email || '—')}</td>
      <td>${n}</td>
    </tr>`;
  }).join('');
  $('#clientsEmpty').style.display = rows.length ? 'none' : 'block';
}

$('#clientRows').addEventListener('click', e => {
  const tr = e.target.closest('tr[data-client]');
  if (!tr) return;
  const c = S.clients.find(x => x.id === tr.dataset.client);
  if (!c) return;
  const theirs = S.inquiries.filter(i => i.client_id === c.id);
  openDrawer(clientName(c), `
    <dl class="dl">
      <dt>Company</dt><dd>${esc(c.company_name || '—')}</dd>
      <dt>Contact</dt><dd>${esc(c.contact_name || '—')}</dd>
      <dt>Phone</dt><dd>${esc(c.phone || '—')}</dd>
      <dt>Email</dt><dd>${esc(c.email || '—')}</dd>
      <dt>Added</dt><dd>${fmtWhen(c.created_at)}</dd>
    </dl>
    <h3 style="margin:18px 0 6px;font-size:14px">Their inquiries</h3>
    ${theirs.map(i => `<div class="jcard" style="margin-bottom:8px">
        <div class="no">#${i.ref} · ${fmtDate(i.created_at)}</div>
        <div class="ttl">${esc(i.product_interest || '—')}</div>
        <span class="badge ${STATUS_CLASS[i.status] || 'b-mute'}">${esc(i.status)}</span>
      </div>`).join('') || '<p class="hint">None.</p>'}`, '');
});

/* ---------------- team ------------------------------------------------------ */

async function callAdmin(payload) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Your session expired — sign in again.');

  const res = await fetch(`${CFG.url}/functions/v1/admin-create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': CFG.key,
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify(payload)
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'That did not work.');
  return out;
}

function renderTeam() {
  if (!isAdmin()) return;
  $('#teamRows').innerHTML = S.team.map(p => `<tr>
    <td><b>${esc(p.full_name || 'Unnamed')}</b><div class="hint">${esc(p.phone || '')}</div></td>
    <td>
      <select data-role-for="${p.id}" style="width:auto">
        ${Object.keys(ROLE_LABEL).map(r =>
          `<option value="${r}" ${r === p.role ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}
      </select>
    </td>
    <td><span class="badge ${p.is_active ? 'b-good' : 'b-mute'}">${p.is_active ? 'active' : 'off'}</span></td>
    <td>
      <button class="btn sec sm" data-toggle="${p.id}" data-next="${p.is_active ? 'off' : 'on'}">
        ${p.is_active ? 'Switch off' : 'Switch on'}
      </button>
      <button class="btn sec sm" data-pw="${p.id}">Set password</button>
    </td>
  </tr>`).join('');
}

$('#newUserForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, btn = $('#newUserBtn');
  btn.disabled = true; btn.textContent = 'Creating…';
  hide('#teamMsg');
  try {
    await callAdmin({
      action: 'create',
      email: f.email.value.trim(),
      password: f.password.value,
      full_name: f.full_name.value.trim(),
      phone: f.phone.value.trim(),
      role: f.role.value
    });
    say('#teamMsg', `${f.full_name.value.trim()} can now sign in.`, 'ok');
    f.reset();
    await loadTeam();
    fillPeopleSelects();
  } catch (err) {
    say('#teamMsg', err.message);
  }
  btn.disabled = false; btn.textContent = 'Create account';
});

$('#teamRows').addEventListener('change', async e => {
  const sel = e.target.closest('select[data-role-for]');
  if (!sel) return;
  try {
    await callAdmin({ action: 'set_role', id: sel.dataset.roleFor, role: sel.value });
    toast('Role updated');
    await loadTeam();
    fillPeopleSelects();
  } catch (err) { toast(err.message); await loadTeam(); }
});

$('#teamRows').addEventListener('click', async e => {
  const t = e.target.closest('button[data-toggle]');
  const p = e.target.closest('button[data-pw]');

  if (t) {
    try {
      await callAdmin({ action: 'set_active', id: t.dataset.toggle, is_active: t.dataset.next === 'on' });
      toast('Updated');
      await loadTeam();
    } catch (err) { toast(err.message); }
  }

  if (p) {
    const pw = prompt('New password for this team member (at least 8 characters):');
    if (!pw) return;
    try {
      await callAdmin({ action: 'password', id: p.dataset.pw, password: pw });
      toast('Password set');
    } catch (err) { toast(err.message); }
  }
});

/* ---------------- drawer plumbing ------------------------------------------ */

function openDrawer(title, bodyHtml, footHtml) {
  $('#drawerTitle').textContent = title;
  $('#drawerBody').innerHTML = bodyHtml;
  $('#drawerFoot').innerHTML = footHtml || '';
  $('#drawer').classList.add('on');
  $('#drawer').setAttribute('aria-hidden', 'false');
  $('#scrim').classList.add('on');
}
function closeDrawer() {
  $('#drawer').classList.remove('on');
  $('#drawer').setAttribute('aria-hidden', 'true');
  $('#scrim').classList.remove('on');
}
$('#drawerClose').addEventListener('click', closeDrawer);
$('#scrim').addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
