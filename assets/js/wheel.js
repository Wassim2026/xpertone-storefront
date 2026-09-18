(function () {
  'use strict';

  var CLAIM_KEY = 'xo_giveaway_claim_v1';
  var prizes = [
    { id:'orb', sku:'ORB', label:'Pack of 5 ORB Safety Vests', qty:5, sizes:['S','M','L','XL','2XL','3XL','5XL'], value:60 },
    { id:'suv', sku:'SUV', label:'Pack of 3 SUV Safety Vests', qty:3, sizes:['S','M','L','XL','2XL','3XL','4XL'], value:60 },
    { id:'dlm', sku:'DLM', label:'Pack of 2 DLM Safety Vests', qty:2, sizes:['S','M','L','XL','2XL','3XL'], value:50 },
    { id:'gloves', sku:'NEP', label:'1 Dozen Vaultex Work Gloves', qty:12, sizes:['M','L','XL'], value:48 }
  ];

  function claim() { try { return JSON.parse(localStorage.getItem(CLAIM_KEY) || 'null'); } catch (e) { return null; } }
  function sizeText(c) { return Object.keys(c.sizes || {}).filter(function(k){return c.sizes[k]>0;}).map(function(k){return k+' × '+c.sizes[k];}).join(', '); }
  window.Giveaway = { claim:claim, sizeText:sizeText, key:CLAIM_KEY };

  if (location.pathname.replace(/\/+$/,'') !== '/category/safety-vests' || claim()) return;

  function esc(s){return String(s).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];});}
  function pickPrize(){
    var n = Math.random() * 100;
    return n < 28 ? prizes[0] : n < 50 ? prizes[1] : n < 72 ? prizes[2] : prizes[3];
  }
  var selected = null;
  var overlay = document.createElement('div');
  overlay.className = 'xo-wheel-overlay';
  overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true'); overlay.setAttribute('aria-labelledby','xoWheelTitle');
  overlay.innerHTML = '<div class="xo-wheel-card"><div class="xo-wheel-grid" id="xoWheelIntro">' +
    '<div class="xo-wheel-copy"><div class="xo-wheel-kicker">Meta visitor giveaway</div><h2 id="xoWheelTitle">Spin & win free safety gear</h2>' +
    '<p>Every spin wins. Your gift is worth up to AED 60 and is yours with AED 100 of products plus AED 30 delivery.</p>' +
    '<p class="xo-wheel-terms">One gift per customer. UAE delivery only. Stock, colours and sizes are confirmed with our team.</p></div>' +
    '<div class="xo-wheel-stage"><div class="xo-wheel-pointer"></div><div class="xo-wheel-disc" id="xoDisc">' +
    '<span class="xo-wheel-label">5 ORB<br>Vests</span><span class="xo-wheel-label">3 SUV<br>Vests</span><span class="xo-wheel-label">2 DLM<br>Vests</span><span class="xo-wheel-label">12 Work<br>Gloves</span></div>' +
    '<button class="xo-wheel-spin" id="xoSpin" type="button">SPIN</button></div></div><div class="xo-wheel-panel xo-wheel-hidden" id="xoLead"></div></div>';
  document.body.appendChild(overlay); document.documentElement.classList.add('xo-wheel-lock');

  function renderLead(){
    var defaults = {}; defaults[selected.sizes.indexOf('L')>=0?'L':selected.sizes[0]] = selected.qty;
    document.getElementById('xoWheelIntro').classList.add('xo-wheel-hidden');
    var panel=document.getElementById('xoLead'); panel.classList.remove('xo-wheel-hidden');
    panel.innerHTML='<div class="xo-wheel-kicker">Congratulations</div><h2>You won!</h2><div class="xo-wheel-win">'+esc(selected.label)+'</div>'+
      '<p>Choose the size split, then add your contact details so we can reserve the gift and email our sales team.</p>'+
      '<form class="xo-wheel-form" id="xoLeadForm"><div><b>Sizes — total must equal '+selected.qty+'</b><div class="xo-wheel-sizes">'+selected.sizes.map(function(s){return '<label>'+s+'<input type="number" min="0" max="'+selected.qty+'" inputmode="numeric" name="size_'+esc(s)+'" value="'+(defaults[s]||0)+'"></label>';}).join('')+'</div></div>'+
      '<div class="xo-wheel-contact"><label>UAE mobile / WhatsApp<input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="05X XXX XXXX" required></label><label>Email address<input name="email" type="email" autocomplete="email" placeholder="name@company.com" required></label></div>'+
      '<label class="xo-wheel-consent"><input name="consent" type="checkbox" required><span>I agree that Xpertone Creative may contact me about this prize and relevant PPE offers. I can opt out at any time.</span></label>'+
      '<div class="xo-wheel-error" id="xoWheelError"></div><button class="xo-wheel-submit" type="submit"><i class="fa-solid fa-gift"></i> Reserve my free gift</button></form>';
    document.getElementById('xoLeadForm').addEventListener('submit',submitLead);
  }

  function submitLead(e){
    e.preventDefault(); var f=e.currentTarget, err=document.getElementById('xoWheelError');
    var email=f.email.value.trim(), phone=f.phone.value.trim(); var sizes={}, total=0;
    selected.sizes.forEach(function(s){var n=Math.max(0,parseInt(f.elements['size_'+s].value,10)||0);sizes[s]=n;total+=n;});
    var message='';
    if(total!==selected.qty) message='Please select exactly '+selected.qty+' item'+(selected.qty===1?'':'s')+' across the sizes.';
    else if(!/^\+?[0-9 ()-]{8,18}$/.test(phone)) message='Please enter a valid UAE mobile number.';
    else if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) message='Please enter a valid email address.';
    else if(!f.consent.checked) message='Please accept the contact consent to reserve the prize.';
    if(message){err.textContent=message;err.classList.add('is-on');return;}
    err.classList.remove('is-on'); var btn=f.querySelector('button');btn.disabled=true;btn.textContent='Reserving…';
    var record={prize:selected,sizes:sizes,phone:phone,email:email,consentAt:new Date().toISOString(),source:'Meta safety-vest landing page'};
    var fields={_subject:'Prize wheel lead — '+selected.sku+' — '+phone,_template:'table',_replyto:email,
      'PRIZE':selected.label,'SKU':selected.sku,'SIZE SPLIT':sizeText(record),'PHONE':phone,'EMAIL':email,
      'MARKETING CONSENT':'Yes — '+record.consentAt,'REDEMPTION RULE':'AED 100 paid products + AED 30 delivery','SOURCE':record.source};
    fetch((window.XO_CONFIG&&XO_CONFIG.EMAIL&&XO_CONFIG.EMAIL.endpoint)||'https://formsubmit.co/ajax/xpertonecreative@gmail.com',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(fields)})
      .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
      .then(function(){localStorage.setItem(CLAIM_KEY,JSON.stringify(record));showDone(record);})
      .catch(function(){btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-gift"></i> Reserve my free gift';err.textContent='We could not reserve the gift. Please check your connection and try again.';err.classList.add('is-on');});
  }

  function showDone(record){
    var panel=document.getElementById('xoLead');
    panel.innerHTML='<div class="xo-wheel-done"><i class="fa-solid fa-circle-check"></i><h2>Gift reserved</h2><p><b>'+esc(record.prize.label)+'</b><br>'+esc(sizeText(record))+'</p>'+
      '<p>Add AED 100 or more in products. Your free gift will appear at checkout, with AED 30 delivery.</p>'+
      '<button class="xo-wheel-notify" id="xoNotify" type="button"><i class="fa-solid fa-bell"></i> Enable prize notifications</button>'+
      '<a class="xo-wheel-shop" href="/shop.html"><i class="fa-solid fa-cart-shopping"></i> Shop products to redeem</a></div>';
    document.getElementById('xoNotify').addEventListener('click',enableNotifications);
  }

  function enableNotifications(){
    var btn=document.getElementById('xoNotify');
    if(!('Notification' in window)){btn.textContent='Notifications are not supported on this browser';btn.disabled=true;return;}
    Notification.requestPermission().then(function(permission){
      if(permission!=='granted'){btn.textContent='Notifications were not enabled';btn.disabled=true;return;}
      var title='Your Xpertone gift is reserved 🎁'; var opts={body:selected.label+' — add AED 100 in products to redeem. AED 30 delivery.',icon:'/assets/img/brand/favicon-32.png',tag:'xpertone-prize'};
      if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').then(function(reg){return reg.showNotification(title,opts);}).catch(function(){new Notification(title,opts);});}
      else new Notification(title,opts);
      btn.textContent='Prize notifications enabled';btn.disabled=true;
    });
  }

  document.getElementById('xoSpin').addEventListener('click',function(){
    var btn=this;btn.disabled=true;selected=pickPrize();var idx=prizes.indexOf(selected);var target=360*6+(360-idx*90-45);document.getElementById('xoDisc').style.transform='rotate('+target+'deg)';
    setTimeout(renderLead,4900);
  });
}());

