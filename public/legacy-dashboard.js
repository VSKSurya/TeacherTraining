
  const infoPopup=document.querySelector('#info-popup');
  let activeInfoButton=null;
  function showInfo(button){
    activeInfoButton=button;
    document.querySelector('#info-popup-title').textContent=button.dataset.infoTitle;
    document.querySelector('#info-popup-text').textContent=button.dataset.info;
    infoPopup.hidden=false;
    const rect=button.getBoundingClientRect();
    const popupRect=infoPopup.getBoundingClientRect();
    const left=Math.max(12,Math.min(rect.right-popupRect.width,window.innerWidth-popupRect.width-12));
    let top=rect.bottom+8;
    if(top+popupRect.height>window.innerHeight-12)top=rect.top-popupRect.height-8;
    infoPopup.style.left=`${left}px`;infoPopup.style.top=`${Math.max(12,top)}px`;
  }
  function hideInfo(button){if(activeInfoButton===button){infoPopup.hidden=true;activeInfoButton=null}}
  document.querySelectorAll('.info-button').forEach(button=>{
    button.addEventListener('mouseenter',()=>showInfo(button));
    button.addEventListener('mouseleave',()=>hideInfo(button));
    button.addEventListener('focus',()=>showInfo(button));
    button.addEventListener('blur',()=>hideInfo(button));
  });
  window.addEventListener('scroll',()=>{infoPopup.hidden=true;activeInfoButton=null},{passive:true});
  const toast = document.querySelector('#toast');
  let toastTimer;
  function showToast(text){toast.textContent=text;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2800)}

  document.querySelectorAll('.side-link').forEach(link=>link.addEventListener('click',()=>{
    document.querySelectorAll('.side-link').forEach(item=>{item.classList.remove('active');item.removeAttribute('aria-current')});
    link.classList.add('active');link.setAttribute('aria-current','page');
  }));

  document.querySelectorAll('.filter select').forEach(select=>select.addEventListener('change',()=>{
    const count=[...document.querySelectorAll('.filter select')].filter(item=>item.selectedIndex>0).length;
    const badge=document.querySelector('#filter-count');badge.textContent=count;badge.classList.toggle('visible',count>0);
    showToast(count ? `${count} filter${count===1?'':'s'} selected. This demo uses static sample data.` : 'Showing all sample dashboard data.');
  }));

  const filterTrigger=document.querySelector('#filter-trigger');
  const filterPopover=document.querySelector('#filter-popover');
  filterTrigger.addEventListener('click',()=>{
    const open=filterTrigger.getAttribute('aria-expanded')==='true';
    filterTrigger.setAttribute('aria-expanded',String(!open));filterPopover.classList.toggle('open',!open);
  });
  document.addEventListener('click',event=>{
    if(!event.target.closest('.filter-control')){filterTrigger.setAttribute('aria-expanded','false');filterPopover.classList.remove('open')}
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){filterTrigger.setAttribute('aria-expanded','false');filterPopover.classList.remove('open');filterTrigger.focus()}
  });
  document.querySelector('#clear-filters').addEventListener('click',()=>{
    document.querySelectorAll('.filter select').forEach(select=>{select.selectedIndex=0});
    const badge=document.querySelector('#filter-count');badge.textContent='0';badge.classList.remove('visible');showToast('Filters cleared.');
  });
  const batchStatusLabels={upcoming:'Upcoming',ongoing:'Ongoing',completed:'Completed'};
  const kgbvSchools=Array.isArray(window.KGBV_SCHOOLS)?window.KGBV_SCHOOLS:[];
  const batchPhases=['Orientation','Device & Content Use','Digital Skills','Refresher I','Refresher II'];
  const batchTrainers=['Asha Reddy','Ravi Kumar','Meera Nair','Suresh Rao','Kavitha Devi','Arun Das','Neha Sharma','Vikram Singh','Farah Khan','Joseph Mathew','Pooja Iyer','Mohan Das'];
  const batchData=Array.from({length:kgbvSchools.length},(_,index)=>{
    const status=index<180?'upcoming':index<400?'ongoing':'completed';
    const sourceSchool=kgbvSchools[index];
    const {state,district,block,school,udise,enrollment}=sourceSchool;
    const teacherParticipants=10,studentParticipants=enrollment,participants=teacherParticipants+studentParticipants;
    const attendance=status==='upcoming'?0:status==='ongoing'?65+(index*13%34):83+(index*11%18);
    const completion=status==='upcoming'?0:status==='ongoing'?15+(index*17%76):100;
    const day=(index%24)+1;
      const month=status==='upcoming'?'Nov':status==='ongoing'?'Oct':'Sep';
      const date=`${String(day).padStart(2,'0')}-${month}-2026`;
      return {index,id:`B-${String(1001+index).padStart(4,'0')}`,status,phaseNumber:index%batchPhases.length+1,phase:batchPhases[index%batchPhases.length],district,state,block,school,udise,location:`${district}, ${state}`,trainer:batchTrainers[index%batchTrainers.length],teacherParticipants,studentParticipants,participants,attendance,completion,attendedParticipants:Math.round(participants*attendance/100),completedParticipants:Math.round(participants*completion/100),date};
  });
  let selectedAudience=document.querySelector('.audience-button[aria-pressed="true"]')?.dataset.audience||'Student';
  const currentPhaseCard=document.querySelector('.phase-card.current');
  let selectedPhase=selectedAudience==='Teacher'&&currentPhaseCard?Number(currentPhaseCard.querySelector('.phase-number').textContent.match(/\d+/)?.[0])||null:null;
  document.querySelectorAll('.phase-card, .student-module-card').forEach(card=>{
    const isCurrent=selectedAudience==='Teacher'&&card===currentPhaseCard;
    card.classList.toggle('selected',isCurrent);
    card.setAttribute('aria-pressed',String(isCurrent));
  });
  const studentModuleNames=['Cyber Safety and Digital Responsibility','Digital Creativity','AI Awareness'];
  const selectedPhaseLabel=()=>selectedPhase?(selectedAudience==='Student'?studentModuleNames[selectedPhase-1]:`Phase ${selectedPhase}: ${batchPhases[selectedPhase-1]}`):'';
  const dashboardBatches=()=>selectedPhase?batchData.filter(batch=>batch.phaseNumber===selectedPhase):batchData;
  const audienceSize=(batch,audience=selectedAudience)=>audience==='Teacher'?batch.teacherParticipants:batch.studentParticipants;
  function audienceMetrics(batch,audience=selectedAudience){
    const planned=audienceSize(batch,audience),registered=batch.status==='upcoming'?Math.round(planned*(audience==='Teacher'?.95:.91)):planned;
    const attendanceRate=batch.status==='upcoming'?0:Math.max(0,Math.min(100,batch.attendance+(audience==='Teacher'?2:-2)));
    const completionRate=batch.status==='upcoming'?0:batch.status==='completed'?100:Math.max(0,Math.min(100,batch.completion+(audience==='Teacher'?2:-2)));
    const attended=Math.min(registered,Math.round(planned*attendanceRate/100));
    const completed=Math.round(planned*completionRate/100);
    return {planned,registered,approved:Math.round(registered*.97),attended,completed,certified:Math.round(completed*.92),attendanceRate,completionRate};
  }
  const batchModalLayer=document.querySelector('#batch-modal-layer');
  const participantModalLayer=document.querySelector('#participant-modal-layer');
  const batchModalList=document.querySelector('#batch-modal-list');
  const participantList=document.querySelector('#participant-list');
  const batchPageSize=24;
  let activeBatchStatus='upcoming',batchPage=1,activeStatusTrigger=null,activeBatchTrigger=null,selectedBatch=null;
  function renderBatchStatusTotals(){
    const batchesInView=dashboardBatches();
    const phaseContext=selectedPhase?` for ${selectedPhaseLabel()}`:'';
    const totals=batchesInView.reduce((sum,batch)=>{const m=audienceMetrics(batch);for(const key of Object.keys(sum))sum[key]+=m[key];return sum},{planned:0,registered:0,approved:0,attended:0,completed:0,certified:0});
    const totalParticipants=totals.planned,totalAttended=totals.attended,totalCompleted=totals.completed;
    const completionPercent=totalParticipants?totalCompleted/totalParticipants*100:0;
    const attendancePercent=totals.registered?totalAttended/totals.registered*100:0;
    const batchStatusSummaries={};
    for(const status of Object.keys(batchStatusLabels)){
      const matchingBatches=batchesInView.filter(batch=>batch.status===status);
      const participantCount=matchingBatches.reduce((sum,batch)=>sum+audienceSize(batch),0);
      const batchPercent=batchesInView.length?matchingBatches.length/batchesInView.length*100:0;
      document.querySelector(`[data-status-count="${status}"]`).textContent=`${matchingBatches.length.toLocaleString('en-IN')} (${batchPercent.toFixed(0)}%)`;
      document.querySelector(`[data-participant-total="${status}"]`).textContent=`${participantCount.toLocaleString('en-IN')} participants`;
      batchStatusSummaries[status]=`${participantCount.toLocaleString('en-IN')} participants`;
    }
    function updateKpi(label,value,sub){
      const card=[...document.querySelectorAll('.kpi')].find(item=>item.querySelector('.kpi-label')?.textContent.trim()===label);
      if(!card)return;
      card.querySelector('.kpi-value').textContent=value;
      if(sub!==null){const element=card.querySelector('.kpi-sub');if(element){element.textContent=sub;element.classList.toggle('target-breakdown',label==='Target Participants');element.classList.toggle('batch-breakdown',['Active Batches','Completed Batches','Upcoming Batches'].includes(label))}}
    }
    const trainedText=totalCompleted.toLocaleString('en-IN');
    const targetParticipants=selectedAudience==='Teacher'?7500:75000;
    const formattedTarget=targetParticipants.toLocaleString('en-IN');
    updateKpi('Training Progress',`${completionPercent.toFixed(1)}%`,null);
    document.querySelector('.kpi-sub .meter span').style.width=`${completionPercent}%`;
    updateKpi('Target Participants',formattedTarget,`${selectedAudience} target`);
    updateKpi('Participants Registered',totals.registered.toLocaleString('en-IN'),'Registered participants');
    updateKpi('Participants Trained',trainedText,`${completionPercent.toFixed(1)}% of target`);
    updateKpi('Attendance Rate',`${attendancePercent.toFixed(1)}%`,'Attendance');
    updateKpi('Active Batches',batchesInView.filter(batch=>batch.status==='ongoing').length.toLocaleString('en-IN'),batchStatusSummaries.ongoing);
    updateKpi('Completed Batches',batchesInView.filter(batch=>batch.status==='completed').length.toLocaleString('en-IN'),batchStatusSummaries.completed);
    updateKpi('Upcoming Batches',batchesInView.filter(batch=>batch.status==='upcoming').length.toLocaleString('en-IN'),batchStatusSummaries.upcoming);
    const progressValues={planned:totals.planned,registered:totals.registered,approved:totals.approved,attended:totals.attended,completed:totals.completed,certified:totals.certified};
    document.querySelectorAll('#training-progress .progress-row').forEach(row=>{
      const stage=row.firstElementChild.textContent.trim().toLowerCase(),value=progressValues[stage],percent=totalParticipants?value/totalParticipants*100:0;
      const fill=row.querySelector('.progress-fill');if(fill)fill.style.width=`${percent}%`;
      row.querySelector('.progress-value').innerHTML=`${value.toLocaleString('en-IN')} <span>(${percent.toFixed(1)}%)</span>`;
    });
    const targetChart=document.querySelector('#target-trained .v-chart');
    const chartValues=targetChart.querySelectorAll('.chart-value'),trainedRatio=targetParticipants?Math.min(1,totalCompleted/targetParticipants):0;
    chartValues[0].textContent=formattedTarget;chartValues[1].textContent=trainedText;
    targetChart.setAttribute('aria-label',`Bar chart comparing the target of ${formattedTarget} ${selectedAudience.toLowerCase()} with ${trainedText} participants trained`);
    const bars=targetChart.querySelectorAll('rect'),trainedHeight=140*trainedRatio;
    bars[0].setAttribute('y','24');bars[0].setAttribute('height','140');bars[1].setAttribute('y',String(164-trainedHeight));bars[1].setAttribute('height',String(trainedHeight));
    chartValues[0].setAttribute('y','17');chartValues[1].setAttribute('y',String(157-trainedHeight));
    const tickLabels=targetChart.querySelectorAll('g.chart-label')[0]?.querySelectorAll('text')??[];
    tickLabels.forEach((tick,index)=>tick.textContent=(targetParticipants*index/5).toLocaleString('en-IN'));
    const achievement=targetChart.closest('.target-layout').querySelector('.donut-center');
    achievement.textContent=`${completionPercent.toFixed(1)}%`;
    const donutCircles=targetChart.closest('.target-layout').querySelectorAll('.donut circle');
    const arc=2.827*completionPercent;donutCircles[1].setAttribute('stroke-dasharray',`${arc} ${282.7-arc}`);donutCircles[2].setAttribute('stroke-dasharray',`${282.7-arc} ${arc}`);donutCircles[2].setAttribute('stroke-dashoffset',String(-arc));
    const donut=targetChart.closest('.target-layout').querySelector('.donut');
    donut.setAttribute('aria-label',`${selectedAudience} achievement ${completionPercent.toFixed(1)} percent`);
    renderAudienceAttendance(attendancePercent);
  }
  function renderAudienceAttendance(attendancePercent){
    const svg=document.querySelector('#attendance .line-chart');
    const x=[50,135,220,306],rates=x.map((_,index)=>Math.max(0,Math.min(100,attendancePercent+(1.5-index)*1.2)));
    const y=rates.map(rate=>145-rate*1.2),coords=x.map((value,index)=>`${value} ${y[index].toFixed(1)}`);
    svg.querySelector('.line-path').setAttribute('d',`M${coords.join(' L')}`);
    svg.querySelector('.line-area').setAttribute('d',`M${coords.join(' L')} L306 145 H50 Z`);
    svg.querySelectorAll('.line-dot').forEach((dot,index)=>dot.setAttribute('cy',y[index].toFixed(1)));
    svg.querySelectorAll('.line-value text').forEach((label,index)=>{label.textContent=`${rates[index].toFixed(1)}%`;label.setAttribute('y',(y[index]-10).toFixed(1))});
    svg.setAttribute('aria-label',`${selectedAudience} attendance trend, averaging ${attendancePercent.toFixed(1)} percent`);
    document.querySelector('#attendance .panel-title').lastChild.textContent='Attendance Trend';
  }
  function renderBatchModal(){
    const search=document.querySelector('#batch-search').value.trim().toLocaleLowerCase();
    const matches=dashboardBatches().filter(batch=>batch.status===activeBatchStatus&&(!search||`${batch.id} ${batch.phase} ${batch.location} ${batch.school} ${batch.trainer}`.toLocaleLowerCase().includes(search)));
    const pageCount=Math.max(1,Math.ceil(matches.length/batchPageSize));batchPage=Math.min(batchPage,pageCount);
    const start=(batchPage-1)*batchPageSize,visible=matches.slice(start,start+batchPageSize);
    document.querySelector('#batch-modal-title').textContent=`${selectedPhase?`${selectedPhaseLabel()} · `:''}${batchStatusLabels[activeBatchStatus]} batches`;
    document.querySelector('#batch-modal-summary').textContent=`${matches.length.toLocaleString('en-IN')} assigned batches · ${matches.reduce((sum,batch)=>sum+audienceSize(batch),0).toLocaleString('en-IN')} participants`;
    document.querySelector('#batch-page-info').textContent=matches.length?`Showing ${(start+1).toLocaleString('en-IN')}–${Math.min(start+batchPageSize,matches.length).toLocaleString('en-IN')} of ${matches.length.toLocaleString('en-IN')} batches · Page ${batchPage} of ${pageCount}`:'No matching batches';
    document.querySelector('#batch-page-prev').disabled=batchPage<=1;
    document.querySelector('#batch-page-next').disabled=batchPage>=pageCount;
    batchModalList.innerHTML=visible.length?visible.map(batch=>`<button class="modal-batch-item" type="button" data-batch-index="${batch.index}" aria-label="Open participants for ${batch.id}, ${audienceSize(batch)} participants"><span class="modal-batch-main"><span class="modal-batch-id">${batch.id}<span class="modal-status-tag ${batch.status}">${batchStatusLabels[batch.status]}</span></span><span class="modal-batch-location">${batch.school} · ${batch.location}</span><span class="batch-modal-breakdown">Trainer Name: ${batch.trainer} · Batch Start Date: ${batch.date}</span></span><span class="modal-batch-stats"><strong>${audienceSize(batch).toLocaleString('en-IN')}</strong><span>participants</span></span></button>`).join(''):'<div class="modal-empty">No batches match your search. Try a batch ID, school, location, or trainer.</div>';
  }
  function openBatchModal(status,trigger){
    activeBatchStatus=status;activeStatusTrigger=trigger;batchPage=1;
    document.querySelector('#batch-search').value='';renderBatchModal();batchModalLayer.hidden=false;
    document.body.style.overflow='hidden';document.querySelector('#batch-search').focus();
  }
  function closeParticipantModal(restoreFocus=true){
    participantModalLayer.hidden=true;selectedBatch=null;
    if(restoreFocus&&activeBatchTrigger?.isConnected)activeBatchTrigger.focus();
  }
  function closeBatchModal(){
    participantModalLayer.hidden=true;batchModalLayer.hidden=true;selectedBatch=null;document.body.style.overflow='';
    if(activeStatusTrigger?.isConnected)activeStatusTrigger.focus();
  }
  function participantRowsFor(batch){
    const firstNames=['Aarav','Aditi','Ananya','Arjun','Divya','Farhan','Ishita','Kiran','Lakshmi','Manoj','Nisha','Pavan','Priya','Rahul','Sana','Sanjay','Sita','Varun','Vijay','Zoya'];
    const lastNames=['Rao','Sharma','Kumar','Reddy','Nair','Patel','Das','Singh','Iyer','Khan','Devi','Joshi','Menon','Gupta','Naidu','Pillai'];
    const rows=Array.from({length:batch.participants},(_,personIndex)=>{
      const type=personIndex<batch.teacherParticipants?'Teacher':'Student';
      const audienceIndex=type==='Teacher'?personIndex:personIndex-batch.teacherParticipants;
      const metrics=audienceMetrics(batch,type);
      let state;
      if(batch.status==='upcoming')state=audienceIndex>=metrics.registered?'Registration pending':'Registered';
      else if(batch.status==='ongoing')state=audienceIndex<metrics.completed?'Completed':audienceIndex>=metrics.attended?'Not started':'In progress';
      else state=audienceIndex<metrics.completed?'Completed':'Needs follow-up';
      const first=firstNames[(batch.index+personIndex*3)%firstNames.length],last=lastNames[(batch.index*5+personIndex*7)%lastNames.length];
      return {id:`${type==='Teacher'?'TCH':'STD'}-${String(200001+batch.index*120+personIndex).padStart(6,'0')}`,name:`${first} ${last}`,school:batch.school,type,state,mobile:`+91 98XXXXXX${String((batch.index*17+personIndex)%100).padStart(2,'0')}`,email:`${first[0].toLowerCase()}••••${last.slice(-1).toLowerCase()}@schoolnet.in`};
    });
    return rows.filter(row=>row.type===selectedAudience);
  }
  let activeParticipantRows=[];
  function renderParticipantList(){
    const search=document.querySelector('#participant-search').value.trim().toLocaleLowerCase();
    const matches=activeParticipantRows.filter(row=>`${row.name} ${row.id} ${row.school} ${row.state}`.toLocaleLowerCase().includes(search));
    document.querySelector('#participant-filter-count').textContent=`${matches.length} of ${activeParticipantRows.length} participants`;
    participantList.innerHTML=matches.length?matches.map(row=>`<div class="participant-row"><div class="participant-details"><span class="participant-name">${row.name}</span><span class="participant-id">${row.id}</span><div class="participant-contact"><span>Mobile Number: ${row.mobile}</span><span>Email ID: ${row.email}</span></div></div><span class="participant-school">${row.school}</span><span class="participant-state ${row.state==='Completed'?'done':row.state==='Registration pending'||row.state==='Needs follow-up'?'pending':''}">${row.state}</span></div>`).join(''):'<div class="modal-empty">No participants match your search.</div>';
  }
  function openParticipantModal(batch,trigger){
    selectedBatch=batch;activeBatchTrigger=trigger;activeParticipantRows=participantRowsFor(batch);
    document.querySelector('#participant-modal-title').textContent=`Phase ${batch.phaseNumber} · ${batch.id} participants`;
    document.querySelector('#participant-modal-summary').textContent=`Phase ${batch.phaseNumber}: ${batch.phase} · ${batch.school} · ${batch.location} · ${selectedAudience} participants · Trainer ${batch.trainer}`;
    document.querySelector('#participant-search').value='';
    renderParticipantList();participantModalLayer.hidden=false;document.querySelector('#participant-search').focus();
  }
  document.querySelectorAll('[data-batch-status]').forEach(button=>button.addEventListener('click',()=>openBatchModal(button.dataset.batchStatus,button)));
  document.querySelector('#batch-search').addEventListener('input',()=>{batchPage=1;renderBatchModal()});
  document.querySelector('#participant-search').addEventListener('input',renderParticipantList);
  document.querySelector('#batch-page-prev').addEventListener('click',()=>{batchPage--;renderBatchModal()});
  document.querySelector('#batch-page-next').addEventListener('click',()=>{batchPage++;renderBatchModal()});
  batchModalList.addEventListener('click',event=>{
    const button=event.target.closest('[data-batch-index]');if(!button)return;
    const batch=batchData[Number(button.dataset.batchIndex)];openParticipantModal(batch,button);
  });
  document.querySelectorAll('[data-close-batch-modal]').forEach(button=>button.addEventListener('click',closeBatchModal));
  document.querySelectorAll('[data-close-participant-modal]').forEach(button=>button.addEventListener('click',()=>closeParticipantModal()));
  document.querySelector('#participant-back').addEventListener('click',()=>closeParticipantModal());
  batchModalLayer.addEventListener('click',event=>{if(event.target===batchModalLayer)closeBatchModal()});
  participantModalLayer.addEventListener('click',event=>{if(event.target===participantModalLayer)closeParticipantModal()});
  document.addEventListener('keydown',event=>{
    const layer=participantModalLayer.hidden?(batchModalLayer.hidden?null:batchModalLayer):participantModalLayer;
    if(!layer)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(layer===participantModalLayer)closeParticipantModal();else closeBatchModal();return}
    if(event.key==='Tab'){
      const focusable=[...layer.querySelectorAll('button:not(:disabled),input:not(:disabled)')];
      if(!focusable.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
  },true);
  renderBatchStatusTotals();

  const makeLocationNode=name=>({name,children:[],assignedBatches:[]});
  const getOrCreateLocationNode=(parent,name)=>{
    let node=parent.find(item=>item.name===name);
    if(!node){node=makeLocationNode(name);parent.push(node)}
    return node;
  };
  const locationTree=[],locationSchoolNodes=[];
  kgbvSchools.forEach(sourceSchool=>{
    const stateNode=getOrCreateLocationNode(locationTree,sourceSchool.state);
    const districtNode=getOrCreateLocationNode(stateNode.children,sourceSchool.district);
    const blockNode=getOrCreateLocationNode(districtNode.children,sourceSchool.block);
    locationSchoolNodes.push(getOrCreateLocationNode(blockNode.children,sourceSchool.school));
  });
  document.querySelector('#locations .info-button').dataset.info='Location Performance uses the 750 schools listed in KGBV sample school list, Table 1. Click State, District, or Block rows to drill down to schools.';
  batchData.forEach((batch,index)=>locationSchoolNodes[index]?.assignedBatches.push(batch));
  function locationTotals(node){
    if(!node.children.length){
      const batches=node.assignedBatches.filter(batch=>!selectedPhase||batch.phaseNumber===selectedPhase),completedBatches=batches.filter(batch=>batch.status==='completed').length;
      const metrics=batches.reduce((sum,batch)=>{const current=audienceMetrics(batch);for(const key of ['planned','registered','completed'])sum[key]+=current[key];return sum},{planned:0,registered:0,completed:0});
      return {batches:batches.length,scheduled:batches.length,ongoing:batches.filter(batch=>batch.status==='ongoing').length,notStarted:batches.filter(batch=>batch.status==='upcoming').length,completedBatches,plannedUsers:metrics.planned,registeredUsers:metrics.registered,completedUsers:metrics.completed};
    }
    return node.children.map(locationTotals).reduce((sum,item)=>({batches:sum.batches+item.batches,scheduled:sum.scheduled+item.scheduled,ongoing:sum.ongoing+item.ongoing,notStarted:sum.notStarted+item.notStarted,completedBatches:sum.completedBatches+item.completedBatches,plannedUsers:sum.plannedUsers+item.plannedUsers,registeredUsers:sum.registeredUsers+item.registeredUsers,completedUsers:sum.completedUsers+item.completedUsers}),{batches:0,scheduled:0,ongoing:0,notStarted:0,completedBatches:0,plannedUsers:0,registeredUsers:0,completedUsers:0});
  }
  let locationPath=[];
  let locationSortDirection='desc';
  let locationSortKey='completedPercent';
  const locationRows=document.querySelector('#location-rows'),locationSortBy=document.querySelector('#location-sort-by'),locationLabels=['State','District','Block','School'];
  function renderLocations(){
    const level=locationPath.length,nodes=level===0?locationTree:locationPath[level-1].children;
    document.querySelector('#location-level-heading').textContent=locationLabels[level];
    const phaseContext=selectedPhase?` · ${selectedPhaseLabel()}`:'';
    document.querySelector('#location-context').textContent=locationPath.length?`${locationPath.map(node=>node.name).join(' · ')} · selected group${phaseContext}`:`All 13 states · ${dashboardBatches().length.toLocaleString('en-IN')} batches · ${dashboardBatches().reduce((sum,batch)=>sum+audienceSize(batch),0).toLocaleString('en-IN')} participants${phaseContext}`;
    const breadcrumb=document.querySelector('#location-breadcrumb');
    const crumbs=[...locationPath.map((node,index)=>({label:locationLabels[index],index})),{label:locationLabels[level],index:level}];
    breadcrumb.innerHTML=crumbs.map((crumb,index)=>`<li><button type="button" class="location-crumb" data-crumb-depth="${crumb.index}" ${index===crumbs.length-1?'aria-current="page"':''}>${crumb.label}</button></li>`).join('');
    const sortedNodes=nodes.map((node,index)=>{
      const stats=locationTotals(node),completedPercent=stats.plannedUsers?stats.completedUsers/stats.plannedUsers*100:0;
      const sortValue=locationSortKey==='batchCompletionPercent'?(stats.batches?stats.completedBatches/stats.batches*100:0):locationSortKey==='completedPercent'?completedPercent:stats[locationSortKey];
      return {node,index,stats,completedPercent,sortValue};
    }).sort((a,b)=>locationSortDirection==='asc'?a.sortValue-b.sortValue||a.node.name.localeCompare(b.node.name):b.sortValue-a.sortValue||a.node.name.localeCompare(b.node.name));
    locationRows.innerHTML=sortedNodes.map(({node,index,stats,completedPercent})=>{
      const completedBatches=stats.completedBatches;
      const batchCompletionPercent=stats.batches?completedBatches/stats.batches*100:0;
      const name=level<3?`<button type="button" class="location-name-button" data-location-index="${index}" aria-label="Show ${locationLabels[level+1]} locations for ${node.name}">${node.name}</button>`:node.name;
      return `<tr><td>${name}</td><td>${stats.scheduled}</td><td>${stats.ongoing}</td><td>${batchCompletionPercent.toFixed(1)}%</td><td>${stats.notStarted}</td><td>${stats.plannedUsers.toLocaleString('en-IN')}</td><td>${stats.registeredUsers.toLocaleString('en-IN')}</td><td>${stats.completedUsers.toLocaleString('en-IN')}</td><td>${completedPercent.toFixed(1)}%</td></tr>`;
    }).join('');
  }
  document.querySelectorAll('[data-location-sort]').forEach(button=>button.addEventListener('click',()=>{
    locationSortDirection=button.dataset.locationSort;
    document.querySelectorAll('[data-location-sort]').forEach(toggle=>toggle.setAttribute('aria-pressed',String(toggle===button)));
    renderLocations();
  }));
  locationSortBy.addEventListener('change',()=>{locationSortKey=locationSortBy.value;renderLocations()});
  locationRows.addEventListener('click',event=>{
    const button=event.target.closest('[data-location-index]');if(!button)return;
    const nodes=locationPath.length?locationPath[locationPath.length-1].children:locationTree;
    locationPath.push(nodes[Number(button.dataset.locationIndex)]);renderLocations();
  });
  document.querySelector('#location-breadcrumb').addEventListener('click',event=>{
    const button=event.target.closest('[data-crumb-depth]');if(!button||button.getAttribute('aria-current')==='page')return;
    locationPath=locationPath.slice(0,Number(button.dataset.crumbDepth));renderLocations();
  });
  document.querySelectorAll('.audience-button').forEach(button=>button.addEventListener('click',()=>{
    if(selectedAudience===button.dataset.audience)return;
    selectedAudience=button.dataset.audience;
    selectedPhase=selectedAudience==='Teacher'
      ?Number(currentPhaseCard?.querySelector('.phase-number')?.textContent.match(/\d+/)?.[0])||3
      :1;
    document.querySelectorAll('.phase-card, .student-module-card').forEach(card=>{
      const cardPhase=Number(card.querySelector('.phase-number')?.textContent.match(/\d+/)?.[0]);
      const selected=selectedPhase!==null&&cardPhase===selectedPhase;
      card.classList.toggle('selected',selected);
      card.setAttribute('aria-pressed',String(selected));
    });
    document.querySelectorAll('.audience-button').forEach(toggle=>toggle.setAttribute('aria-pressed',String(toggle===button)));
    renderBatchStatusTotals();renderLocations();
    if(!batchModalLayer.hidden)renderBatchModal();
    if(!participantModalLayer.hidden&&selectedBatch)openParticipantModal(selectedBatch,activeBatchTrigger);
  }));
  renderLocations();

  document.querySelectorAll('[data-export]').forEach(button=>button.addEventListener('click',()=>{
    const section=button.closest('.panel');
    const rows=[...section.querySelectorAll('tr')].map(row=>[...row.children].map(cell=>'"'+cell.innerText.trim().replaceAll('"','""')+'"').join(','));
    if(!rows.length){showToast('This chart is ready to export from a connected data source.');return}
    const blob=new Blob([rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`${button.dataset.export}-report.csv`;anchor.click();URL.revokeObjectURL(url);showToast('Report downloaded as CSV.');
  }));

  document.querySelector('#notifications').addEventListener('click',()=>showToast('You’re all caught up on dashboard notifications.'));
  document.querySelector('#profile-button').addEventListener('click',()=>showToast('Signed in as Project Sponsor.'));
  const appRoot=document.querySelector('.app');
  const collapseButton=document.querySelector('.collapse');
  function setSidebarCollapsed(collapsed){
    appRoot.classList.toggle('is-collapsed',collapsed);
    appRoot.classList.toggle('is-expanded',!collapsed && window.matchMedia('(max-width: 900px) and (min-width: 621px)').matches);
    collapseButton.setAttribute('aria-label',collapsed?'Expand navigation':'Collapse navigation');
    collapseButton.setAttribute('aria-expanded',String(!collapsed));
  }
  if(window.matchMedia('(max-width: 900px) and (min-width: 621px)').matches)setSidebarCollapsed(true);
  collapseButton.addEventListener('click',()=>setSidebarCollapsed(!appRoot.classList.contains('is-collapsed')));
  function selectPhase(phase){
    const phaseNumber=Number(phase.querySelector('.phase-number').textContent.match(/\d+/)?.[0]);
    selectedPhase=selectedPhase===phaseNumber?null:phaseNumber;
    document.querySelectorAll('.phase-card, .student-module-card').forEach(card=>{
      const cardPhaseNumber=Number(card.querySelector('.phase-number').textContent.match(/\d+/)?.[0]);
      const selected=selectedPhase!==null&&cardPhaseNumber===selectedPhase;
      card.classList.toggle('selected',selected);
      card.setAttribute('aria-pressed',String(selected));
    });
    renderBatchStatusTotals();
    renderLocations();
    if(!batchModalLayer.hidden)renderBatchModal();
    if(!participantModalLayer.hidden&&selectedBatch)openParticipantModal(selectedBatch,activeBatchTrigger);
  }
  document.querySelectorAll('.phase-card, .student-module-card').forEach(phase=>{
    phase.addEventListener('click',()=>selectPhase(phase));
    phase.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();selectPhase(phase)}
    });
  });
