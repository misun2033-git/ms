const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const store = {
  get(key, fallback){ try { const value=localStorage.getItem(key); return value===null?fallback:JSON.parse(value); } catch { return fallback; } },
  set(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
};
function toast(message){ const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),2200); }

function route(){
  const name=location.hash.slice(1)||'home';
  $$('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===name));
  window.scrollTo({top:0,behavior:'instant'});
  if(name!=='noise') stopNoise();
}
addEventListener('hashchange',route); route();

let installPrompt;
addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); installPrompt=e; $('#installButton').classList.remove('hidden'); });
$('#installButton').addEventListener('click',async()=>{ if(!installPrompt)return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt=null; $('#installButton').classList.add('hidden'); });
if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').then(()=>{$('#offlineBadge').textContent='오프라인 사용 가능';}).catch(()=>{$('#offlineBadge').textContent='오프라인 준비 실패';}); }

$$('[data-time-tab]').forEach(btn=>btn.addEventListener('click',()=>{
  $$('[data-time-tab]').forEach(b=>{const active=b===btn;b.classList.toggle('active',active);b.setAttribute('aria-selected',active)});
  $('#countdownPanel').classList.toggle('hidden',btn.dataset.timeTab!=='countdown');
  $('#stopwatchPanel').classList.toggle('hidden',btn.dataset.timeTab!=='stopwatch');
}));

