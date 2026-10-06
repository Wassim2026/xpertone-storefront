async function request(action,options={}){
  try{const response=await fetch('/api/'+action,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...options});return await response.json();}catch{return {data:null,error:{message:'Cannot reach the admin service. Please try again.'}};}
}
class Query{
  constructor(table){this.q={table,op:'select',filters:[]};}
  select(){return this;}
  order(field){this.q.order=field;return this;}
  range(from,to){Object.assign(this.q,{from,to});return this;}
  eq(field,value){this.q.filters.push({kind:'eq',field,value});return this;}
  in(field,value){this.q.filters.push({kind:'in',field,value});return this;}
  single(){this.q.single=true;return this;}
  update(values){Object.assign(this.q,{op:'update',values});return this;}
  insert(values){Object.assign(this.q,{op:'insert',values});return this;}
  delete(){this.q.op='delete';return this;}
  then(resolve,reject){return request('query',{method:'POST',body:JSON.stringify(this.q)}).then(resolve,reject);}
}
export function createAdminClient(){return{
  auth:{signInWithPassword:values=>request('session',{method:'POST',body:JSON.stringify(values)}),getUser:async()=>{const result=await request('session');return result.data?result:{data:{user:null},error:result.error};},signOut:()=>request('session',{method:'DELETE'})},
  from:table=>new Query(table),
  storage:{from:()=>({upload:async()=>({error:{message:'Direct image uploads are paused during recovery. Paste a Cloudflare image URL instead.'}}),remove:async()=>({data:[],error:null})})}
};}
