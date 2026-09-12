(function(){
  'use strict';

  function ready(fn){
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fn,{once:true});
    else fn();
  }

  ready(function(){
    var nav=document.querySelector('nav.tabs');
    var casePanel=document.getElementById('casePanel');
    if(!nav||!casePanel) return;

    // v0.4.2 · Navegación orientada primero a cotización.
    var order=[
      'casePanel','meteoroPanel','quotePanel','productsPanel','simPanel','cindyPanel',
      'manualCombinedPanel','directoryPanel','postSalePanel','portalsPanel','commissionPanel',
      'docsPanel','wellnessPanel','conditionPanel','signaturePanel','legalPanel','adminPanel'
    ];
    order.forEach(function(target){
      var btn=nav.querySelector('.tab[data-target="'+target+'"]');
      if(btn) nav.appendChild(btn);
    });
    var kiraNav=nav.querySelector('#kiraNavBtn');
    var cindyTab=nav.querySelector('.tab[data-target="cindyPanel"]');
    if(kiraNav&&cindyTab) cindyTab.insertAdjacentElement('afterend',kiraNav);

    var style=document.createElement('style');
    style.id='meteoroV042LayoutStyle';
    style.textContent='.case-sub-nav{display:flex;justify-content:flex-end;margin:0 0 8px}.case-sub-nav button{min-height:34px;padding:7px 10px}.case-hub-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}@media(max-width:620px){.case-hub-grid{grid-template-columns:1fr}}';
    document.head.appendChild(style);

    // Leads y Seguimientos dejan de ocupar pestañas principales, pero conservan toda su lógica existente.
    var leadsTab=nav.querySelector('.tab[data-target="leadsPanel"]');
    var followTab=nav.querySelector('.tab[data-target="followupsPanel"]');
    if(leadsTab) leadsTab.style.display='none';
    if(followTab) followTab.style.display='none';

    var caseGrid=casePanel.querySelector('.grid');
    var mount=document.getElementById('caseEmbeddedModules');
    if(!mount){
      mount=document.createElement('div');
      mount.id='caseEmbeddedModules';
      mount.style.marginTop='18px';
      if(caseGrid) caseGrid.insertAdjacentElement('afterend',mount);
      else casePanel.appendChild(mount);
    }

    var leadsPanel=document.getElementById('leadsPanel');
    var followPanel=document.getElementById('followupsPanel');
    [leadsPanel,followPanel].forEach(function(panel){
      if(panel){
        mount.appendChild(panel);
        panel.style.marginTop='16px';
        if(!panel.querySelector('.case-sub-nav')){
          var back=document.createElement('div');
          back.className='case-sub-nav';
          back.innerHTML='<button type="button" class="btn ghost">↑ OCULTAR Y VOLVER AL CASO</button>';
          panel.insertBefore(back,panel.firstChild);
          back.querySelector('button').addEventListener('click',function(){
            closeEmbedded();
            var a=document.getElementById('analyzeBtn');
            if(a) a.scrollIntoView({behavior:'smooth',block:'center'});
          });
        }
      }
    });

    function closeEmbedded(){
      if(leadsPanel){leadsPanel.classList.remove('active');leadsPanel.style.display='none';}
      if(followPanel){followPanel.classList.remove('active');followPanel.style.display='none';}
    }
    closeEmbedded();

    function openEmbedded(which){
      closeEmbedded();
      var hiddenTab=which==='leads'?leadsTab:followTab;
      var panel=which==='leads'?leadsPanel:followPanel;
      if(hiddenTab) hiddenTab.click();
      casePanel.classList.add('active');
      var caseTab=nav.querySelector('.tab[data-target="casePanel"]');
      if(caseTab){
        nav.querySelectorAll('.tab').forEach(function(b){b.classList.remove('active')});
        caseTab.classList.add('active');
      }
      if(panel){
        panel.classList.add('active');
        panel.style.display='block';
        setTimeout(function(){panel.scrollIntoView({behavior:'smooth',block:'start'});},40);
      }
    }

    var analyzeBtn=document.getElementById('analyzeBtn');
    var actionRow=analyzeBtn&&analyzeBtn.closest('.actions');
    if(actionRow&&!document.getElementById('caseQuickHub')){
      var hub=document.createElement('div');
      hub.id='caseQuickHub';
      hub.innerHTML='\
        <div style="margin-top:12px;padding:12px;border:1px solid #d8e1e8;border-radius:14px;background:#f8fbfc">\
          <div style="font-size:11px;font-weight:900;color:#46545f;margin-bottom:8px">GESTIÓN DEL CASO</div>\
          <div class="case-hub-grid">\
            <button type="button" id="openCaseLeads" class="btn secondary">📋 LEADS</button>\
            <button type="button" id="openCaseFollowups" class="btn secondary">🔔 CENTRO DE SEGUIMIENTO</button>\
          </div>\
          <div style="font-size:10px;color:#66737f;margin-top:7px;line-height:1.4">Leads y seguimientos permanecen dentro de Nuevo caso para agilizar cotización y gestión.</div>\
        </div>';
      actionRow.insertAdjacentElement('afterend',hub);
      document.getElementById('openCaseLeads').addEventListener('click',function(){openEmbedded('leads')});
      document.getElementById('openCaseFollowups').addEventListener('click',function(){openEmbedded('followups')});
      var badge=document.getElementById('followBadge');
      if(badge) document.getElementById('openCaseFollowups').appendChild(badge);
    }

    // Cindy y Kira viven en la navegación principal; no se generan accesos flotantes.

    // Pie legal solicitado por el propietario.
    var footer=document.querySelector('footer');
    if(footer){
      footer.innerHTML='<b>METEORO SMART NAVIGATOR</b> · Guía de entrenamiento personalizada y herramienta privada de apoyo. <b>Propietario: Carlos Barona.</b> © 2026 Carlos Barona. Todos los derechos reservados. Prohibida la copia, reproducción, distribución, venta, negociación, cesión o explotación comercial total o parcial sin autorización expresa de Carlos Barona. Los materiales oficiales de terceros pertenecen a sus respectivos titulares.';
    }

    // Identificación visible de la revisión sin alterar el motor, datos ni reglas existentes.
    document.title='Meteoro Smart Navigator – Florida v0.4.2';
    var version=document.querySelector('.version');
    if(version) version.textContent='v0.4.2 · PWA · Navigator · Cindy · Leads integrados';

    // Si una notificación abre ?open=followups, mantener la experiencia dentro de Nuevo caso.
    try{
      var params=new URLSearchParams(location.search);
      if(params.get('open')==='followups') setTimeout(function(){openEmbedded('followups')},250);
      if(params.get('open')==='leads') setTimeout(function(){openEmbedded('leads')},250);
    }catch(e){}

    // Cualquier pestaña principal cierra primero el submódulo incrustado.
    nav.querySelectorAll('.tab').forEach(function(btn){
      if(btn===leadsTab||btn===followTab) return;
      btn.addEventListener('click',function(){closeEmbedded();});
    });
  });
})();
