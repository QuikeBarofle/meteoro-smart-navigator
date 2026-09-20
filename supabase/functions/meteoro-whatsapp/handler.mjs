import { customerTurn, sensitiveMessage } from '../meteoro-cindy/customer.mjs';
const encoder = new TextEncoder();
const reply = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});
export async function validSignature(raw, signature, secret) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature || '')) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['verify']);
  const bytes = new Uint8Array(signature.slice(7).match(/../g).map(x => parseInt(x, 16)));
  return crypto.subtle.verify('HMAC', key, bytes, raw);
}
async function boundedBody(req) {
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 262144) { await reader.cancel(); throw new Error('body_too_large'); }
    chunks.push(value);
  }
  const out = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return out;
}
export function createWebhook({ config, receive, now = () => Date.now() }) {
  return async req => {
    // Fail closed. Merely deploying this code never connects a number.
    if (!config.receiveEnabled || !config.appSecret || !config.verifyToken || !config.phoneNumberId || !config.businessAccountId) {
      return reply({ connected:false, mode:'preparation', outbound_enabled:false },503);
    }
    if (req.method === 'GET') {
      const p = new URL(req.url).searchParams;
      if (p.get('hub.mode') !== 'subscribe' || p.get('hub.verify_token') !== config.verifyToken
        || !/^\d{1,100}$/.test(p.get('hub.challenge') || '')) return reply({error:'Invalid verification'},403);
      return new Response(p.get('hub.challenge'),{headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
    }
    if (req.method !== 'POST') return reply({error:'Method not allowed'},405);
    let raw;
    try { raw=await boundedBody(req); } catch { return reply({error:'Payload too large'},413); }
    if (!await validSignature(raw,req.headers.get('x-hub-signature-256'),config.appSecret)) return reply({error:'Invalid signature'},401);
    let body;
    try { body=JSON.parse(new TextDecoder().decode(raw)); } catch { return reply({error:'Invalid JSON'},400); }
    if (body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) return reply({error:'Invalid event'},400);
    let accepted=0;
    try {
      for (const entry of body.entry) {
        if (String(entry.id) !== config.businessAccountId) return reply({error:'Account mismatch'},403);
        if (!Array.isArray(entry.changes)) return reply({error:'Invalid changes'},400);
        for (const change of entry.changes) {
          if (change.field !== 'messages') continue;
          const value = change.value;
          if (String(value?.metadata?.phone_number_id) !== config.phoneNumberId) return reply({error:'Number mismatch'},403);
          if (value.messages !== undefined && !Array.isArray(value.messages)) return reply({error:'Invalid messages'},400);
          for (const message of value.messages || []) {
            const time=Number(message.timestamp)*1000;
            if (!message.id || String(message.id).length>300 || !/^\d{7,15}$/.test(message.from || '')
              || !Number.isFinite(time) || time<=0 || time>now()+300000) return reply({error:'Invalid message'},400);
            const text=message.type==='text' ? String(message.text?.body || '').slice(0,2500) : '';
            const preview=message.type==='text' ? customerTurn(text) : {
              state:{mode:'human'},reply:'',reason:'unsupported_media'
            };
            const sensitive=sensitiveMessage(text);
            // All arrivals require human review; no AI service, attachment download,
            // lead creation or outbound messaging is called from this receiver.
            const stored=await receive({p_phone_id:config.phoneNumberId,p_sender:message.from,
              p_message_id:String(message.id),p_inbound_at:new Date(time).toISOString(),
              p_text:sensitive?'[Contenido sensible omitido]':text || '[Contenido no textual; revisión humana]',
              p_reply:preview.reply,p_reason:preview.reason,p_mode:preview.state.mode});
            if (!stored?.duplicate) accepted++;
          }
        }
      }
      return reply({received:true,accepted,outbound_enabled:false});
    } catch { return reply({error:'Reception unavailable'},503); }
  };
}
