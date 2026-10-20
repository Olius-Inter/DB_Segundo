// Dados e comportamento separados; a página funciona sem servidor.
const MODEL = JSON.parse(OLIUS_MODEL_JSON);

// Utilitários, cores e estado da modelagem.
const $=id=>document.getElementById(id);
const T=MODEL.tables, F=MODEL.fks, NS='http://www.w3.org/2000/svg';
const colors= {
  cadastros:'#267092',planos:'#8062a9',financeiro:'#a36322',b2b:'#247765',b2c:'#287a9b',pontos:'#a35177'
};
const central=new Set(['users','establishment','subscription_cycle','billing_order','collection','point_calculation']);
let active='overview', selected='establishment', detailTab='fields', zoom=1, svg;
function esc(x) {
  return String(x).replace(/[&<>"']/g,c=>( {
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }
  [c]));
}
function el(tag,attrs= {
},text) {
  const n=document.createElementNS(NS,tag);
  for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);
  if(text!==undefined)n.textContent=text;
  return n;
}
function domain(id) {
  return MODEL.domains.find(d=>d.id===id);
}
function sceneFor(name) {
  return MODEL.scenes.find(s=>s.domain===T[name].domain&&s.nodes.includes(name))||MODEL.scenes.find(s=>s.nodes.includes(name));
}
function nav() {
  MODEL.scenes.forEach(s=> {
    const b=document.createElement('button');
    b.textContent=s.title;
    b.dataset.view=s.id;
    b.type='button';
    b.onclick=()=>show(s.id);
    $('views').append(b);
  });
}
function nodeSelect(name,jump=false) {
  selected=name;
  detailTab='fields';
  if(jump) {
    const s=sceneFor(name);
    show(s.id);
  }
  else {
    paintSelection();
    inspect();
  }
  $('selection').textContent=name+' · '+T[name].columns.length+' campos · '+T[name].fks.length+' FKs de saída.';
}
function link(name) {
  return '<button type="button" data-table="'+esc(name)+'">'+esc(name)+'</button>';
}
function bindLinks(root) {
  root.querySelectorAll('[data-table]').forEach(b=>b.onclick=()=> {
    if(uiMode==='journeys')openFlowTable(b.dataset.table);
    else nodeSelect(b.dataset.table,true);
  });
}
// Painel de campos, relacionamentos e regras da tabela selecionada.
function inspect() {
  const t=T[selected], d=domain(t.domain);
  let html='<div class="domain"><span class="domain-chip" style="background:'+colors[t.domain]+'"></span>'+esc(d.title)+'</div><h2>'+esc(t.name)+'</h2><p class="desc">'+esc(t.description)+'</p><div class="tabs" aria-label="Detalhes">';
  for(const[id,label]of[['fields','Campos'],['relations','Relacionamentos'],['rules','Regras']])html+='<button type="button" data-detail="'+id+'" aria-pressed="'+(detailTab===id)+'">'+label+'</button>';
  html+='</div>';
  if(detailTab==='fields') {
    html+='<p class="empty">Todos os '+t.columns.length+' campos · G = valor gerado</p>';
    t.columns.forEach(c=> {
      html+='<div class="field"><div class="field-top"><span class="field-name">'+esc(c.name)+'</span><span class="badges">'+(c.pk?'<span class="pk">PK</span> ':'')+(c.fk.length?'<span class="fk">FK</span> ':'')+(c.unique?'UQ ':'')+(c.generated?'G':'')+'</span></div><div class="field-type">'+esc(c.type)+' · <span class="nullable">'+(c.constantNonNull?'constante não nula':c.nullable?'aceita NULL':'não nulo')+'</span></div>'+(c.generated?'<div class="field-desc">Gerado: '+esc(c.generated)+'</div>':'')+(c.description?'<div class="field-desc">'+esc(c.description)+'</div>':'')+'</div>';
    });
  }
  if(detailTab==='relations') {
    const outgoing=F.filter(f=>f.child===selected), incoming=F.filter(f=>f.parent===selected);
    html+='<h3>Referências desta tabela ('+outgoing.length+')</h3>'+outgoing.map(f=>relationHTML(f)).join('');
    if(!outgoing.length)html+='<p class="empty">Nenhuma FK de saída.</p>';
    html+='<h3>Tabelas que a referenciam ('+incoming.length+')</h3>'+incoming.map(f=>relationHTML(f)).join('');
    if(!incoming.length)html+='<p class="empty">Nenhuma FK de entrada no escopo visual.</p>';
  }
  if(detailTab==='rules') {
    html+='<div class="rule"><b>Chave primária</b><br><code>('+esc(t.pk.join(', '))+')</code></div>';
    t.uniques.forEach(u=>html+='<div class="rule"><b>Unicidade</b><br><code>('+esc(u.columns.join(', '))+')</code><div class="constraint">'+esc(u.name)+'</div></div>');
    t.special.forEach(s=>html+='<div class="rule"><b>Restrição estrutural</b><br><code>'+esc(s)+'</code></div>');
    if(t.name==='establishment_subscription')html+='<p class="desc">Pode haver várias assinaturas ao longo do tempo. O índice parcial permite no máximo uma ACTIVE por estabelecimento.</p>';
    if(t.name==='subscription_cycle')html+='<p class="desc">EXCLUDE impede sobreposição de períodos por estabelecimento. [início, fim) admite que um ciclo comece exatamente quando outro termina.</p>';
    if(t.name==='point_calculation')html+='<p class="desc">Várias revisões são possíveis. Os índices parciais limitam a uma revisão is_current por coleta ou entrega.</p>';
    html+='<p class="empty">CHECKs e índices únicos parciais dos scripts 01–03 estão acima. Regras entre tabelas também dependem das rotinas e triggers; o diagrama não executa SQL.</p>';
  }
  $('inspector').innerHTML=html;
  decorateInspector();
  $('inspector').querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=> {
    detailTab=b.dataset.detail;
    inspect();
  });
  bindLinks($('inspector'));
}
function relationHTML(f) {
  return '<div class="relation"><div>'+link(f.child)+' → '+link(f.parent)+'</div><div class="mapping">('+esc(f.columns.join(', '))+')<br>→ ('+esc(f.references.join(', '))+')</div><div class="cardinality">Por linha de '+esc(f.child)+': <b>'+esc(f.parentCard)+'</b> '+esc(f.parent)+'<br>Por linha de '+esc(f.parent)+': <b>'+esc(f.childCard)+'</b> '+esc(f.child)+'</div><div class="constraint">'+esc(f.name)+'<br>'+esc(f.actions)+'</div></div>';
}
function showRelations(group) {
  $('inspector').innerHTML='<div class="domain">Relacionamento estrutural</div><h2>'+group.length+' FK'+(group.length>1?'s':'')+'</h2>'+group.map(relationHTML).join('');
  bindLinks($('inspector'));
  $('selection').textContent=group.map(f=>f.name).join(' · ');
  svg.querySelectorAll('.edge').forEach(g=>g.classList.toggle('edge-active',g.dataset.key===group[0].child+'|'+group[0].parent));
}
function paintSelection() {
  if(!svg)return;
  svg.querySelectorAll('[data-node]').forEach(n=>n.classList.toggle('node-selected',n.dataset.node===selected));
  svg.querySelectorAll('.edge').forEach(g=> {
    const touch=g.dataset.child===selected||g.dataset.parent===selected;
    g.classList.toggle('edge-active',touch);
    g.classList.remove('edge-dim');
  });
}
// Renderização SVG dos diagramas e suas conexões.
function createSVG(height,label) {
  svg=el('svg', {
    viewBox:'0 0 940 '+height,role:'img','aria-label':label
  });
  svg.append(el('title', {
  },label));
  const defs=el('defs');
  const marker=el('marker', {
    id:'arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'
  });
  marker.append(el('path', {
    d:'M 0 0 L 10 5 L 0 10 z',fill:'#7d919d'
  }));
  defs.append(marker);
  svg.append(defs);
  $('stage').replaceChildren(svg);
}
function drawNode(name,p,scene) {
  const t=T[name],g=el('g', {
    'data-node':name,class:'node-button',role:'button',tabindex:'0','aria-label':name+', consultar campos e relacionamentos'
  });
  g.onclick=()=>nodeSelect(name);
  g.onkeydown=e=> {
    if(e.key==='Enter'||e.key===' ') {
      e.preventDefault();
      nodeSelect(name);
    }
  };
  const context=t.domain!==scene.domain;
  g.append(el('rect', {
    x:p.x,y:p.y,width:p.w,height:p.h,rx:7,class:'node-box'+(context?' context':'')
  }));
  g.append(el('rect', {
    x:p.x,y:p.y,width:5,height:p.h,rx:2,fill:colors[t.domain]
  }));
  g.append(el('text', {
    x:p.x+16,y:p.y+26,class:'node-title'
  },name));
  if(context)g.append(el('text', {
    x:p.x+16,y:p.y+43,class:'node-context'
  },'CONTEXTO · '+domain(t.domain).title));
  else if(central.has(name))g.append(el('text', {
    x:p.x+16,y:p.y+43,class:'node-context'
  },'ENTIDADE CENTRAL'));
  g.append(el('line', {
    x1:p.x+1,y1:p.y+52,x2:p.x+p.w-1,y2:p.y+52,class:'node-divider'
  }));
  t.main.forEach((n,i)=> {
    const c=t.columns.find(c=>c.name===n),y=p.y+74+i*23;
    let badge=(c.pk?'PK':'')+(c.pk&&c.fk.length?'/':'')+(c.fk.length?'FK':'');
    g.append(el('text', {
      x:p.x+14,y,class:'node-badge',fill:c.pk?'#87600c':'#225fc2'
    },badge));
    g.append(el('text', {
      x:p.x+59,y,class:'node-field'
    },n));
  });
  const extra=t.columns.length-t.main.length;
  g.append(el('text', {
    x:p.x+16,y:p.y+p.h-13,class:'node-footer'
  },extra?'+'+extra+' campos · ficha completa ao selecionar':'Todos os campos principais'));
  svg.append(g);
}
function pathPoints(a,b,idx,total,sy,ty) {
  const same=a.col===b.col;
  let sx,tx,mx;
  const ratio=(idx+1)/(total+1);
  if(same) {
    sx=a.col===0?a.x:a.x+a.w;
    tx=b.col===0?b.x:b.x+b.w;
    mx=a.col===0?10+ratio*34:930-ratio*34;
  }
  else {
    sx=a.col===0?a.x+a.w:a.x;
    tx=b.col===0?b.x+b.w:b.x;
    mx=415+ratio*110;
  }
  return {
    d:`M ${sx} ${sy} H ${mx} V ${ty} H ${tx}`,sx,sy,tx,ty,mx,same
  };
}
function drawEdges(edges,positions,overview=false) {
  const grouped=new Map();
  edges.forEach(f=> {
    let key=f.child+'|'+f.parent;
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push(f);
  });
  const ports= {
  };
  const side=(a,b)=>a.col===b.col?(a.col===0?'L':'R'):(a.col===0?'R':'L');
  for(const[key,group]of grouped) {
    const f=group[0],a=positions[f.child],b=positions[f.parent];
    for(const[n,p,q]of[[f.child,a,b],[f.parent,b,a]]) {
      const k=n+side(p,q);
      if(!ports[k])ports[k]=[];
      ports[k].push(key);
    }
  }
  const port=(n,a,b,key)=> {
    const keys=ports[n+side(a,b)];
    return a.y+62+(a.h-93)*(keys.indexOf(key)+1)/(keys.length+1);
  };
  let idx=0;
  for(const[key,group]of grouped) {
    const f=group[0],a=positions[f.child],b=positions[f.parent];
    if(!a||!b)continue;
    const p=pathPoints(a,b,idx,grouped.size,port(f.child,a,b,key),port(f.parent,b,a,key)),g=el('g', {
      class:'edge','data-key':key,'data-child':f.child,'data-parent':f.parent
    });
    g.append(el('path', {
      d:p.d,class:'edge-path','marker-end':'url(#arrow)'
    }));
    if(!overview) {
      const sameParent=new Set(group.map(x=>x.parentCard)).size===1,sameChild=new Set(group.map(x=>x.childCard)).size===1;
      const sourceRight=p.sx>a.x,targetRight=p.tx>b.x;
      g.append(el('text', {
        x:p.sx+(sourceRight?7:-7),y:p.sy-7,'text-anchor':sourceRight?'start':'end',class:'edge-label'
      },sameChild?f.childCard:'ver FKs'));
      g.append(el('text', {
        x:p.tx+(targetRight?7:-7),y:p.ty-7,'text-anchor':targetRight?'start':'end',class:'edge-label'
      },sameParent?f.parentCard:'ver FKs'));
      if(group.length>1)g.append(el('text', {
        x:p.mx+5,y:(p.sy+p.ty)/2-7,class:'edge-label'
      },'×'+group.length));
    }
    else {
      g.append(el('text', {
        x:p.mx+6,y:(p.sy+p.ty)/2-8,class:'edge-label'
      },String(group.length)));
    }
    g.append(el('title', {
    },overview?f.child+' → '+f.parent:group.map(x=>x.name).join('\n')));
    const hit=el('path', {
      d:p.d,class:'edge-hit'
    });
    hit.onclick=()=> {
      if(!overview)showRelations(group);
    };
    g.append(hit);
    svg.append(g);
    idx++;
  }
}
function diagram(scene) {
  const pos= {
  };
  let y=40;
  for(let i=0;
  i<scene.nodes.length;
  i+=2) {
    let h=0;
    for(let j=0;
    j<2&&i+j<scene.nodes.length;
    j++) {
      const n=scene.nodes[i+j],nh=92+T[n].main.length*23;
      pos[n]= {
        x:j===0?55:545,y,w:340,h:nh,col:j
      };
      h=Math.max(h,nh);
    }
    y+=h+86;
  }
  createSVG(y-40,'Diagrama '+scene.title);
  drawEdges(scene.edges.map(n=>F.find(f=>f.name===n)),pos);
  scene.nodes.forEach(n=>drawNode(n,pos[n],scene));
  $('diagram-title').textContent=scene.title;
  $('diagram-caption').textContent='Campos principais · selecione uma tabela ou linha. FKs auxiliares e externas estão na ficha completa.';
}
function overview() {
  const pos= {
  };
  let y=45;
  for(let i=0;i<MODEL.domains.length;i+=2) {
    const row=MODEL.domains.slice(i,i+2);
    const height=Math.max(...row.map(d=>110+d.tables.length*23));
    row.forEach((d,col)=> { pos[d.id]={x:col?545:55,y,w:340,h:height,col}; });
    y+=height+80;
  }
  createSVG(y-35,'Visão geral dos domínios do OLIUS');
  const links=F.filter(f=>T[f.child].domain!==T[f.parent].domain).map(f=>( {
    ...f,child:T[f.child].domain,parent:T[f.parent].domain
  }));
  drawEdges(links,pos,true);
  MODEL.domains.forEach(d=> {
    const p=pos[d.id],g=el('g');
    g.append(el('rect', {
      x:p.x,y:p.y,width:p.w,height:p.h,rx:8,class:'node-box'
    }));
    g.append(el('rect', {
      x:p.x,y:p.y,width:5,height:p.h,fill:colors[d.id],rx:2
    }));
    g.append(el('text', {
      x:p.x+17,y:p.y+29,class:'domain-name'
    },d.title));
    g.append(el('text', {
      x:p.x+17,y:p.y+50,class:'domain-sub'
    },d.subtitle));
    g.append(el('line', {
      x1:p.x+1,y1:p.y+66,x2:p.x+p.w-1,y2:p.y+66,class:'node-divider'
    }));
    d.tables.forEach((name,i)=> {
      const row=el('g', {
        role:'button',tabindex:'0','aria-label':'Explorar '+name,style:'cursor:pointer'
      });
      row.append(el('text', {
        x:p.x+19,y:p.y+92+i*23,class:'overview-item'
      },name));
      row.onclick=()=>nodeSelect(name,true);
      row.onkeydown=e=> {
        if(e.key==='Enter'||e.key===' ') {
          e.preventDefault();
          nodeSelect(name,true);
        }
      };
      g.append(row);
    });
    svg.append(g);
  });
  $('diagram-title').textContent=Object.keys(T).length+' tabelas · '+MODEL.domains.length+' domínios';
  $('diagram-caption').textContent='Cada seta liga domínios com FKs reais; o número conta essas FKs. Selecione uma tabela para abrir seu diagrama.';
}
function show(id) {
  setSection(id==='overview'?'overview':'model');
  active=id;
  zoom=1;
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===id));
  if(id==='overview')overview();
  else {
    const scene=MODEL.scenes.find(s=>s.id===id);
    if(!scene.nodes.includes(selected))selected=scene.nodes.find(n=>T[n].domain===scene.domain);
    diagram(scene);
  }
  setZoom();
  paintSelection();
  inspect();
}
function setZoom() {
  svg.style.width=(zoom*100)+'%';
  $('zoom-label').textContent=Math.round(zoom*100)+'%';
  $('zoom-out').disabled=zoom<=.8;
  $('zoom-in').disabled=zoom>=2;
}
$('zoom-in').onclick=()=> {
  zoom=Math.min(2,zoom+.2);
  setZoom();
};
$('zoom-out').onclick=()=> {
  zoom=Math.max(.8,zoom-.2);
  setZoom();
};
$('zoom-reset').onclick=()=> {
  zoom=1;
  setZoom();
};
// Navegação e detalhes das jornadas de negócio.
const JOURNEYS=MODEL.journeys;
let uiMode='overview', currentJourney=JOURNEYS[0].id, currentStep=JOURNEYS[0].steps[0].id;
const journeyById=id=>JOURNEYS.find(j=>j.id===id);
const flowStep=()=>journeyById(currentJourney).steps.find(s=>s.id===currentStep);
function setSection(mode) {
  uiMode=mode;
  document.querySelectorAll('[data-section]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.section===mode));
  $('views').hidden=mode!=='model';
  $('journey-picker').hidden=mode!=='journeys';
  $('journey-intro').hidden=mode!=='journeys';
  document.querySelector('.tools').hidden=mode==='journeys';
  document.querySelector('.legend').hidden=mode==='journeys';
  $('stage').classList.toggle('flow-mode',mode==='journeys');
}
function initJourneys() {
  document.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=> {
    if(b.dataset.section==='journeys')showJourney(currentJourney,currentStep);
    else show(b.dataset.section==='overview'?'overview':(active==='overview'?'identidade':active));
  });
  const groups=[['B2B',['contratacao','coleta']],['B2C',['entrega']],['Compartilhado',['reembolso']],['Identidade',['administradores','autenticacao']]];
  $('journey-picker').innerHTML=groups.map(([label,ids])=>'<div class="journey-group"><span class="journey-group-label">'+esc(label)+'</span>'+ids.map(id=>'<button type="button" data-journey="'+id+'">'+esc(journeyById(id).title)+'</button>').join('')+'</div>').join('');
  $('journey-picker').querySelectorAll('[data-journey]').forEach(b=>b.onclick=()=>showJourney(b.dataset.journey));
}
function opClass(action) {
  return 'action-'+action.toLowerCase();
}
function flowTableLink(table) {
  return '<button type="button" class="table-link flow-table" data-flow-table="'+esc(table)+'">'+esc(table)+'</button>';
}
function branchHTML(b) {
  let action='';
  if(b.journey)action='<button type="button" class="tool" data-go-journey="'+b.journey+'">Abrir: '+esc(journeyById(b.journey).title)+'</button>';
  if(b.target)action='<button type="button" class="tool" data-go-step="'+b.target+'">Ver etapa relacionada</button>';
  return '<div class="flow-branch"><strong>'+esc(b.condition)+'</strong>'+esc(b.outcome)+action+'</div>';
}
function showJourney(id,stepId) {
  const j=journeyById(id);
  currentJourney=id;
  currentStep=stepId||j.steps[0].id;
  setSection('journeys');
  svg=null;
  $('journey-picker').querySelectorAll('[data-journey]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.journey===id));
  $('diagram-title').textContent=j.title;
  $('diagram-caption').textContent='Acompanhe as ações e suas tabelas. Selecione uma etapa para ver campos, regras e dependências.';
  $('journey-intro').innerHTML='<p><span class="tag">'+esc(j.profile)+'</span> '+esc(j.goal)+'</p><details><summary>Condições, resultado e fontes</summary><p><b>Antes de começar:</b> '+esc(j.prerequisite)+'</p><p><b>Resultado:</b> '+esc(j.outcome)+'</p><p><b>Recorte:</b> '+esc(j.scope)+'</p><p><b>Fontes:</b> '+esc(j.references)+'</p></details><p class="flow-global-note">Comportamento previsto pelas regras e pelos scripts; não comprova que as rotinas já foram implementadas. As setas abaixo indicam sequência de negócio, não FKs. As jornadas mostram os processos selecionados e suas tabelas.</p>';
  let html='<div class="flow-legend"><span class="action-consultar">Consultar · ler dados</span><span class="action-criar">Criar · novo registro</span><span class="action-atualizar">Atualizar · alterar registro existente</span></div><ol class="flow-list">';
  j.steps.forEach((s,i)=> {
    const actions=['Consultar','Criar','Atualizar'].filter(a=>s.operations.some(o=>o.action===a));
    html+='<li class="flow-item" data-flow-item="'+s.id+'"><article class="flow-card" style="--flow-color:'+colors[s.domain]+'"><button type="button" class="step-heading" data-step="'+s.id+'" aria-controls="inspector"><span class="step-number">'+(i+1)+'</span><span class="step-title">'+esc(s.title)+'</span></button><div class="step-meta"><span><span class="domain-chip" style="background:'+colors[s.domain]+'"></span>'+esc(domain(s.domain).title)+'</span><span>· '+esc(s.actor)+'</span></div><div class="flow-ops">';
    actions.forEach(a=> {
      const tables=[...new Set(s.operations.filter(o=>o.action===a).map(o=>o.table))];
      html+='<div class="flow-op-row"><span class="operation-label '+opClass(a)+'">'+a.toUpperCase()+'</span><span>'+tables.map(flowTableLink).join(' · ')+'</span></div>';
    });
    html+='</div><p class="flow-result">'+esc(s.result)+'</p>';
    if(s.branches.length)html+='<details class="flow-branches"><summary>'+s.branches.length+(s.branches.length>1?' decisões e desvios':' decisão ou desvio')+'</summary>'+s.branches.map(branchHTML).join('')+'</details>';
    html+='</article></li>';
  });
  html+='</ol>';
  $('stage').innerHTML=html;
  $('stage').querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>selectStep(b.dataset.step,true));
  $('stage').querySelectorAll('[data-flow-table]').forEach(b=>b.onclick=()=> {
    currentStep=b.closest('[data-flow-item]').dataset.flowItem;
    markStep();
    openFlowTable(b.dataset.flowTable);
  });
  bindFlowActions($('stage'));
  selectStep(currentStep);
}
function markStep() {
  $('stage').querySelectorAll('[data-flow-item]').forEach(n=> {
    if(n.dataset.flowItem===currentStep)n.setAttribute('aria-current','step');
    else n.removeAttribute('aria-current');
  });
  $('stage').querySelectorAll('[data-step]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.step===currentStep));
}
function selectStep(id,fromClick=false) {
  currentStep=id;
  markStep();
  const j=journeyById(currentJourney),s=flowStep(),i=j.steps.indexOf(s);
  let html='<div class="flow-status">ETAPA '+(i+1)+' DE '+j.steps.length+' · FLUXO PREVISTO</div><div class="domain">'+esc(domain(s.domain).title)+'</div><h2>'+esc(s.title)+'</h2><p class="desc">'+esc(s.actor)+'</p><p class="desc">'+esc(s.result)+'</p><h3>Tabelas e campos utilizados</h3>';
  s.operations.forEach(o=> {
    html+='<div class="flow-detail-op"><span class="operation-label '+opClass(o.action)+'">'+o.action.toUpperCase()+'</span> '+flowTableLink(o.table)+'<p>'+esc(o.why)+'</p><code>'+esc(o.fields.join(', '))+'</code></div>';
  });
  html+='<h3>O que sustenta a etapa</h3>'+s.rules.map(r=>'<div class="flow-rule">'+esc(r)+'</div>').join('')+'<h3>Responsabilidade das rotinas / backend</h3><p class="desc">'+esc(s.routine)+'</p>';
  if(s.transaction)html+='<div class="flow-transaction"><b>Consistência da operação</b><p>'+esc(s.transaction)+'</p></div>';
  if(s.branches.length)html+='<h3>Decisões e desvios</h3>'+s.branches.map(branchHTML).join('');
  html+='<p class="constraint">'+esc(j.references)+'</p><div class="flow-detail-nav">';
  if(i>0)html+='<button type="button" class="tool" data-go-step="'+j.steps[i-1].id+'">Etapa anterior</button>';
  if(i<j.steps.length-1)html+='<button type="button" class="tool" data-go-step="'+j.steps[i+1].id+'">Próxima etapa</button>';
  html+='</div>';
  $('inspector').innerHTML=html;
  $('inspector').scrollTop=0;
  $('inspector').querySelectorAll('[data-flow-table]').forEach(b=>b.onclick=()=>openFlowTable(b.dataset.flowTable));
  bindFlowActions($('inspector'));
  $('selection').textContent='Etapa '+(i+1)+' · '+s.title+' · '+[...new Set(s.operations.map(o=>o.table))].length+' tabelas. Os detalhes não executam alterações no banco.';
  if(fromClick&&window.innerWidth<=1100)$('inspector').scrollIntoView( {
    block:'start'
  });
}
function bindFlowActions(root) {
  root.querySelectorAll('[data-go-journey]').forEach(b=>b.onclick=()=>showJourney(b.dataset.goJourney));
  root.querySelectorAll('[data-go-step]').forEach(b=>b.onclick=()=> {
    selectStep(b.dataset.goStep);
    $('stage').querySelector('[data-flow-item="'+b.dataset.goStep+'"]').scrollIntoView( {
      block:'nearest'
    });
  });
}
function openFlowTable(name) {
  selected=name;
  detailTab='fields';
  inspect();
  $('inspector').scrollTop=0;
  if(window.innerWidth<=1100)$('inspector').scrollIntoView( {
    block:'start'
  });
}
function decorateInspector() {
  const inspector=$('inspector');
  if(uiMode==='journeys') {
    const back=document.createElement('button');
    back.type='button';
    back.className='tool back-step';
    back.textContent='← Voltar à etapa';
    back.dataset.backStep='';
    back.onclick=()=>selectStep(currentStep);
    inspector.prepend(back);
    const modelButton=document.createElement('button');
    modelButton.type='button';
    modelButton.className='tool';
    modelButton.textContent='Ver tabela no diagrama';
    modelButton.dataset.openModel=selected;
    modelButton.onclick=()=>nodeSelect(selected,true);
    inspector.append(modelButton);
  }
  const entries=JOURNEYS.map(j=>( {
    j,steps:j.steps.filter(s=>s.operations.some(o=>o.table===selected))
  })).filter(e=>e.steps.length);
  const box=document.createElement('div');
  box.className='related-journeys';
  box.innerHTML='<h3>Participa destas jornadas</h3>'+(entries.length?entries.map(( {
    j,steps
  })=>'<button type="button" class="table-link" data-related-journey="'+j.id+'" data-related-step="'+steps[0].id+'">'+esc(j.title)+' · '+steps.length+' etapa'+(steps.length>1?'s':'')+'</button>').join(''):'<p class="empty">Tabela ainda não utilizada nas jornadas deste recorte. Sua ficha estrutural continua disponível.</p>');
  inspector.append(box);
  box.querySelectorAll('[data-related-journey]').forEach(b=>b.onclick=()=>showJourney(b.dataset.relatedJourney,b.dataset.relatedStep));
}
// Inicialização da documentação e apresentação das fontes.
$('excluded').innerHTML=MODEL.excluded.map(e=>'<div>'+esc(e.name)+'<br><small>'+esc(e.reason)+'</small></div>').join('');
$('exclusion-title').textContent='Escopo: '+MODEL.source.table_count+' tabelas analisadas · '+Object.keys(T).length+' incluídas · '+MODEL.excluded.length+' excluídas';
$('provenance').textContent='Estrutura: 01_structure.sql · '+F.length+' FKs · SHA-256: '+MODEL.source.sha256+' · CHECKs e índices: scripts 02 e 03 · Fluxos: scripts 04 e 05 e decisões aprovadas · Sincronizado em '+MODEL.source.analyzed+'. Documentação de consulta; não executa SQL.';
nav();
initJourneys();
show('overview');