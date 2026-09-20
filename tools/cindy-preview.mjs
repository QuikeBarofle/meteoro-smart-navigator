import { customerTurn, initialConversation, sensitiveMessage } from '../supabase/functions/meteoro-cindy/customer.mjs';
const el=id=>document.getElementById(id);
let state=initialConversation();
function bubble(who,text,kind='') {
  const node=document.createElement('div');node.className='bubble '+kind;
  const label=document.createElement('strong');label.textContent=who;
  node.append(label,document.createTextNode(text));el('messages').append(node);
  el('messages').scrollTop=el('messages').scrollHeight;
}
function reset() {
  state=initialConversation();el('messages').replaceChildren();el('message').value='';
  el('status').textContent='Asistente virtual · simulación';
  el('resultState').textContent='Conversación de demostración';
  bubble('CINDY',customerTurn('Hola',state).reply);
}
function run(text) {
  if(!text.trim())return;
  bubble('CLIENTE',sensitiveMessage(text)?'[Contenido sensible omitido de la demostración]':text,'client');
  const response=customerTurn(text,state);state=response.state;
  if(response.reply)bubble('CINDY',response.reply);
  else bubble('CONTROL',state.mode==='opted_out'?'La baja detiene las respuestas automáticas. No se enviaría otro mensaje.':'La conversación está reservada para atención humana. Cindy permanece en silencio.','notice');
  el('status').textContent=state.mode==='opted_out'?'Contacto detenido':state.mode==='human'?'Revisión humana':'Asistente virtual · simulación';
  el('resultState').textContent=response.human_review_required?'Requiere una persona. No se notificó a nadie.':state.mode==='opted_out'?'Baja respetada. Sin nuevos mensajes.':'Borrador de orientación. Sin envío.';
  el('message').value='';
}
el('chatForm').addEventListener('submit',event=>{event.preventDefault();run(el('message').value);});
el('reset').addEventListener('click',reset);
document.querySelectorAll('[data-sample]').forEach(button=>button.addEventListener('click',()=>{reset();run(button.dataset.sample);}));
reset();