let timerState=store.get('classHub.timer',{duration:300,remaining:300,running:false,endAt:null});
let timerTick;
function timerRemaining(){ return timerState.running?Math.max(0,Math.ceil((timerState.endAt-Date.now())/1000)):timerState.remaining; }
function formatTime(total){ total=Math.max(0,total);return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`; }
function renderTimer(){
  const remaining=timerRemaining(); $('#timerDisplay').textContent=formatTime(remaining);
  $('#startTimer').textContent=timerState.running?'일시정지':'시작';
  if(timerState.running&&remaining===0){ timerState={...timerState,running:false,remaining:0,endAt:null}; persistTimer(); $('#timerNotice').textContent='시간이 끝났습니다.'; toast('시간이 끝났습니다'); try{navigator.vibrate?.([200,100,200]);}catch{} }
}
function persistTimer(){store.set('classHub.timer',timerState)}
function setDuration(sec){clearInterval(timerTick);timerState={duration:sec,remaining:sec,running:false,endAt:null};persistTimer();renderTimer();$('#timerNotice').textContent='';}
$$('[data-seconds]').forEach(b=>b.addEventListener('click',()=>setDuration(Number(b.dataset.seconds))));
$('#setTimer').addEventListener('click',()=>{const sec=Math.min(10800,Math.max(1,Number($('#minuteInput').value||0)*60+Number($('#secondInput').value||0)));setDuration(sec)});
$('#startTimer').addEventListener('click',()=>{const remaining=timerRemaining(); if(!remaining){setDuration(timerState.duration);return;} if(timerState.running){timerState={...timerState,running:false,remaining,endAt:null};clearInterval(timerTick);}else{timerState={...timerState,running:true,endAt:Date.now()+remaining*1000};timerTick=setInterval(renderTimer,250)}persistTimer();renderTimer();});
$('#resetTimer').addEventListener('click',()=>setDuration(timerState.duration));
if(timerState.running)timerTick=setInterval(renderTimer,250);renderTimer();

let stopwatch=store.get('classHub.stopwatch',{elapsed:0,running:false,startAt:null,laps:[]}); let stopwatchTick;
function elapsedMs(){return stopwatch.running?stopwatch.elapsed+(Date.now()-stopwatch.startAt):stopwatch.elapsed}
function formatStopwatch(ms){const t=Math.floor(ms/100);const ds=t%10;const sec=Math.floor(t/10)%60;const min=Math.floor(t/600);return `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${ds}`}
function renderStopwatch(){ $('#stopwatchDisplay').textContent=formatStopwatch(elapsedMs());$('#startStopwatch').textContent=stopwatch.running?'일시정지':'시작';$('#lapStopwatch').disabled=!stopwatch.running;$('#lapList').innerHTML=stopwatch.laps.map((v,i)=>`<li><span>랩 ${stopwatch.laps.length-i}</span><strong>${formatStopwatch(v)}</strong></li>`).join(''); }
function persistStopwatch(){store.set('classHub.stopwatch',stopwatch)}
$('#startStopwatch').addEventListener('click',()=>{if(stopwatch.running){stopwatch={...stopwatch,elapsed:elapsedMs(),running:false,startAt:null};clearInterval(stopwatchTick)}else{stopwatch={...stopwatch,running:true,startAt:Date.now()};stopwatchTick=setInterval(renderStopwatch,100)}persistStopwatch();renderStopwatch()});
$('#lapStopwatch').addEventListener('click',()=>{stopwatch.laps.unshift(elapsedMs());persistStopwatch();renderStopwatch()});
$('#resetStopwatch').addEventListener('click',()=>{stopwatch={elapsed:0,running:false,startAt:null,laps:[]};clearInterval(stopwatchTick);persistStopwatch();renderStopwatch()});
if(stopwatch.running)stopwatchTick=setInterval(renderStopwatch,100);renderStopwatch();

let teams=store.get('classHub.teams',[{id:crypto.randomUUID(),name:'1모둠',score:0},{id:crypto.randomUUID(),name:'2모둠',score:0},{id:crypto.randomUUID(),name:'3모둠',score:0},{id:crypto.randomUUID(),name:'4모둠',score:0}]);
function saveTeams(){store.set('classHub.teams',teams)}
function renderTeams(){
  $('#scoreGrid').innerHTML=teams.map(team=>`<article class="team-card" data-id="${team.id}"><input class="team-name" value="${escapeHtml(team.name)}" aria-label="모둠 이름"><div class="team-score" aria-label="${team.score}점">${team.score}</div><div class="score-controls"><button data-delta="-5" aria-label="5점 빼기">−5</button><button data-delta="-1" aria-label="1점 빼기">−1</button><button data-delta="1" aria-label="1점 더하기">+1</button><button data-delta="5" aria-label="5점 더하기">+5</button></div><button class="text-button danger remove-team" type="button">모둠 삭제</button></article>`).join('');
}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
$('#scoreGrid').addEventListener('click',e=>{const card=e.target.closest('.team-card');if(!card)return;const team=teams.find(t=>t.id===card.dataset.id);if(e.target.dataset.delta){team.score+=Number(e.target.dataset.delta);saveTeams();renderTeams()}if(e.target.classList.contains('remove-team')){if(teams.length===1){toast('모둠은 하나 이상 필요합니다');return}teams=teams.filter(t=>t.id!==team.id);saveTeams();renderTeams()}});
$('#scoreGrid').addEventListener('change',e=>{if(!e.target.classList.contains('team-name'))return;const card=e.target.closest('.team-card');const team=teams.find(t=>t.id===card.dataset.id);team.name=e.target.value.trim()||'이름 없는 모둠';saveTeams();renderTeams()});
$('#addTeam').addEventListener('click',()=>{if(teams.length>=8){toast('모둠은 최대 8개까지 만들 수 있습니다');return}teams.push({id:crypto.randomUUID(),name:`${teams.length+1}모둠`,score:0});saveTeams();renderTeams()});
$('#resetScores').addEventListener('click',()=>{if(!confirm('모든 모둠 점수를 0점으로 초기화할까요?'))return;teams.forEach(t=>t.score=0);saveTeams();renderTeams();toast('점수를 초기화했습니다')});renderTeams();

let audioContext, analyser, mediaStream, noiseFrame, noiseActive=false;
const threshold=$('#noiseThreshold');threshold.value=store.get('classHub.noiseThreshold',55);$('#thresholdLabel').textContent=threshold.value;
threshold.addEventListener('input',()=>{$('#thresholdLabel').textContent=threshold.value;store.set('classHub.noiseThreshold',Number(threshold.value))});
$('#toggleNoise').addEventListener('click',()=>noiseActive?stopNoise():startNoise());
async function startNoise(){
  if(!navigator.mediaDevices?.getUserMedia){$('#noiseMessage').textContent='이 브라우저는 마이크 측정을 지원하지 않습니다';return}
  try{mediaStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});audioContext=new AudioContext();analyser=audioContext.createAnalyser();analyser.fftSize=1024;audioContext.createMediaStreamSource(mediaStream).connect(analyser);noiseActive=true;$('#toggleNoise').textContent='측정 멈추기';measureNoise();}
  catch{$('#noiseMessage').textContent='마이크 권한을 허용해 주세요';toast('브라우저 주소창에서 마이크 권한을 확인해 주세요')}
}
function measureNoise(){
  if(!noiseActive)return;const data=new Uint8Array(analyser.fftSize);analyser.getByteTimeDomainData(data);let sum=0;for(const v of data){const n=(v-128)/128;sum+=n*n}const rms=Math.sqrt(sum/data.length);const level=Math.max(0,Math.min(100,Math.round(20*Math.log10(rms||.00001)+100)));const limit=Number(threshold.value);const state=level>=limit+15?'loud':level>=limit?'watch':'calm';$('#noiseValue').textContent=level;$('#noiseOrb').className=`noise-orb ${state}`;$('#noiseMessage').textContent=state==='calm'?'좋아요, 집중하기 좋은 소리예요':state==='watch'?'조금 커졌어요':'잠깐, 목소리를 낮춰요';noiseFrame=requestAnimationFrame(measureNoise);
}
function stopNoise(){noiseActive=false;cancelAnimationFrame(noiseFrame);mediaStream?.getTracks().forEach(t=>t.stop());audioContext?.close();mediaStream=null;audioContext=null;$('#toggleNoise').textContent='마이크 켜기';$('#noiseValue').textContent='—';$('#noiseOrb').className='noise-orb calm';$('#noiseMessage').textContent='마이크를 켜면 시작합니다'}

let pdfAnalysis=null;
const pdfFile=$('#pdfFile');
const pdfDropzone=$('#pdfDropzone');
const formatNumber=value=>new Intl.NumberFormat('ko-KR').format(value);
function showPdfPanel(name){pdfDropzone.classList.toggle('hidden',name!=='input');$('#pdfWorking').classList.toggle('hidden',name!=='working');$('#pdfResult').classList.toggle('hidden',name!=='result');$('#pdfError').classList.toggle('hidden',name!=='error')}
function countText(text){const normalized=text.replace(/\r\n?/g,'\n');return{withSpace:[...normalized].length,noSpace:[...normalized.replace(/\s/g,'')].length,words:(normalized.trim().match(/\S+/g)||[]).length}}
async function analyzePdf(file){
  if(!file)return;
  if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){showPdfError('PDF 파일만 선택할 수 있습니다.');return}
  if(file.size>100*1024*1024){showPdfError('파일 크기가 100MB를 넘습니다. 더 작은 PDF를 선택해 주세요.');return}
  showPdfPanel('working');$('#pdfProgress').textContent='분석 도구를 준비하고 있습니다.';
  try{
    const pdfjsLib=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
    const bytes=new Uint8Array(await file.arrayBuffer());
    const pdf=await pdfjsLib.getDocument({data:bytes}).promise;
    const pages=[];const allText=[];
    for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
      $('#pdfProgress').textContent=`${pdf.numPages}쪽 중 ${pageNumber}쪽을 읽고 있습니다.`;
      const page=await pdf.getPage(pageNumber);const content=await page.getTextContent();const text=content.items.map(item=>item.str).join(' ');const counts=countText(text);
      pages.push({page:pageNumber,...counts});allText.push(text);
    }
    const text=allText.join('\n');const totals=countText(text);
    pdfAnalysis={fileName:file.name,fileSize:file.size,pageCount:pdf.numPages,text,pages,totals};renderPdfResult();
  }catch(error){console.error(error);showPdfError(error?.name==='PasswordException'?'암호로 보호된 PDF는 읽을 수 없습니다. 암호를 해제한 뒤 다시 시도해 주세요.':'PDF에서 글자를 추출하지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요.')}finally{pdfFile.value=''}
}
function renderPdfResult(){const r=pdfAnalysis;$('#pdfCharsNoSpace').textContent=formatNumber(r.totals.noSpace);$('#pdfCharsWithSpace').textContent=formatNumber(r.totals.withSpace);$('#pdfWords').textContent=formatNumber(r.totals.words);$('#pdfPages').textContent=formatNumber(r.pageCount);$('#pdfFileMeta').textContent=`${r.fileName} · ${(r.fileSize/1024/1024).toFixed(1)}MB`;$('#pdfPageRows').innerHTML=r.pages.map(p=>`<tr><td>${p.page}쪽</td><td>${formatNumber(p.noSpace)}</td><td>${formatNumber(p.withSpace)}</td><td>${formatNumber(p.words)}</td></tr>`).join('');showPdfPanel('result')}
function showPdfError(message){$('#pdfErrorMessage').textContent=message;showPdfPanel('error')}
function resetPdf(){pdfAnalysis=null;pdfFile.value='';showPdfPanel('input')}
pdfFile.addEventListener('change',()=>analyzePdf(pdfFile.files[0]));
['dragenter','dragover'].forEach(type=>pdfDropzone.addEventListener(type,event=>{event.preventDefault();pdfDropzone.classList.add('dragover')}));
['dragleave','drop'].forEach(type=>pdfDropzone.addEventListener(type,event=>{event.preventDefault();pdfDropzone.classList.remove('dragover')}));
pdfDropzone.addEventListener('drop',event=>analyzePdf([...event.dataTransfer.files].find(file=>file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf'))||event.dataTransfer.files[0]));
$('#resetPdf').addEventListener('click',resetPdf);$('#retryPdf').addEventListener('click',resetPdf);
$('#copyPdfResult').addEventListener('click',async()=>{if(!pdfAnalysis)return;const r=pdfAnalysis;const summary=`${r.fileName}\n공백 제외: ${r.totals.noSpace}자\n공백 포함: ${r.totals.withSpace}자\n단어 수: ${r.totals.words}개\n페이지 수: ${r.pageCount}쪽`;try{await navigator.clipboard.writeText(summary);toast('결과를 복사했습니다')}catch{toast('클립보드 권한을 확인해 주세요')}});
$('#downloadPdfResult').addEventListener('click',()=>{if(!pdfAnalysis)return;const r=pdfAnalysis;const summary=`파일: ${r.fileName}\n공백 제외: ${r.totals.noSpace}자\n공백 포함: ${r.totals.withSpace}자\n단어 수: ${r.totals.words}개\n페이지 수: ${r.pageCount}쪽\n\n--- 추출된 텍스트 ---\n${r.text}`;const url=URL.createObjectURL(new Blob([summary],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${r.fileName.replace(/\.pdf$/i,'')}-글자수.txt`;a.click();URL.revokeObjectURL(url);toast('텍스트 파일을 저장했습니다')});

