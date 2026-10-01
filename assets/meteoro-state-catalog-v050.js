(function(){
  'use strict';

  var REL='v0.5.2';
  var STATE_LIST=[
    ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','Distrito de Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawái'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Luisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Misisipi'],['MO','Misuri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','Nuevo Hampshire'],['NJ','Nueva Jersey'],['NM','Nuevo México'],['NY','Nueva York'],['NC','Carolina del Norte'],['ND','Dakota del Norte'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregón'],['PA','Pensilvania'],['RI','Rhode Island'],['SC','Carolina del Sur'],['SD','Dakota del Sur'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','Virginia Occidental'],['WI','Wisconsin'],['WY','Wyoming']
  ];
  var STATES={};STATE_LIST.forEach(function(x){STATES[x[0]]={code:x[0],name:x[1]};});

  /*
   * Only Florida is documented in the current Navigator checkout. The
   * remaining states are deliberately not inferred from Florida. Add a state
   * here only after its current product, rate and form evidence is loaded.
   */
  var MATRIX={
    FL:{code:'FL',name:'Florida',catalogStatus:'documented',products:{
      'sig-as':{sale:'unavailable',simulation:'unavailable',reason:'Accidente y Enfermedad fue retirado de la venta en Florida. Se conserva únicamente el brochure para consulta documental.'},
      'ss-as':{sale:'unavailable',simulation:'unavailable',reason:'Accidente y Enfermedad fue retirado de la venta en Florida. Se conserva únicamente el brochure para consulta documental.'}
    }}
  };
  var AS_IDS={'sig-as':true,'ss-as':true};
  function E(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])})}
  function code(v){
    var s=String(v||'').trim().toUpperCase();
    if(STATES[s])return s;
    var hit=STATE_LIST.filter(function(x){return x[1].toLowerCase()===String(v||'').trim().toLowerCase()})[0];
    return hit?hit[0]:'FL';
  }
  function label(v){return (STATES[code(v)]||STATES.FL).name}
  function info(v){var c=code(v);return MATRIX[c]||{code:c,name:label(c),catalogStatus:'pending',products:{}}}
  function productId(p){return p&&p.id==='ss-as'?'sig-as':p&&p.id||''}
  function isAS(p){return !!AS_IDS[productId(p)]}
  function stateFromCase(c){return code(c&&c.state||E('state')&&E('state').value||'FL')}
  function decision(p,c,mode){
    var i=info(stateFromCase(c)),id=productId(p),specific=i.products[id];
    if(i.catalogStatus!=='documented')return{status:'pending',reason:'No hay una matriz documental cargada para '+i.name+'. No se reutilizan precios ni reglas de Florida.',quoteRequired:true};
    if(specific&&specific[mode])return{status:specific[mode],reason:specific.reason||''};
    return{status:'available',reason:''};
  }
  function result(status,reason,extra){var r={status:status,reason:reason};if(extra)for(var k in extra)r[k]=extra[k];return r}
  function originalEvaluate(p){return p.__meteoroStateOriginalEvaluate||p.evaluate}
  function patchEvaluators(){
    var list=window.products||[],seen=[];
    list.forEach(function(p){
      if(!p||seen.indexOf(p)>=0)return;seen.push(p);
      if(p.__meteoroStateCatalogPatched)return;
      var original=p.evaluate;
      if(typeof original!=='function')return;
      p.__meteoroStateOriginalEvaluate=original;
      p.simulationEvaluate=function(c){
        var d=decision(p,c,'simulation'),state=stateFromCase(c);
        if(d.status==='unavailable')return result('no',d.reason,{stateAvailability:'unavailable'});
        if(d.status==='pending')return result('review',d.reason,{quoteRequired:true,stateAvailability:'pending'});
        if(isAS(p)&&state!=='FL')return result('review','A&S conserva la póliza para simulación, pero aún no hay tarifa/regla estatal cargada para '+label(state)+'. No se usa la tarifa de Florida.',{quoteRequired:true,stateAvailability:'pending'});
        return original.call(p,c);
      };
      p.evaluate=function(c){
        var d=decision(p,c,'sale'),state=stateFromCase(c);
        if(d.status==='unavailable')return result('no',d.reason,{stateAvailability:'unavailable',simulationOnly:true});
        if(d.status==='pending')return result('review',d.reason,{quoteRequired:true,stateAvailability:'pending'});
        return original.call(p,c);
      };
      p.__meteoroStateCatalogPatched=true;
    });
  }
  function saleAllowed(id,c){
    var p=(window.productsById||{})[id]||{id:id};return decision(p,c,'sale').status==='available';
  }
  function saleDecision(id){
    var p=(window.productsById||{})[id]||{id:id};
    return decision(p,{state:currentCode()},'sale');
  }
  function syncStateSelects(v){
    var c=code(v),a=[E('state'),E('stateTopSelect')];
    a.forEach(function(s){if(s&&s.value!==c)s.value=c;});
  }
  function buildSelect(s){
    if(!s)return;
    var c=code(s.value||'FL');
    s.innerHTML=STATE_LIST.map(function(x){return'<option value="'+x[0]+'"'+(x[0]===c?' selected':'')+'>'+esc(x[1])+'</option>'}).join('');
  }
  function clearUnavailableSelections(){
    var ids=window.selectedIds;
    if(ids&&typeof ids==='object'){
      Object.keys(ids).forEach(function(id){if(ids[id]&&!saleAllowed(id,{state:currentCode()}))delete ids[id];});
      window.selectedIds=ids;
    }
  }
  function currentCode(){return code(E('state')&&E('state').value||'FL')}
  function setBrand(){
    var c=currentCode(),n=label(c),i=info(c),brand=E('stateBrandLabel'),v=document.querySelector('.version');
    if(brand)brand.textContent=n+' · Modelo educativo e informativo independiente';
    document.title='Meteoro Smart Navigator – '+n+' '+REL;
    if(v)v.textContent=REL+' · catálogo por estado · Florida predeterminado';
    var st=E('stateStatus');
    if(st){
      if(c==='FL')st.innerHTML='<b>Florida seleccionado:</b> A&S ya no aparece para venta en Florida. Se conserva únicamente su brochure para consulta documental.';
      else st.innerHTML='<b>'+esc(n)+' seleccionado:</b> no hay todavía una matriz documental estatal cargada. No se habilita venta ni se reutilizan precios de Florida hasta incorporar brochure, formulario, reglas y tarifas vigentes.';
    }
    var deadline=E('asDeadline');
    if(deadline){deadline.className=c==='FL'?'callout danger-note':'callout warning';deadline.innerHTML=c==='FL'?'<b>Accidente y Enfermedad · Florida:</b> retirado de la venta. Solo se conserva su brochure para consulta documental.':'<b>Accidente y Enfermedad · '+esc(n)+':</b> estado seleccionado sin matriz estatal cargada. La póliza se conserva para configuración y no se aplica una tarifa de Florida.';}
    var unified=E('asUnifiedNotice');
    if(unified)unified.hidden=true;
  }
  function addStyle(){
    if(E('meteoroStateCatalogStyle'))return;
    var s=document.createElement('style');s.id='meteoroStateCatalogStyle';s.textContent='.state-session select{max-width:150px}.state-selector-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(190px,.8fr);gap:7px;align-items:center;margin:0 0 10px;padding:10px 11px;border:1px solid #cfe0ea;border-radius:12px;background:#f4fafe}.state-selector-card label{font-size:10px;font-weight:900;color:#0c3658}.state-selector-card select{min-height:34px;border:1px solid #b8ccd8;border-radius:9px;background:#fff;padding:6px 8px;font-weight:800;color:#173c55}.state-selector-card small{grid-column:1/-1;color:#5b6d78;font-size:9.5px;line-height:1.4}.state-only-hidden{display:none!important}.state-sim-note{margin:0 0 12px}.state-pending-card{border-color:#e6c66d!important;background:#fffaf0!important}@media(max-width:700px){.state-session{display:none}.state-selector-card{grid-template-columns:1fr}.state-selector-card small{grid-column:auto}}';document.head.appendChild(s);
  }
  function cardMatches(root,id){
    var p=(window.productsById||{})[id],needle=p&&String(p.name||'').split(' · ')[0];
    return Array.prototype.filter.call((root||document).querySelectorAll('.card.product'),function(card){
      var chk=card.querySelector('[data-id="'+id+'"]');if(chk)return true;
      var h=card.querySelector('h3');return !!(h&&needle&&h.textContent.indexOf(needle)>=0);
    });
  }
  function hideAsFromSales(){
    ['quoteGrid','productGrid'].forEach(function(id){cardMatches(E(id),'sig-as').forEach(function(card){card.classList.add('state-only-hidden');card.setAttribute('aria-hidden','true');});});
    var results=E('results');
    if(results)Array.prototype.forEach.call(results.querySelectorAll('.result'),function(card){
      var input=card.querySelector('[data-id="sig-as"],[data-id="ss-as"]');
      if(input){card.classList.add('state-only-hidden');card.setAttribute('aria-hidden','true');}
    });
  }
  function markSaleInputUnavailable(input){
    if(!input)return;
    var id=input.getAttribute('data-id'),d=saleDecision(id);
    input.disabled=true;input.checked=false;input.setAttribute('aria-disabled','true');input.title=d.reason||'La venta está pendiente de validación estatal.';
    var ids=window.selectedIds;if(ids&&id)delete ids[id];
    var labelNode=input.closest&&input.closest('label');
    if(labelNode&&!labelNode.querySelector('.state-sale-note')){
      var note=document.createElement('small');note.className='state-sale-note';note.style.display='block';note.style.marginTop='4px';note.style.color='#8a6500';note.textContent=d.reason||'Venta pendiente de validación estatal.';labelNode.appendChild(note);
    }
  }
  function decorateSaleInputs(){
    var current=currentCode();
    document.querySelectorAll('#quoteGrid .quote-select,#results .proposal-check').forEach(function(input){
      var id=input.getAttribute('data-id');
      if(!saleAllowed(id,{state:current}))markSaleInputUnavailable(input);
    });
  }
  function decoratePackages(){
    var pending=info(currentCode()).catalogStatus!=='documented';
    document.querySelectorAll('#packageGrid .package-card,#objectiveGrid .objective').forEach(function(card){
      var hasAs=/accidente y enfermedad|a\&s/i.test(card.textContent||'');
      if(hasAs&&currentCode()==='FL'){
        card.classList.add('state-only-hidden');card.setAttribute('aria-hidden','true');return;
      }
      if(pending){
        card.classList.add('state-pending-card');
        var b=card.querySelector('button');if(b)b.disabled=true;
        if(!card.querySelector('.state-sale-note')){var n=document.createElement('div');n.className='reason state-sale-note';n.textContent='No se puede iniciar una venta con este estado hasta cargar su matriz documental. No se reutilizan primas ni reglas de Florida.';card.appendChild(n);}
      }
    });
  }
  function decorateResults(){decorateSaleInputs();}
  function patchSimulator(){
    var current=window.simpleLayerAmount;
    if(typeof current!=='function'||current.__meteoroStateWrapped)return;
    var wrapped=function(p,ctx){
      if(currentCode()==='FL'&&isAS(p))return{amount:0,notes:['A&S: únicamente brochure de consulta en Florida.'],pending:[]};
      if(currentCode()!=='FL')return{amount:0,notes:['Estado '+label(currentCode())+' sin matriz de beneficios cargada. No se aplican reglas de Florida a esta simulación.'],pending:[]};
      return current.apply(this,arguments);
    };
    wrapped.__meteoroStateWrapped=true;window.simpleLayerAmount=wrapped;
  }
  function decorateSimulation(){
    var grid=E('simPolicyGrid'),fl=currentCode()==='FL';
    if(!grid)return;
    if(fl){
      var ids=window.simSelectedIds||{};delete ids['sig-as'];delete ids['ss-as'];window.simSelectedIds=ids;
      grid.querySelectorAll('.sim-policy').forEach(function(node){if(/accidente y enfermedad/i.test(node.textContent||''))node.remove()});
      var add=E('simExistingPolicyAdd');if(add)add.querySelectorAll('option[value="sig-as"],option[value="ss-as"]').forEach(function(o){o.remove()});
      if(window.updateSimulatorVisibility)window.updateSimulatorVisibility();
    }
    var controls=E('asQuantity');if(controls&&controls.parentElement)controls.parentElement.hidden=fl;
    document.querySelectorAll('[data-preset="1a"],[data-preset="1b"],[data-preset="1c"]').forEach(function(b){b.hidden=fl});
    var note=E('stateSimulatorNotice');
    if(note)note.innerHTML=fl?'Accidente y Enfermedad: únicamente brochure de consulta. Retirado del catálogo y del simulador de Florida.':'<b>'+esc(label(currentCode()))+' sin matriz estatal cargada.</b> No se aplican primas ni reglas de Florida.';
  }
  function addSimulationNotice(){
    var panel=E('simPanel');if(!panel||E('stateSimulatorNotice'))return;
    var first=panel.querySelector('.toolbar'),n=document.createElement('div');n.id='stateSimulatorNotice';n.className='callout state-sim-note';
    if(first)first.insertAdjacentElement('afterend',n);else panel.insertBefore(n,panel.firstChild);
  }
  function wrap(name,after){
    var current=window[name];if(typeof current!=='function'||current.__meteoroStateWrapped)return;
    var wrapped=function(){var r=current.apply(this,arguments);try{after()}catch(e){console.warn('Meteoro state decorator',name,e)}return r};wrapped.__meteoroStateWrapped=true;window[name]=wrapped;
  }
  function wrapRenders(){
    wrap('renderQuotes',function(){if(currentCode()==='FL')hideAsFromSales();decorateSaleInputs();});
    wrap('renderProducts',function(){if(currentCode()==='FL')hideAsFromSales();});
    wrap('renderPackages',decoratePackages);
    wrap('renderSimPolicySelector',decorateSimulation);
    wrap('renderExistingSimQuote',decorateSimulation);
    wrap('analyze',decorateResults);
  }
  function setState(v){
    var c=code(v);syncStateSelects(c);patchEvaluators();patchSimulator();clearUnavailableSelections();setBrand();
    if(window.renderQuotes)window.renderQuotes();
    if(window.renderProducts)window.renderProducts(E('familyFilter')&&E('familyFilter').value||'all');
    if(window.renderPackages)window.renderPackages();
    if(window.renderWellness)window.renderWellness();
    if(window.renderCommission)window.renderCommission();
    if(window.renderSimPolicySelector)window.renderSimPolicySelector();
    if(window.renderExistingSimQuote)window.renderExistingSimQuote();
    if(window.analyze)window.analyze();
    if(window.updateSelectedTotal)window.updateSelectedTotal();
    if(window.renderCindyCase)window.renderCindyCase();
    if(typeof window.logVisit==='function')window.logVisit('Cambiar estado',label(c));
  }
  function bind(){
    buildSelect(E('state'));buildSelect(E('stateTopSelect'));syncStateSelects(E('state')&&E('state').value||'FL');
    [E('state'),E('stateTopSelect')].forEach(function(s){if(s)s.addEventListener('change',function(){setState(this.value)})});
    addStyle();addSimulationNotice();patchEvaluators();patchSimulator();wrapRenders();setBrand();
    document.addEventListener('click',function(e){
      var add=e.target.closest&&e.target.closest('#addAsSimulationBtn'),remove=e.target.closest&&e.target.closest('#removeAsSimulationBtn');
      if(!add&&!remove)return;
      var ids=window.simSelectedIds||{};
      if(add)ids['sig-as']=true;else delete ids['sig-as'];
      window.simSelectedIds=ids;
      if(window.renderSimPolicySelector)window.renderSimPolicySelector();
      if(window.updateSimulatorVisibility)window.updateSimulatorVisibility();
      if(window.renderExistingSimQuote)window.renderExistingSimQuote();
    },true);
    setState(currentCode());
    decorateSimulation();
  }
  window.METEORO_STATE_CATALOG={version:REL,states:STATES,matrix:MATRIX,stateCode:currentCode,stateLabel:label,stateInfo:info,isSaleAvailable:function(id,c){return saleAllowed(id,c||{state:currentCode()})},isASProduct:isAS};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
