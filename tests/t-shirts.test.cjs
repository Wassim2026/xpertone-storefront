// Run from the repository root: node tests/t-shirts.test.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Element {
  constructor() { this.children=[]; this.attributes={}; this.events={}; this.style={}; this.value=''; this.textContent=''; this.files=[]; }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(k,v) { this.attributes[k]=v; }
  removeAttribute(k) { delete this.attributes[k]; }
  addEventListener(k,fn) { (this.events[k] ||= []).push(fn); }
  click() { if(this.href) sent.push(this.href); (this.events.click||[]).forEach(fn=>fn()); }
}
const ids = new Map();
const sent=[];
const get=id=>{ if(!ids.has(id))ids.set(id,new Element()); return ids.get(id); };
const form=get('teeStudioForm'); form.elements={};
const originalAppend=get('teeSizes').appendChild.bind(get('teeSizes'));
get('teeSizes').appendChild=label=>{const input=label.children[0];form.elements[input.name]=input;originalAppend(label);};
const document={
 body:{dataset:{teeRange:'custom-dual-colour'}},
 getElementById:get,
 createTextNode:text=>({textContent:text}),
 createElement:()=>new Element(),
 querySelectorAll:()=>[]
};
const context={document, window:{addEventListener(){},XO_CONFIG:{COMPANY:{whatsapp:'971554712106'}}},URL,Image:class{},console};
context.XO_CONFIG=context.window.XO_CONFIG;
get('teeInk').value='#ffffff';get('teeNeck').value='polo';get('teeLayout').value='panels';
get('teeNeck').options=[{text:'Polo'}];get('teeNeck').selectedIndex=0;
get('teeLayout').options=[{text:'Dual-colour side panels & trim'}];get('teeLayout').selectedIndex=0;
vm.runInNewContext(fs.readFileSync('assets/js/t-shirts.js','utf8'),context);
const update=()=>form.events.input.forEach(fn=>fn());
const submit=()=>form.events.submit[0]({preventDefault(){}});
assert.deepEqual(Object.keys(form.elements),['S','M','L','XL','2XL','3XL','4XL','5XL']);
assert.equal(get('teeBase').children.length,24);
submit();assert.match(get('teeStatus').textContent,/at least one/);assert.equal(sent.length,0);
form.elements.S.value='4';form.elements['5XL'].value='6';
for(const [range,price] of [['cotton-polo',30],['cotton-round-neck',30],['dry-fit-polo',35],['dry-fit-round-neck',35],['custom-dual-colour',40]]){
 get('teeRange').value=range;update();assert.equal(get('teeQuoteTotal').textContent,'AED '+price*10);
 submit();const u=new URL(sent.at(-1));assert.equal(u.hostname,'wa.me');assert.equal(u.pathname,'/971554712106');
 const message=u.searchParams.get('text');assert.match(message,/S: 4, 5XL: 6/);assert.ok(message.includes('AED '+price*10));assert.ok(message.includes('Front & back logo print included'));
}
form.elements.S.value='-1';update();assert.equal(get('teeQuoteTotal').textContent,'Check quantities');
const before=sent.length;submit();assert.equal(sent.length,before);
form.elements.S.value='1.5';update();submit();assert.equal(sent.length,before);
get('teePrintText').value='<script>alert(1)</script>';update();assert.equal(get('teeSvgText').textContent,'<script>alert(1)</script>');
console.log('PASS: 5 range prices, 8 ordered sizes, 24 colours, zero/negative/fractional validation, WhatsApp recipient/message and safe text rendering.');
