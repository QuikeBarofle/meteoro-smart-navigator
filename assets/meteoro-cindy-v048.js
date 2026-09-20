(function(){
'use strict';
function E(id){return document.getElementById(id)}
function safe(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
var admin=E('adminPanel');
if(!admin)return;
var box=document.createElement('div');box.className='card pad';box.style.marginTop='16px';
box.innerHTML='<h3>Cindy · Bandeja de WhatsApp</h3><p class="sub">Preparación sin envíos. Solo ADMIN puede revisar la bandeja y reservar una conversación para atención humana.</p><button type="button" class="btn secondary" id="cindyInboxRefresh">ACTUALIZAR BANDEJA</button><div id="cindyInboxStatus" role="status" class="sub" style="margin:12px 0">WhatsApp pendiente de conexión. No se ha seleccionado un número.</div><div id="cindyInboxMessages"></div>';
admin.appendChild(box);
async function api(action,extra){
  if(!window.currentAuthUser||window.currentAuthUser.role!=='admin')throw new Error('Acceso exclusivo de ADMIN');
  var base=window.CINDY_API_URL||'https://udpuaxzjxsvyocbvqjhz.supabase.co/functions/v1/meteoro-cindy';
  var result=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+window.currentAuthToken},body:JSON.stringify(Object.assign({action:action},extra||{}))});
  var json=await result.json();if(!result.ok)throw new Error(json.error||'Bandeja no disponible');return json;
}
async function refresh(){
  E('cindyInboxRefresh').disabled=true;E('cindyInboxStatus').textContent='Consultando bandeja privada';
  try{
    var data=await api('customer_inbox');
    // Discard a late response if the session changed while the request was pending.
    if(!window.currentAuthUser||window.currentAuthUser.role!=='admin'){E('cindyInboxMessages').replaceChildren();return}
    E('cindyInboxStatus').textContent=data.messages.length?'Borradores para revisión. Ningún mensaje se envía desde esta bandeja.':'Sin mensajes recibidos. Integración pendiente de conexión.';
    E('cindyInboxMessages').innerHTML=data.messages.map(function(m){var c=m.meteoro_whatsapp_conversations||{};return '<div style="border-top:1px solid #dce6ec;padding:12px 0"><b>'+safe(c.sender_id||'Cliente')+'</b> · '+safe(c.mode||'revisión')+'<p style="white-space:pre-wrap">'+safe(m.incoming_text)+'</p>'+(m.draft_reply?'<p style="white-space:pre-wrap"><b>Borrador:</b> '+safe(m.draft_reply)+'</p>':'')+'<button type="button" class="btn ghost" data-cindy-takeover="'+safe(m.conversation_id)+'">ASUMIR ATENCIÓN · SIN ENVIAR</button></div>'}).join('');
  }catch(error){E('cindyInboxStatus').textContent=error.message;E('cindyInboxMessages').replaceChildren()}
  finally{E('cindyInboxRefresh').disabled=false}
}
E('cindyInboxRefresh').addEventListener('click',refresh);
E('cindyInboxMessages').addEventListener('click',async function(event){
  var button=event.target.closest('[data-cindy-takeover]');if(!button)return;button.disabled=true;
  try{await api('customer_takeover',{conversation_id:button.getAttribute('data-cindy-takeover')});await refresh()}
  catch(error){E('cindyInboxStatus').textContent=error.message;button.disabled=false}
});
})();
