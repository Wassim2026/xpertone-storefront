/* T-shirt enquiry studio. All artwork stays in the visitor's browser. */
(function () {
'use strict';
var ranges = [{"slug":"cotton-polo","name":"Cotton Polo T-Shirts","price":30,"description":"Everyday teamwear, finished with your identity.","fabric":"Cotton","neck":"Polo"},{"slug":"dry-fit-polo","name":"Dry-Fit Polo T-Shirts","price":35,"description":"A performance-inspired look for busy teams.","fabric":"Dry-Fit","neck":"Polo"},{"slug":"cotton-round-neck","name":"Cotton Round-Neck T-Shirts","price":30,"description":"A clean crew-neck canvas for your brand.","fabric":"Cotton","neck":"Round-neck"},{"slug":"dry-fit-round-neck","name":"Dry-Fit Round-Neck T-Shirts","price":35,"description":"A sporty crew-neck style for teams and events.","fabric":"Dry-Fit","neck":"Round-neck"},{"slug":"custom-dual-colour","name":"Custom / Dual-Colour T-Shirts","price":40,"description":"Your colours. Your logo. A look that belongs to your team.","fabric":"Custom","neck":"Polo or round-neck"}];
var colours = [['Turquoise','#008fae'],['E. Green','#14804b'],['Red','#bb243a'],['Purple','#50366c'],['Black','#1b2024'],['Sky','#83b6e4'],['Maroon','#6b293f'],['Yellow','#f7d024'],['Royal','#214898'],['H-Grey','#b2b6b3'],['Ink Blue','#303d87'],['Orange','#e96622'],['Beige','#bca079'],['P. Green','#76a834'],['Dk. Navy','#202b35'],['M. Grey','#858b8c'],['M. Navy','#343f54'],['White','#f8f8f3'],['B. Green','#284b44'],['Charcoal','#464c51'],['Ash Grey','#c7cbc6'],['Brown','#605149'],['Dk. Grey','#60656b'],['K-Green','#168262']];
var sizes = ['S','M','L','XL','2XL','3XL','4XL','5XL'];
var chart=document.getElementById('teeColourChart');
if(chart) colours.forEach(function(c){var chip=document.createElement('div');chip.className='tee-colour-chip';var dot=document.createElement('i');dot.style.backgroundColor=c[1];chip.appendChild(dot);chip.appendChild(document.createTextNode(c[0]));chart.appendChild(chip);});
var form=document.getElementById('teeStudioForm');if(!form)return;
var range=document.getElementById('teeRange'),base=document.getElementById('teeBase'),accent=document.getElementById('teeAccent'),neck=document.getElementById('teeNeck'),layout=document.getElementById('teeLayout'),text=document.getElementById('teePrintText'),ink=document.getElementById('teeInk'),upload=document.getElementById('teeLogo');
var chosen=0,contrast=11,back=false,logoURL='',logoReady=false,uploadVersion=0;
ranges.forEach(function(r){var o=document.createElement('option');o.value=r.slug;o.textContent=r.name+' — AED '+r.price;range.appendChild(o);});
var initial=document.body.dataset.teeRange || 'custom-dual-colour';range.value=initial;
chosen=initial==='custom-dual-colour'?14:initial==='dry-fit-polo'?8:initial==='dry-fit-round-neck'?0:17;
if(chosen===17)ink.value='#102644';
sizes.forEach(function(s){var label=document.createElement('label');label.textContent=s;var input=document.createElement('input');input.type='number';input.min='0';input.max='10000';input.step='1';input.value='0';input.name=s;input.setAttribute('aria-label','Quantity size '+s);label.appendChild(input);document.getElementById('teeSizes').appendChild(label);});
function swatches(target,isAccent){colours.forEach(function(c,i){var b=document.createElement('button');b.type='button';b.className='tee-swatch';b.style.backgroundColor=c[1];b.title=c[0];b.setAttribute('aria-label',(isAccent?'Accent: ':'Base: ')+c[0]);b.setAttribute('aria-pressed','false');b.addEventListener('click',function(){if(isAccent)contrast=i;else chosen=i;update();});target.appendChild(b);});}
swatches(base,false);swatches(accent,true);
function selected(){return ranges.find(function(r){return r.slug===range.value;});}
function custom(){return selected().slug==='custom-dual-colour';}
function quantities(){return sizes.map(function(s){return {size:s,value:Number(form.elements[s].value)};});}
function validQuantities(){return quantities().every(function(q){return Number.isInteger(q.value)&&q.value>=0&&q.value<=10000;});}
function qty(){return quantities().reduce(function(sum,q){return sum+(Number.isFinite(q.value)?q.value:0);},0);}
function update(){
var r=selected(),isCustom=custom(),isRound=r.neck==='Round-neck'||(isCustom&&neck.value==='round');
document.getElementById('teeAccentField').hidden=!isCustom;document.getElementById('teeCustomOptions').hidden=!isCustom;
document.getElementById('teeBodyShape').setAttribute('fill',colours[chosen][1]);
document.querySelectorAll('[data-tee-accent]').forEach(function(el){el.setAttribute('fill',isCustom?colours[contrast][1]:colours[chosen][1]);});
document.getElementById('teePanels').setAttribute('visibility',isCustom&&layout.value==='panels'?'visible':'hidden');
document.getElementById('teeCollar').setAttribute('visibility',!isRound&&!back?'visible':'hidden');
document.getElementById('teeCrew').setAttribute('visibility',isRound||back?'visible':'hidden');
document.getElementById('teePlacket').setAttribute('visibility',!isRound&&!back?'visible':'hidden');
document.getElementById('teePrintGroup').setAttribute('transform',back?'translate(170 175) scale(1.3)':'translate(222 168) scale(.65)');
document.getElementById('teeSvgText').textContent=text.value.trim()||(logoReady?'':'YOUR LOGO');
document.getElementById('teeSvgText').setAttribute('fill',ink.value);
document.getElementById('teeSvgText').setAttribute('y',logoReady?'65':'10');
document.getElementById('teeSvgLogo').setAttribute('visibility',logoReady?'visible':'hidden');
document.getElementById('teeBaseName').textContent=colours[chosen][0];document.getElementById('teeAccentName').textContent=colours[contrast][0];
[base,accent].forEach(function(el,k){Array.from(el.children).forEach(function(b,i){b.setAttribute('aria-pressed',String(i===(k?contrast:chosen)));});});
document.getElementById('teeViewLabel').textContent=back?'Back preview':'Front preview';
document.getElementById('teeFront').setAttribute('aria-pressed',String(!back));document.getElementById('teeBack').setAttribute('aria-pressed',String(back));
var count=qty();document.getElementById('teeQuoteTotal').textContent=validQuantities()?'AED '+(count*r.price).toLocaleString('en-AE'):'Check quantities';
document.getElementById('teeQuoteRate').textContent='AED '+r.price+' per shirt · '+(validQuantities()?count:0)+' pieces · front & back logo print included';
document.getElementById('teeStatus').textContent='';
}
form.addEventListener('input',update);form.addEventListener('change',update);
document.getElementById('teeFront').addEventListener('click',function(){back=false;update();});
document.getElementById('teeBack').addEventListener('click',function(){back=true;update();});
document.querySelectorAll('[data-tee-preset]').forEach(function(b){b.addEventListener('click',function(){var v=b.dataset.teePreset.split(',');chosen=Number(v[0]);contrast=Number(v[1]);range.value='custom-dual-colour';update();});});
document.getElementById('teeClearLogo').addEventListener('click',function(){uploadVersion++;if(logoURL)URL.revokeObjectURL(logoURL);logoURL='';logoReady=false;upload.value='';document.getElementById('teeSvgLogo').removeAttribute('href');update();});
upload.addEventListener('change',function(){
var version=++uploadVersion;if(logoURL)URL.revokeObjectURL(logoURL);logoURL='';logoReady=false;update();
var file=upload.files[0];if(!file)return;
if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){upload.value='';document.getElementById('teeStatus').textContent='Choose a PNG, JPEG or WebP logo under 5 MB.';return;}
var url=URL.createObjectURL(file),img=new Image();logoURL=url;
img.onload=function(){if(version!==uploadVersion){URL.revokeObjectURL(url);return;}logoReady=true;document.getElementById('teeSvgLogo').setAttribute('href',url);update();};
img.onerror=function(){if(version!==uploadVersion)return;URL.revokeObjectURL(url);logoURL='';upload.value='';document.getElementById('teeStatus').textContent='This image could not be read. Please choose another logo.';};
img.src=url;
});
window.addEventListener('pagehide',function(){if(logoURL)URL.revokeObjectURL(logoURL);});
form.addEventListener('submit',function(e){
e.preventDefault();var status=document.getElementById('teeStatus');
if(!validQuantities()||qty()<1){status.textContent='Enter a whole-number quantity for at least one size.';return;}
var r=selected(),lines=['Hello Xpertone, I would like a T-shirt quotation.',r.name,'Price: AED '+r.price+' per shirt','Front & back logo print included','Base colour: '+colours[chosen][0]];
if(custom())lines.push('Accent: '+colours[contrast][0],'Neckline: '+neck.options[neck.selectedIndex].text,'Design: '+layout.options[layout.selectedIndex].text);
lines.push('Sizes: '+quantities().filter(function(q){return q.value>0;}).map(function(q){return q.size+': '+q.value;}).join(', '),'Total: '+qty()+' shirts / AED '+(qty()*r.price),'Logo text: '+(text.value.trim()||'Company logo'),'Please confirm fabric/colour availability, VAT, lead time and artwork proof.');
if(logoReady)lines.push('I previewed my logo locally and will attach the original file in this chat.');
lines.push('Reference: https://www.xpertonecreative.com/category/t-shirts/'+r.slug+'/');
var phone=(window.XO_CONFIG&&XO_CONFIG.COMPANY&&XO_CONFIG.COMPANY.whatsapp)||'971554712106';
var a=document.createElement('a');a.href='https://wa.me/'+phone+'?text='+encodeURIComponent(lines.join('\n'));a.target='_blank';a.rel='noopener noreferrer';a.click();status.textContent='Your enquiry opens in WhatsApp. Please attach your logo there; it is not uploaded automatically.';
});
update();
})();