const DIARY_FILE='늘봄-일기장.json';
let diaryEntries=store.get('classHub.diaryEntries',[]);
let diaryFolderHandle=null;
let activeDiaryId=null;
let diaryMood='평온';
const todayLocal=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};
function validDiaryData(data){return data&&data.version===1&&Array.isArray(data.entries)}
function diaryPayload(){return{version:1,updatedAt:new Date().toISOString(),entries:diaryEntries}}
function cacheDiary(){store.set('classHub.diaryEntries',diaryEntries)}
function openDiaryDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open('classHubFiles',1);request.onupgradeneeded=()=>request.result.createObjectStore('handles');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function saveDiaryHandle(handle){const db=await openDiaryDb();await new Promise((resolve,reject)=>{const tx=db.transaction('handles','readwrite');tx.objectStore('handles').put(handle,'diaryFolder');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}
async function loadDiaryHandle(){const db=await openDiaryDb();const handle=await new Promise((resolve,reject)=>{const tx=db.transaction('handles');const req=tx.objectStore('handles').get('diaryFolder');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});db.close();return handle}
async function hasDiaryPermission(handle){return(await handle.queryPermission({mode:'readwrite'}))==='granted'}
function setDiaryStorageStatus(connected,name=''){$('#diaryStorageTitle').textContent=connected?`${name||'로컬 폴더'}에 연결됨`:'저장 폴더를 연결해 주세요';$('#diaryStorageText').textContent=connected?`${DIARY_FILE} 파일에 변경사항을 자동 반영합니다.`:'일기는 서버로 전송되지 않고, 선택한 폴더의 JSON 파일에 저장됩니다.';$('#connectDiaryFolder').textContent=connected?'폴더 변경':'폴더 연결'}
async function readDiaryFolder(handle){const fileHandle=await handle.getFileHandle(DIARY_FILE,{create:true});const file=await fileHandle.getFile();if(!file.size)return;const data=JSON.parse(await file.text());if(!validDiaryData(data))throw new Error('지원하지 않는 일기장 파일 형식입니다.');diaryEntries=data.entries;cacheDiary()}
async function writeDiaryFolder(){if(!diaryFolderHandle||!(await hasDiaryPermission(diaryFolderHandle)))return false;const fileHandle=await diaryFolderHandle.getFileHandle(DIARY_FILE,{create:true});const writer=await fileHandle.createWritable();await writer.write(JSON.stringify(diaryPayload(),null,2));await writer.close();return true}
async function connectDiaryFolder(){if(!window.showDirectoryPicker){toast('이 브라우저에서는 폴더 연결을 지원하지 않습니다. 내보내기를 이용해 주세요.');return false}try{const handle=await showDirectoryPicker({mode:'readwrite',id:'class-hub-diary'});diaryFolderHandle=handle;await saveDiaryHandle(handle);await readDiaryFolder(handle);setDiaryStorageStatus(true,handle.name);renderDiaryList();newDiary();toast('일기장 폴더를 연결했습니다');return true}catch(error){if(error.name!=='AbortError')toast(error.message||'폴더를 연결하지 못했습니다');return false}}
function moodEmoji(mood){return{'좋음':'😊','평온':'🙂','보통':'😐','속상':'😔','화남':'😠'}[mood]||'🙂'}
function renderDiaryList(){const query=$('#diarySearch').value.trim().toLowerCase();const entries=[...diaryEntries].filter(e=>`${e.title} ${e.content}`.toLowerCase().includes(query)).sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt));$('#diaryList').innerHTML=entries.length?entries.map(e=>`<button type="button" class="diary-item ${e.id===activeDiaryId?'active':''}" data-diary-id="${e.id}"><strong>${moodEmoji(e.mood)} ${escapeHtml(e.title||'제목 없는 일기')}</strong><span>${escapeHtml(e.date)} · ${escapeHtml((e.content||'내용 없음').replace(/\s+/g,' '))}</span></button>`).join(''):'<p class="diary-empty">아직 기록이 없습니다.<br>오늘의 첫 일기를 남겨 보세요.</p>'}
function selectMood(mood){diaryMood=mood;$$('[data-mood]').forEach(button=>{const active=button.dataset.mood===mood;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active)})}
function newDiary(){activeDiaryId=null;$('#diaryDate').value=todayLocal();$('#diaryEntryTitle').value='';$('#diaryContent').value='';$('#diarySaveState').textContent='새 일기를 작성하고 있습니다.';selectMood('평온');renderDiaryList();$('#diaryEntryTitle').focus()}
function openDiary(id){const entry=diaryEntries.find(e=>e.id===id);if(!entry)return;activeDiaryId=id;$('#diaryDate').value=entry.date;$('#diaryEntryTitle').value=entry.title;$('#diaryContent').value=entry.content;selectMood(entry.mood);$('#diarySaveState').textContent=`${new Date(entry.updatedAt).toLocaleString('ko-KR')}에 저장됨`;renderDiaryList()}
async function saveDiaryEntry(){const title=$('#diaryEntryTitle').value.trim();const content=$('#diaryContent').value.trim();if(!title&&!content){toast('제목이나 내용을 입력해 주세요');return}if(!diaryFolderHandle||!(await hasDiaryPermission(diaryFolderHandle))){const connected=await connectDiaryFolder();if(!connected)return}const now=new Date().toISOString();const entry={id:activeDiaryId||crypto.randomUUID(),date:$('#diaryDate').value||todayLocal(),mood:diaryMood,title:title||'제목 없는 일기',content,createdAt:now,updatedAt:now};const index=diaryEntries.findIndex(e=>e.id===entry.id);if(index>=0){entry.createdAt=diaryEntries[index].createdAt;diaryEntries[index]=entry}else diaryEntries.push(entry);activeDiaryId=entry.id;cacheDiary();try{await writeDiaryFolder();$('#diarySaveState').textContent='방금 로컬 폴더에 저장됨';renderDiaryList();toast('일기를 저장했습니다')}catch{toast('파일에 저장하지 못했습니다. 폴더 권한을 확인해 주세요.')}}
async function deleteDiaryEntry(){if(!activeDiaryId){newDiary();return}if(!confirm('이 일기를 삭제할까요?'))return;diaryEntries=diaryEntries.filter(e=>e.id!==activeDiaryId);cacheDiary();try{await writeDiaryFolder()}catch{}newDiary();toast('일기를 삭제했습니다')}
function exportDiary(){const url=URL.createObjectURL(new Blob([JSON.stringify(diaryPayload(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=DIARY_FILE;a.click();URL.revokeObjectURL(url);toast('일기장 파일을 내보냈습니다')}
async function importDiaryFile(file){try{const data=JSON.parse(await file.text());if(!validDiaryData(data))throw new Error();if(diaryEntries.length&&!confirm('현재 일기를 가져온 파일의 내용으로 바꿀까요?'))return;diaryEntries=data.entries;cacheDiary();await writeDiaryFolder();newDiary();toast('일기장을 가져왔습니다')}catch{toast('올바른 일기장 JSON 파일이 아닙니다')}}
$('#connectDiaryFolder').addEventListener('click',connectDiaryFolder);$('#newDiary').addEventListener('click',newDiary);$('#saveDiary').addEventListener('click',saveDiaryEntry);$('#deleteDiary').addEventListener('click',deleteDiaryEntry);$('#diarySearch').addEventListener('input',renderDiaryList);$('#diaryList').addEventListener('click',event=>{const item=event.target.closest('[data-diary-id]');if(item)openDiary(item.dataset.diaryId)});$$('[data-mood]').forEach(button=>button.addEventListener('click',()=>selectMood(button.dataset.mood)));$('#exportDiary').addEventListener('click',exportDiary);$('#importDiary').addEventListener('click',()=>$('#diaryImportFile').click());$('#diaryImportFile').addEventListener('change',()=>{const file=$('#diaryImportFile').files[0];if(file)importDiaryFile(file);$('#diaryImportFile').value=''});
newDiary();
(async()=>{if(!window.showDirectoryPicker){$('#connectDiaryFolder').textContent='폴더 저장 미지원';return}try{const handle=await loadDiaryHandle();if(handle&&await hasDiaryPermission(handle)){diaryFolderHandle=handle;await readDiaryFolder(handle);setDiaryStorageStatus(true,handle.name);renderDiaryList()}}catch{}})();
