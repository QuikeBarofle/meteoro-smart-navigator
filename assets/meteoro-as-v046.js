(function(){'use strict';
var REL='v0.4.6';
function E(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function arr(v){return Array.isArray(v)?v:[]}

function patchAsProduct(){
  var ps=window.products||[], map=window.productsById||{}, as=map['sig-as'];
  if(!as)return;
  for(var i=ps.length-1;i>=0;i--){if(ps[i]&&ps[i].id==='ss-as')ps.splice(i,1)}
  map['ss-as']=as; // alias de compatibilidad: no crea una segunda tarjeta.
  as.family='Signature · iPad / Agent Connect';
  as.channel='📱 iPad + 🌐 Agent Connect · misma póliza';
  as.verified='Brochure FL Form 12950-FL + tarifa CEB 2025. Misma póliza en iPad y Agent Connect; cierre 25/09/2026 es regla operacional.';
  as.age='Adultos 18–64 · hijos: 23 años como regla operacional pendiente de confirmar en Rider 12954-FL';
  as.compositions='Individual · Pareja · Padre/Madre + hijos · Familiar';
  if(!as.__v046Notes){
    as.notes=arr(as.notes).concat([
      'Canales de venta: iPad y Agent Connect. Es una sola póliza; no se duplica en el Navigator.',
      'Acumulación máxima permitida en Meteoro: Choice. Equivalencias operativas: 2 Base = Standard; 4 Base = Choice; 2 Standard = Choice. Si ya existe Choice, no agregar Base, Standard ni otro Choice.',
      'Hijos: el brochure FL CI-ASHIP-LVB-FL-S_1224 menciona el Rider 12954-FL pero no publica la edad máxima ni un límite de cantidad. La guía operativa interna usa 23 años; hasta obtener el Rider 12954-FL, edades mayores de 23 se marcan REQUIERE REVISIÓN y no se rechazan automáticamente.',
      'Recuperación tras hospitalización: requiere internación cubierta. Meteoro modela mínimo 10 días y tope acumulado igual a los días de hospitalización cuando la internación supera 10 días. Puede modelar pagos parciales sin exceder el tope acumulado; la adjudicación final corresponde a Claims.'
    ]);
    var oldEval=as.evaluate;
    as.evaluate=function(c){
      var r=oldEval.call(as,c), kids=arr(c&&c.children), over23=kids.filter(function(a){return Number(a)>23});
      if(over23.length&&r.status!=='no'){
        if(r.status==='ok')r.status='review';
        r.reason=(r.reason||'')+' Hijo(s) de '+over23.join(', ')+' años: la guía operacional interna usa 23 años, pero el brochure de Florida no publica la edad máxima. Confirmar el Rider 12954-FL antes de determinar elegibilidad.';
      }
      if(kids.length)r.reason=(r.reason||'')+' El brochure cargado no establece un máximo de hijos; Meteoro no aplica una regla de “máximo 3” sin fuente contractual.';
      return r;
    };
    as.__v046Notes=true;
  }
}

function addAsChannelNotice(){
  var qp=E('quotePanel');if(!qp||E('asUnifiedNotice'))return;
  var toolbar=qp.querySelector('.toolbar'),n=document.createElement('div');
  n.id='asUnifiedNotice';n.className='callout';
  n.innerHTML='<b>ACCIDENTES Y ENFERMEDADES · UNA SOLA PÓLIZA</b><br>📱 Se puede vender en <b>iPad</b> y 🌐 <b>Agent Connect</b>. Meteoro la muestra una sola vez para evitar doble conteo. <b>Disponible para nuevas ventas en Florida hasta el 25 de septiembre de 2026</b> según la regla operacional cargada.';
  if(toolbar)toolbar.insertAdjacentElement('afterend',n);else qp.insertBefore(n,qp.firstChild);
}

function setAsOptions(s){
  if(!s)return;var val=String(s.value||'1');
  s.innerHTML='<option value="0.5">Base · 1 Base</option><option value="1">Standard · 1 Standard / 2 Base</option><option value="2">Choice · 1 Choice / 2 Standard / 4 Base</option>';
  if(['0.5','1','2'].indexOf(val)<0)val='1';s.value=val;
}
function decorateAsControls(){
  setAsOptions(E('asQuantity'));
  document.querySelectorAll('.quote-plan-control[data-field="asQuantity"]').forEach(function(s){
    setAsOptions(s);var box=s.closest('.quote-plan-box');if(!box)return;var note=box.querySelector('.quote-plan-note');
    if(note)note.innerHTML='<b>TOPE MÁXIMO: CHOICE.</b> 2 Base = Standard · 4 Base = Choice · 2 Standard = Choice. Si el cliente ya tiene Choice, no se puede sumar Standard, Base ni otro Choice.';
  });
}

function addChildSourceNotice(){
  var wrap=E('childrenWrap');if(!wrap||E('asChildSourceNotice'))return;
  var n=document.createElement('div');n.id='asChildSourceNotice';n.className='callout warning';n.style.marginTop='8px';
  n.innerHTML='<b>A&S · hijos:</b> la guía operativa interna usa <b>hasta 23 años</b>. El brochure FL vigente cargado menciona el Rider de Hijos 12954-FL, pero <b>no publica en el brochure la edad máxima ni un máximo de cantidad</b>. Por eso Meteoro no inventa “3 hijos” ni convierte automáticamente 24–26 años en NO ELEGIBLE; lo marca para revisión hasta confirmar el Rider 12954-FL. Los 5 campos visibles son capacidad actual de captura, no un límite contractual.';
  wrap.appendChild(n);
}

function addRecoveryPartialField(){
  if(E('eventAsRecoveryPaid'))return;
  var rec=E('eventRecoveryDays');if(!rec)return;var parent=rec.parentElement,box=parent&&parent.parentElement;if(!box)return;
  var d=document.createElement('div');d.id='eventAsRecoveryPaidWrap';d.innerHTML='<label>A&S · días de recuperación ya pagados</label><input id="eventAsRecoveryPaid" type="number" min="0" max="365" value="0"><small style="display:block;margin-top:4px;color:#66737f;font-size:9px">Úsalo para una reclamación parcial o una extensión posterior.</small>';
  parent.insertAdjacentElement('afterend',d);
  var sec=parent.closest('.sim-section');if(sec&&!E('asRecoveryRuleNotice')){
    var n=document.createElement('div');n.id='asRecoveryRuleNotice';n.className='callout';n.style.marginTop='9px';
    n.innerHTML='<b>A&S · recuperación después de hospitalización:</b> debe existir al menos 1 día de internación cubierta. Meteoro aplica un mínimo de 10 días de recuperación. Si la hospitalización fue mayor de 10 días, el máximo acumulado de recuperación es el número de días hospitalizados. Las extensiones médicas pueden modelarse como pagos parciales hasta alcanzar ese tope. <span style="color:#7d5a00">La opción de pago parcial es guía operativa; Claims determina el pago final.</span>';
    sec.appendChild(n);
  }
}

function patchAsRecovery(){
  if(typeof window.simpleLayerAmount!=='function'||window.simpleLayerAmount.__asV046)return;
  var old=window.simpleLayerAmount;
  function layer(p,ctx){
    if(!p||p.id!=='sig-as')return old(p,ctx);
    var amt=0,notes=[],pending=[];
    if(['accident','illness','hospital','cancer','critical'].indexOf(ctx.event)<0)return{amount:0,notes:['Evento fuera de la cobertura modelada de A&S.'],pending:pending};
    var m=Number(ctx.asMult)||1,lvl=m===2?'Choice':m===0.5?'Base':'Standard',personFactor=ctx.person==='child'?0.5:1,effective=m*personFactor;
    if(ctx.er)amt+=75*effective;
    amt+=(Number(ctx.hosp)||0)*100*effective+(Number(ctx.icu)||0)*650*effective;
    var recovery=Math.max(0,Number(ctx.recoveryDays)||0),hosp=Math.max(0,Number(ctx.hosp)||0),already=Math.max(0,Number(E('eventAsRecoveryPaid')&&E('eventAsRecoveryPaid').value)||0);
    if(recovery>0){
      if(hosp<=0){pending.push('A&S Recovery: requiere al menos 1 día de internación hospitalaria cubierta.');}
      else{
        var cap=Math.max(10,hosp),requested=Math.max(10,recovery),cumulative=Math.min(cap,requested),paid=Math.min(cap,already),newDays=Math.max(0,cumulative-paid);
        amt+=newDays*100*effective;
        notes.push('Recovery A&S: tope acumulado '+cap+' día(s); incapacidad/recuperación acumulada indicada '+recovery+' día(s); ya pagados '+paid+'; esta estimación agrega '+newDays+' día(s).');
        if(cumulative<requested)notes.push('Los días que exceden el tope derivado de la hospitalización no se suman.');
        if(already>0)notes.push('Pago parcial: se descuenta lo ya pagado y solo se calcula el saldo dentro del máximo acumulado.');
      }
    }
    if(ctx.outSurg&&ctx.outMonths>0){var am=Math.min(6,ctx.outMonths);amt+=am*1000*effective;notes.push('Recovery cirugía ambulatoria: '+am+' meses, sujeto a discapacidad total y demás requisitos del beneficio.');}
    notes.push(lvl+' modelado a '+m+'× Standard. '+(ctx.person==='child'?'Hijo: 50% del beneficio de titular/cónyuge.':'Titular/cónyuge: 100% del beneficio del nivel seleccionado.'));
    notes.push('Estructura máxima permitida en Meteoro: Choice. No se suma Base/Standard a un Choice ya existente ni se modelan dos Choice.');
    if(ctx.xray||ctx.mri||ctx.appliance||ctx.fracture)notes.push('A&S no suma radiografía, MRI, muletas o fractura como beneficios independientes en la tabla cargada.');
    return{amount:amt,notes:notes,pending:pending};
  }
  layer.__asV046=true;window.simpleLayerAmount=layer;
}

function brand(){document.title='Meteoro Smart Navigator – Florida '+REL;var v=document.querySelector('.version');if(v)v.textContent=REL+' · A&S unificada · recuperación parcial · multi-miembro'}
function refresh(){patchAsProduct();addAsChannelNotice();addChildSourceNotice();addRecoveryPartialField();patchAsRecovery();decorateAsControls();brand()}
function boot(){
  refresh();setTimeout(refresh,300);setTimeout(function(){
    if(typeof window.renderQuotes==='function')window.renderQuotes();
    if(typeof window.renderProducts==='function')window.renderProducts('all');
  },550);
  var q=E('quoteGrid');if(q&&window.MutationObserver)new MutationObserver(function(){decorateAsControls()}).observe(q,{childList:true,subtree:true});
  document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('.training-preset')){var x=E('eventAsRecoveryPaid');if(x)x.value='0'}},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
