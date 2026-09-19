import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
const ITERATIONS=180000;
const TERMS_VERSION='2026.09';
const RECOVERY_USERNAME='carlosebarona';
const RECOVERY_REDIRECT_URL='https://quikebarofle.github.io/meteoro-smart-navigator/?admin-recovery=1';
const RECOVERY_TTL_MS=30*60*1000;
const RECOVERY_PUBLIC_MESSAGE='Si la solicitud corresponde a la cuenta ADMIN, recibirás un enlace de recuperación. Revisa también la carpeta de correo no deseado.';
const ALL_ACA=['healthsherpa','oscar_broker','oscar_network','ambetter_broker','amerihealth_pharmacy','cuidadodesalud','united_jarvis','molina_pharmacy'];
const LEAD_STATUSES=['pending','followup','contacted','quoted','sale','lost','do_not_contact'];
const enc=new TextEncoder();

function cors(){return {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};}
function json(data:any,status=200){return new Response(JSON.stringify(data),{status,headers:cors()});}
function hex(buf:ArrayBuffer){return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function sha256(s:string){return hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));}
async function pbkdf2(value:string,salt:string,iterations=ITERATIONS){const key=await crypto.subtle.importKey('raw',enc.encode(value),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations,hash:'SHA-256'},key,256);return hex(bits);}
function randomToken(bytes=32){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join('');}
function randomSalt(){return randomToken(24);}
function bearer(req:Request){return (req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();}
function sleep(ms:number){return new Promise(resolve=>setTimeout(resolve,ms));}
function txt(v:any,max=300){return String(v??'').trim().slice(0,max);}
function obj(v:any){return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}
function num(v:any){const n=Number(v);return Number.isFinite(n)?n:null;}
function isoOrNull(v:any){if(!v)return null;const d=new Date(String(v));return Number.isNaN(d.getTime())?null:d.toISOString();}
function cleanAca(v:any){return Array.isArray(v)?v.map(String).filter((x:string)=>ALL_ACA.includes(x)):[];}
function normalizeProducts(raw:any){const x=obj(raw);return{combined:!!x.combined,manhattan:!!x.manhattan,sunhealth:!!x.sunhealth,aca:cleanAca(x.aca)};}
function normalizeTraining(raw:any){const x=obj(raw);return{combined:!!x.combined,manhattan:!!x.manhattan,sunhealth:!!x.sunhealth,aca:!!x.aca,general:!!x.general};}
function normalizeAssistants(raw:any){const x=obj(raw);return{cindy2:!!x.cindy2,kira_academy:!!x.kira_academy};}
function normalizePerms(raw:any){const x=obj(raw);const products=x.products?normalizeProducts(x.products):normalizeProducts(x);const training=x.training?normalizeTraining(x.training):normalizeTraining({});const assistants=x.assistants?normalizeAssistants(x.assistants):normalizeAssistants({});return{products,training,assistants};}
function adminPerms(){return{products:{combined:true,manhattan:true,sunhealth:true,aca:ALL_ACA},training:{combined:true,manhattan:true,sunhealth:true,aca:true,general:true},assistants:{cindy2:true,kira_academy:true}};}
function publicUser(u:any){return{id:u.id,username:u.username,display_name:u.display_name,role:u.role,status:u.status,must_change_password:false,terms_version:u.terms_version,terms_accepted_at:u.terms_accepted_at,permissions:u.role==='admin'?adminPerms():normalizePerms(u.permissions)};}
async function audit(user:any,event:string,detail=''){await db.from('meteoro_audit').insert({user_id:user?.id||null,username:user?.username||'unknown',event,detail});}
async function sessionUser(req:Request){const raw=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();if(!raw)return null;const tokenHash=await sha256(raw);const {data:s}=await db.from('meteoro_sessions').select('*').eq('token_hash',tokenHash).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle();if(!s)return null;const {data:u}=await db.from('meteoro_users').select('*').eq('id',s.user_id).maybeSingle();if(!u||u.status!=='active')return null;return u;}
async function fetchLeadForUser(user:any,id:string){let q=db.from('meteoro_leads').select('*').eq('id',id);if(user.role!=='admin')q=q.eq('owner_user_id',user.id);const {data}=await q.maybeSingle();return data||null;}
async function addLeadActivity(user:any,leadId:string,event:string,note='',followUp:any=null){await db.from('meteoro_lead_activity').insert({lead_id:leadId,user_id:user.id,username:user.username,event:txt(event,80),note:txt(note,2500),follow_up_at:isoOrNull(followUp)});}

async function authUserByEmail(email:string){
 const target=email.trim().toLowerCase();
 for(let page=1;page<=10;page++){
  const {data,error}=await db.auth.admin.listUsers({page,perPage:1000});
  if(error)throw error;
  const found=(data.users||[]).find((u:any)=>String(u.email||'').toLowerCase()===target);
  if(found)return found;
  if((data.users||[]).length<1000)break;
 }
 return null;
}

async function ensureAdminRecoveryIdentity(admin:any){
 const email=String(admin.recovery_email||'').trim().toLowerCase();
 if(!email)throw new Error('admin_recovery_email_missing');
 let authUser=await authUserByEmail(email);
 const appMetadata={...(authUser?.app_metadata||{}),meteoro_recovery:true,meteoro_username:RECOVERY_USERNAME};
 if(!authUser){
  const {data,error}=await db.auth.admin.createUser({email,password:randomToken(32)+'Aa1!',email_confirm:true,app_metadata:appMetadata});
  if(error)throw error;
  authUser=data.user;
 }else if(authUser.app_metadata?.meteoro_recovery!==true||authUser.app_metadata?.meteoro_username!==RECOVERY_USERNAME){
  const {data,error}=await db.auth.admin.updateUserById(authUser.id,{app_metadata:appMetadata});
  if(error)throw error;
  authUser=data.user;
 }
 return authUser;
}

function authFailureDetail(error:any){
 const code=txt(error?.code||error?.name||'provider_error',80);
 const status=Number(error?.status)||0;
 return status?code+' · HTTP '+status:code;
}

async function requestAdminRecovery(body:any){
 const started=Date.now();
 const identifier=String(body.identifier||'').trim().toLowerCase();
 let admin:any=null,requestId='';
 try{
  if(identifier===RECOVERY_USERNAME){
   const {data,error}=await db.from('meteoro_users').select('id,username,role,status,recovery_email').eq('username',RECOVERY_USERNAME).eq('role','admin').eq('status','active').maybeSingle();
   if(error)throw error;
   admin=data;
  }
  if(admin&&admin.recovery_email){
   const now=new Date(),nowIso=now.toISOString();
   const {data:last}=await db.from('meteoro_password_recovery').select('requested_at').eq('user_id',admin.id).order('requested_at',{ascending:false}).limit(1).maybeSingle();
   const tooSoon=last&&Date.now()-new Date(last.requested_at).getTime()<60000;
   if(!tooSoon){
    await db.from('meteoro_password_recovery').update({status:'expired',invalidated_at:nowIso}).eq('user_id',admin.id).in('status',['requested','email_sent']).lte('expires_at',nowIso);
    await db.from('meteoro_password_recovery').update({status:'superseded',invalidated_at:nowIso}).eq('user_id',admin.id).in('status',['requested','email_sent']).gt('expires_at',nowIso);
    const expiresAt=new Date(Date.now()+RECOVERY_TTL_MS).toISOString();
    const {data:requestRow,error:insertError}=await db.from('meteoro_password_recovery').insert({user_id:admin.id,status:'requested',expires_at:expiresAt}).select('id').single();
    if(insertError)throw insertError;
    requestId=requestRow.id;
    await audit(admin,'ADMIN_PASSWORD_RECOVERY_REQUESTED','Enlace solicitado · vigencia 30 minutos');
    const authUser=await ensureAdminRecoveryIdentity(admin);
    await db.from('meteoro_password_recovery').update({auth_user_id:authUser.id}).eq('id',requestId);
    const {error:sendError}=await db.auth.resetPasswordForEmail(String(admin.recovery_email),{redirectTo:RECOVERY_REDIRECT_URL});
    if(sendError){
     await db.from('meteoro_password_recovery').update({status:'email_failed',invalidated_at:new Date().toISOString()}).eq('id',requestId);
     await audit(admin,'ADMIN_PASSWORD_RECOVERY_EMAIL_FAILED',authFailureDetail(sendError));
    }else{
     await db.from('meteoro_password_recovery').update({status:'email_sent',email_sent_at:new Date().toISOString()}).eq('id',requestId);
     await audit(admin,'ADMIN_PASSWORD_RECOVERY_EMAIL_SENT','Enlace de un solo uso solicitado al proveedor de autenticación');
    }
   }
  }
 }catch(error){
  console.error('admin recovery request failed',error);
  if(requestId)await db.from('meteoro_password_recovery').update({status:'email_failed',invalidated_at:new Date().toISOString()}).eq('id',requestId);
  if(admin)await audit(admin,'ADMIN_PASSWORD_RECOVERY_EMAIL_FAILED',authFailureDetail(error));
 }
 const remaining=900-(Date.now()-started);if(remaining>0)await sleep(remaining);
 return json({ok:true,message:RECOVERY_PUBLIC_MESSAGE});
}

async function completeAdminRecovery(req:Request,body:any){
 const raw=bearer(req),next=String(body.new_password||'');
 const invalid='El enlace de recuperación es inválido o venció. Solicita uno nuevo.';
 if(!raw)return json({error:invalid},400);
 if(next.length<10||next.length>128)return json({error:'La nueva contraseña debe tener entre 10 y 128 caracteres.'},400);
 const {data:authData,error:authError}=await db.auth.getUser(raw);
 if(authError||!authData.user)return json({error:invalid},400);
 const {data:admin,error:adminError}=await db.from('meteoro_users').select('*').eq('username',RECOVERY_USERNAME).eq('role','admin').eq('status','active').maybeSingle();
 if(adminError)throw adminError;
 const authUser=authData.user;
 const emailMatches=String(authUser.email||'').toLowerCase()===String(admin?.recovery_email||'').toLowerCase();
 const identityMatches=authUser.app_metadata?.meteoro_recovery===true&&authUser.app_metadata?.meteoro_username===RECOVERY_USERNAME;
 if(!admin||!emailMatches||!identityMatches)return json({error:invalid},400);
 const nowIso=new Date().toISOString(),accessTokenHash=await sha256(raw);
 const {data:pending,error:pendingError}=await db.from('meteoro_password_recovery').select('id').eq('user_id',admin.id).eq('auth_user_id',authUser.id).eq('status','email_sent').gt('expires_at',nowIso).order('requested_at',{ascending:false}).limit(1).maybeSingle();
 if(pendingError)throw pendingError;
 if(!pending)return json({error:invalid},400);
 const {data:claimed,error:claimError}=await db.from('meteoro_password_recovery').update({status:'processing',used_at:nowIso,access_token_hash:accessTokenHash}).eq('id',pending.id).eq('status','email_sent').is('used_at',null).gt('expires_at',nowIso).select('id').maybeSingle();
 if(claimError||!claimed)return json({error:invalid},400);
 try{
  const salt=randomSalt(),hash=await pbkdf2(next,salt,ITERATIONS);
  const {error:updateError}=await db.from('meteoro_users').update({password_salt:salt,password_hash:hash,password_iterations:ITERATIONS,must_change_password:false,failed_login_count:0,locked_until:null,updated_at:new Date().toISOString()}).eq('id',admin.id);
  if(updateError)throw updateError;
  await db.from('meteoro_sessions').update({revoked_at:new Date().toISOString()}).eq('user_id',admin.id).is('revoked_at',null);
  await db.from('meteoro_password_recovery').update({status:'completed',completed_at:new Date().toISOString()}).eq('id',pending.id);
  await db.from('meteoro_password_recovery').update({status:'superseded',invalidated_at:new Date().toISOString()}).eq('user_id',admin.id).in('status',['requested','email_sent']).neq('id',pending.id);
  await audit(admin,'ADMIN_PASSWORD_RECOVERY_COMPLETED','Contraseña actualizada · sesiones Meteoro revocadas');
  await db.auth.admin.updateUserById(authUser.id,{password:randomToken(32)+'Aa1!',app_metadata:{...(authUser.app_metadata||{}),meteoro_recovery:true,meteoro_username:RECOVERY_USERNAME}});
  await db.auth.admin.signOut(raw,'global').catch(()=>{});
  return json({ok:true,message:'Contraseña actualizada. Ya puedes iniciar sesión.'});
 }catch(error){
  await db.from('meteoro_password_recovery').update({status:'failed',invalidated_at:new Date().toISOString()}).eq('id',pending.id);
  await audit(admin,'ADMIN_PASSWORD_RECOVERY_FAILED',authFailureDetail(error));
  throw error;
 }
}

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors()});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const body=await req.json().catch(()=>({}));
  const action=body.action||'';

  if(action==='request_admin_recovery')return await requestAdminRecovery(body);
  if(action==='complete_admin_recovery')return await completeAdminRecovery(req,body);

  if(action==='login'){
   const username=String(body.username||'').trim().toLowerCase();
   const secret=String(body.password||'');
   if(!username||!secret)return json({error:'Usuario y contraseña requeridos'},400);
   const {data:u}=await db.from('meteoro_users').select('*').eq('username',username).maybeSingle();
   if(!u)return json({error:'Credenciales incorrectas'},401);
   if(u.status!=='active'){await audit(u,'LOGIN_BLOCKED',u.status);return json({error:'Cuenta bloqueada. Contacta al administrador.'},403);}
   if(u.locked_until&&new Date(u.locked_until)>new Date())return json({error:'Cuenta temporalmente bloqueada'},429);
   const candidate=await pbkdf2(secret,u.password_salt,u.password_iterations||ITERATIONS);
   if(candidate!==u.password_hash){const failures=(u.failed_login_count||0)+1;const patch:any={failed_login_count:failures,updated_at:new Date().toISOString()};if(failures>=5){patch.failed_login_count=0;patch.locked_until=new Date(Date.now()+30000).toISOString();}await db.from('meteoro_users').update(patch).eq('id',u.id);await audit(u,'LOGIN_FAILED','');return json({error:'Credenciales incorrectas'},401);}
   const token=randomToken(32);const tokenHash=await sha256(token);const expires=new Date(Date.now()+12*60*60*1000).toISOString();
   await db.from('meteoro_sessions').insert({user_id:u.id,token_hash:tokenHash,expires_at:expires});
   await db.from('meteoro_users').update({failed_login_count:0,locked_until:null,last_login_at:new Date().toISOString(),login_count:(u.login_count||0)+1,updated_at:new Date().toISOString()}).eq('id',u.id);
   await audit(u,'LOGIN','');
   return json({token,expires_at:expires,user:publicUser(u),terms_required:u.terms_version!==TERMS_VERSION});
  }

  const user=await sessionUser(req);
  if(!user)return json({error:'Sesión inválida o expirada'},401);

  if(action==='logout'){const raw=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();if(raw){const th=await sha256(raw);await db.from('meteoro_sessions').update({revoked_at:new Date().toISOString()}).eq('token_hash',th);}await audit(user,'LOGOUT','');return json({ok:true});}
  if(action==='me')return json({user:publicUser(user),terms_required:user.terms_version!==TERMS_VERSION});
  if(action==='accept_terms'){await db.from('meteoro_users').update({terms_version:TERMS_VERSION,terms_accepted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',user.id);await audit(user,'ACCEPT_TERMS',TERMS_VERSION);return json({ok:true,version:TERMS_VERSION});}
  if(action==='change_password'){if(user.role!=='admin')return json({error:'La contraseña de acceso Meteoro solo puede ser cambiada por el administrador.'},403);const current=String(body.current_password||''),next=String(body.new_password||'');if(next.length<10)return json({error:'La nueva contraseña debe tener al menos 10 caracteres'},400);const cur=await pbkdf2(current,user.password_salt,user.password_iterations||ITERATIONS);if(cur!==user.password_hash)return json({error:'Contraseña actual incorrecta'},403);const salt=randomSalt(),hash=await pbkdf2(next,salt,ITERATIONS);await db.from('meteoro_users').update({password_salt:salt,password_hash:hash,password_iterations:ITERATIONS,must_change_password:false,updated_at:new Date().toISOString()}).eq('id',user.id);await db.from('meteoro_sessions').update({revoked_at:new Date().toISOString()}).eq('user_id',user.id).is('revoked_at',null);await audit(user,'CHANGE_PASSWORD','');return json({ok:true,relogin:true});}
  if(action==='log_event'){await audit(user,String(body.event||'ACTIVITY').slice(0,80),String(body.detail||'').slice(0,1000));return json({ok:true});}

  if(action==='list_leads'){
   let q=db.from('meteoro_leads').select('id,owner_user_id,owner_username,client_first_name,client_last_name,phone,email,annual_income,status,follow_up_at,last_contact_at,last_contact_method,contact_count,created_at,updated_at,quote_snapshot').order('updated_at',{ascending:false}).limit(1000);
   if(user.role!=='admin')q=q.eq('owner_user_id',user.id);
   const {data,error}=await q;if(error)throw error;return json({leads:data||[],scope:user.role==='admin'?'all':'own'});
  }
  if(action==='get_lead'){
   const id=txt(body.lead_id,80);const lead=await fetchLeadForUser(user,id);if(!lead)return json({error:'Lead no encontrado o sin autorización'},404);
   const {data:activity,error}=await db.from('meteoro_lead_activity').select('id,user_id,username,event,note,follow_up_at,created_at').eq('lead_id',id).order('created_at',{ascending:false}).limit(500);if(error)throw error;
   return json({lead,activity:activity||[]});
  }
  if(action==='create_lead'){
   const l=obj(body.lead);const first=txt(l.client_first_name,120),last=txt(l.client_last_name,120),phone=txt(l.phone,60),email=txt(l.email,180);
   if(!first&&!last&&!phone&&!email)return json({error:'Para guardar un lead registra al menos nombre, teléfono o email.'},400);
   const status=LEAD_STATUSES.includes(l.status)?l.status:'pending';
   const payload={owner_user_id:user.id,owner_username:user.username,client_first_name:first,client_last_name:last,phone,email,annual_income:num(l.annual_income),profile:obj(l.profile),qualification:obj(l.qualification),quote_snapshot:obj(l.quote_snapshot),status,follow_up_at:isoOrNull(l.follow_up_at),updated_at:new Date().toISOString()};
   const {data:lead,error}=await db.from('meteoro_leads').insert(payload).select('*').single();if(error)throw error;
   await addLeadActivity(user,lead.id,'LEAD_CREATED',txt(l.initial_note,2500),lead.follow_up_at);
   if(lead.follow_up_at)await addLeadActivity(user,lead.id,'FOLLOWUP_SCHEDULED','Seguimiento programado al crear el lead.',lead.follow_up_at);
   await audit(user,'LEAD_CREATED',lead.id+' · '+[first,last].filter(Boolean).join(' '));
   return json({lead});
  }
  if(action==='update_lead'){
   const id=txt(body.lead_id,80);const existing=await fetchLeadForUser(user,id);if(!existing)return json({error:'Lead no encontrado o sin autorización'},404);
   const l=obj(body.lead);const patch:any={updated_at:new Date().toISOString()};
   if('client_first_name'in l)patch.client_first_name=txt(l.client_first_name,120);if('client_last_name'in l)patch.client_last_name=txt(l.client_last_name,120);if('phone'in l)patch.phone=txt(l.phone,60);if('email'in l)patch.email=txt(l.email,180);if('annual_income'in l)patch.annual_income=num(l.annual_income);if('profile'in l)patch.profile=obj(l.profile);if('qualification'in l)patch.qualification=obj(l.qualification);if('quote_snapshot'in l)patch.quote_snapshot=obj(l.quote_snapshot);if('status'in l&&LEAD_STATUSES.includes(l.status))patch.status=l.status;if('follow_up_at'in l)patch.follow_up_at=isoOrNull(l.follow_up_at);
   const {data:lead,error}=await db.from('meteoro_leads').update(patch).eq('id',id).select('*').single();if(error)throw error;
   if('status'in patch&&patch.status!==existing.status)await addLeadActivity(user,id,'STATUS_CHANGED',existing.status+' → '+patch.status,lead.follow_up_at);
   const oldFU=existing.follow_up_at?new Date(existing.follow_up_at).toISOString():null;const newFU=lead.follow_up_at?new Date(lead.follow_up_at).toISOString():null;if('follow_up_at'in patch&&oldFU!==newFU)await addLeadActivity(user,id,'FOLLOWUP_SCHEDULED',newFU?'Nueva fecha de seguimiento.':'Seguimiento eliminado.',newFU);
   if(txt(body.note,2500))await addLeadActivity(user,id,'NOTE_ADDED',txt(body.note,2500),lead.follow_up_at);
   await audit(user,'LEAD_UPDATED',id);
   return json({lead});
  }
  if(action==='add_lead_note'){
   const id=txt(body.lead_id,80);const lead=await fetchLeadForUser(user,id);if(!lead)return json({error:'Lead no encontrado o sin autorización'},404);const note=txt(body.note,2500);if(!note)return json({error:'Escribe una nota'},400);await addLeadActivity(user,id,'NOTE_ADDED',note,lead.follow_up_at);await db.from('meteoro_leads').update({updated_at:new Date().toISOString()}).eq('id',id);return json({ok:true});
  }
  if(action==='log_lead_call'){
   const id=txt(body.lead_id,80);const lead=await fetchLeadForUser(user,id);if(!lead)return json({error:'Lead no encontrado o sin autorización'},404);const now=new Date().toISOString();const count=(lead.contact_count||0)+1;await db.from('meteoro_leads').update({last_contact_at:now,last_contact_method:'phone_from_meteoro',contact_count:count,updated_at:now}).eq('id',id);await addLeadActivity(user,id,'CALL_STARTED_FROM_METEORO','Se tocó el botón de llamada desde Meteoro. Esto registra el inicio de la llamada, no confirma que el cliente contestó.',lead.follow_up_at);await audit(user,'LEAD_CALL_STARTED',id);return json({ok:true,at:now,contact_count:count});
  }
  if(action==='mark_lead_contact'){
   const id=txt(body.lead_id,80);const lead=await fetchLeadForUser(user,id);if(!lead)return json({error:'Lead no encontrado o sin autorización'},404);const method=txt(body.method||'manual',50);const note=txt(body.note,2500);const now=new Date().toISOString();await db.from('meteoro_leads').update({last_contact_at:now,last_contact_method:method,status:'contacted',updated_at:now}).eq('id',id);await addLeadActivity(user,id,'CONTACT_CONFIRMED',note||('Contacto confirmado · '+method),lead.follow_up_at);await audit(user,'LEAD_CONTACT_CONFIRMED',id+' · '+method);return json({ok:true,at:now});
  }

  if(user.role!=='admin')return json({error:'Requiere administrador'},403);
  if(action==='list_users'){const {data}=await db.from('meteoro_users').select('id,username,display_name,role,status,must_change_password,terms_version,terms_accepted_at,created_at,last_login_at,login_count,updated_at,permissions').order('created_at');return json({users:(data||[]).map((u:any)=>({...u,permissions:u.role==='admin'?adminPerms():normalizePerms(u.permissions)}))});}
  if(action==='list_audit'){const {data}=await db.from('meteoro_audit').select('id,user_id,username,event,detail,created_at').order('created_at',{ascending:false}).limit(300);return json({audit:data||[]});}
  if(action==='create_user'){const username=String(body.username||'').trim().toLowerCase(),name=String(body.display_name||'').trim(),secret=String(body.password||''),role=String(body.role||'agent'),permissions=normalizePerms(body.permissions);if(!/^[a-z0-9._-]{3,40}$/.test(username))return json({error:'Usuario inválido'},400);if(!name||secret.length<10)return json({error:'Nombre y contraseña de al menos 10 caracteres son requeridos'},400);const salt=randomSalt(),hash=await pbkdf2(secret,salt,ITERATIONS);const {data:u,error}=await db.from('meteoro_users').insert({username,display_name:name,role,status:'active',password_salt:salt,password_hash:hash,password_iterations:ITERATIONS,must_change_password:false,permissions}).select('id,username,display_name,role,status,must_change_password,created_at,permissions').single();if(error)return json({error:error.message},400);await audit(user,'CREATE_USER',username+' · '+JSON.stringify(permissions));return json({user:{...u,permissions:normalizePerms(u.permissions)}});}
  if(action==='set_permissions'){const id=String(body.user_id||''),permissions=normalizePerms(body.permissions);const {data:target}=await db.from('meteoro_users').select('*').eq('id',id).maybeSingle();if(!target)return json({error:'Usuario no encontrado'},404);if(target.role==='admin')return json({error:'El administrador principal siempre tiene acceso total.'},400);await db.from('meteoro_users').update({permissions,updated_at:new Date().toISOString()}).eq('id',id);await audit(user,'SET_PERMISSIONS',target.username+' · '+JSON.stringify(permissions));return json({ok:true,permissions});}
  if(action==='set_status'){const id=String(body.user_id||''),status=String(body.status||'');if(!['active','suspended','revoked'].includes(status))return json({error:'Estado inválido'},400);const {data:target}=await db.from('meteoro_users').select('*').eq('id',id).maybeSingle();if(!target)return json({error:'Usuario no encontrado'},404);if(target.username==='carlosebarona'&&status!=='active')return json({error:'No puedes bloquear la cuenta administrativa principal desde aquí'},400);await db.from('meteoro_users').update({status,updated_at:new Date().toISOString()}).eq('id',id);if(status!=='active')await db.from('meteoro_sessions').update({revoked_at:new Date().toISOString()}).eq('user_id',id).is('revoked_at',null);await audit(user,'SET_USER_STATUS',target.username+' → '+status);return json({ok:true});}
  if(action==='admin_reset_password'){const id=String(body.user_id||''),secret=String(body.password||'');if(secret.length<10)return json({error:'Contraseña de al menos 10 caracteres'},400);const {data:target}=await db.from('meteoro_users').select('*').eq('id',id).maybeSingle();if(!target)return json({error:'Usuario no encontrado'},404);const salt=randomSalt(),hash=await pbkdf2(secret,salt,ITERATIONS);await db.from('meteoro_users').update({password_salt:salt,password_hash:hash,password_iterations:ITERATIONS,must_change_password:false,updated_at:new Date().toISOString()}).eq('id',id);await db.from('meteoro_sessions').update({revoked_at:new Date().toISOString()}).eq('user_id',id).is('revoked_at',null);await audit(user,'RESET_USER_PASSWORD',target.username);return json({ok:true});}

  return json({error:'Acción desconocida'},400);
 }catch(e){console.error(e);return json({error:'Error interno'},500);}
});
