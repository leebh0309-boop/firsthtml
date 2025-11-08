// 도우미
const $ = (s) => document.querySelector(s);
const now = () => new Date().toLocaleString();
const STORE = "sunjin_as_chat_v1";

// ====== 좌측: 폼/파일/초안/CSV ======
const form = {
  custName: $('#custName'),
  phone: $('#phone'),
  model: $('#model'),
  vin: $('#vin'),
  plate: $('#plate'),
  region: $('#region'),
  symptom: $('#symptom'),
  files: $('#files'),
  preview: $('#preview'),
  consent: $('#consent'),
  draft: $('#draft'),
};

function clearForm(){
  Object.values(form).forEach(el=>{
    if (['INPUT','TEXTAREA'].includes(el?.tagName) && el.type!=='file' && el.type!=='checkbox'){
      el.value = '';
    }
  });
  form.consent.checked = false;
  form.preview.innerHTML = '';
}

function saveForm(){
  const data = readForm();
  localStorage.setItem(STORE, JSON.stringify(data));
  alert('저장되었습니다.');
}

function loadForm(){
  const raw = localStorage.getItem(STORE);
  if(!raw) return alert('저장된 데이터가 없습니다.');
  try{
    const d = JSON.parse(raw);
    for (const k of ['custName','phone','model','vin','plate','region','symptom']){
      form[k].value = d[k] || '';
    }
    form.consent.checked = !!d.consent;
    renderDraft();
  }catch(e){
    alert('불러오기 오류: '+e.message);
  }
}

function readForm(){
  return {
    custName: form.custName.value.trim(),
    phone: form.phone.value.trim(),
    model: form.model.value.trim(),
    vin: form.vin.value.trim(),
    plate: form.plate.value.trim(),
    region: form.region.value.trim(),
    symptom: form.symptom.value.trim(),
    consent: form.consent.checked,
    ts: now(),
  };
}

function toCSV(rows){
  return rows.map(r => r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
}

function exportCSV(){
  const d = readForm();
  const header = ["접수시각","고객명","연락처","차종/모델","VIN","차량번호","지역","증상","동의여부"];
  const row = [[d.ts, d.custName, d.phone, d.model, d.vin, d.plate, d.region, d.symptom, d.consent?'Y':'N']];
  const csv = [header, ...row];
  const blob = new Blob([toCSV(csv)], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `AS_${d.plate||'unknown'}_${Date.now()}.csv`;
  a.click();
}

function renderDraft(){
  const d = readForm();
  const lines = [
    "[A/S 접수요청]",
    `고객명: ${d.custName || '-'}`,
    `연락처: ${d.phone || '-'}`,
    `차종/모델: ${d.model || '-'}`,
    `차대번호(VIN): ${d.vin || '-'}`,
    `차량번호: ${d.plate || '-'}`,
    `지역: ${d.region || '-'}`,
    `증상: ${d.symptom || '-'}`,
    `개인정보 동의: ${d.consent ? '예' : '아니오'}`,
    `작성시각: ${d.ts}`,
    "",
    "※ 본 내용은 과제용 데모로 실제 접수는 회사 공식 채널을 이용해 주세요."
  ];
  form.draft.value = lines.join('\n');
}

function copyDraft(){ navigator.clipboard.writeText(form.draft.value); }
function downloadDraft(){
  const blob = new Blob([form.draft.value], {type:'text/plain;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `AS_request_${Date.now()}.txt`;
  a.click();
}

// 빠른 증상 태그
$('#quickIssues').addEventListener('click', (e)=>{
  if(!(e.target.dataset?.add)) return;
  const add = e.target.dataset.add;
  form.symptom.value = form.symptom.value ? (form.symptom.value + `, ${add}`) : add;
  renderDraft();
});

// 파일 미리보기
form.files.addEventListener('change', ()=>{
  form.preview.innerHTML = '';
  [...form.files.files].forEach(file=>{
    const url = URL.createObjectURL(file);
    const ext = file.type.startsWith('video') ? 'video' : 'img';
    const el = document.createElement(ext);
    el.src = url;
    if(ext==='video'){ el.controls = true; }
    form.preview.appendChild(el);
  });
});

// 버튼들
$('#btnNew').addEventListener('click', ()=>{ if(confirm('작성중인 내용을 지울까요?')) clearForm(); });
$('#btnSave').addEventListener('click', saveForm);
$('#btnLoad').addEventListener('click', loadForm);
$('#btnCsv').addEventListener('click', exportCSV);
$('#btnDraft').addEventListener('click', ()=>{
  if(!form.consent.checked) return alert('개인정보 동의에 체크해 주세요.');
  renderDraft();
  alert('아래 "초안 미리보기"를 확인하세요.');
});
$('#btnCopyDraft').addEventListener('click', copyDraft);
$('#btnDownloadDraft').addEventListener('click', downloadDraft);

// 인쇄
$('#btnPrint').addEventListener('click', ()=>window.print());

// ====== 우측: 챗봇 ======
const chat = {
  area: $('#chat'),
  input: $('#chatInput'),
  form: $('#chatForm'),
};

function addMsg(text, who='bot'){
  const wrap = document.createElement('div');
  wrap.className = `msg ${who}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = escapeHtml(text).replace(/\n/g,'<br>');
  wrap.appendChild(bubble);
  chat.area.appendChild(wrap);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = now();
  wrap.appendChild(meta);

  chat.area.scrollTop = chat.area.scrollHeight;
}

function escapeHtml(s){ return (s||'').replace(/[&<>"']/g,(m)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

// 간단 규칙 기반 답변
function botReply(q){
  const t = q.toLowerCase();

  // 키워드에 따른 안내 (회사 고유 정보는 넣지 않고 일반 안내로 구성)
if(/운영시간|영업시간|시간/.test(t)){
  return [
    "운영시간 안내",
    "- 평일 오전 8시부터 오후 5시까지 운영합니다.",
    "- 점심시간은 12시부터 1시까지입니다.",
    "- 주말 및 공휴일은 휴무입니다.",
    "- 실제 운영 정책은 회사 공식 홈페이지(http://www.sunjinsv.co.kr)에서 확인해 주세요.",
  ].join('\n');
}
  if(/접수|방법|어떻게/.test(t)){
    return [
      "A/S 접수 방법",
      "1) 좌측 폼에 고객/차량 정보를 입력하고 'A/S 접수요청 초안'을 생성합니다.",
      "2) 증상 사진/동영상을 첨부하면 정확도가 높아집니다.",
      "3) 초안을 복사 또는 TXT로 저장해 공식 채널에 전달해 주세요.",
    ].join('\n');
  }
  if(/누유|오일|oil/.test(t)){
    return [
      "누유 관련 안내",
      "- 누유 발생 부위(기어펌프 바디/샤프트/호스 체결부 등)를 사진으로 남겨 주세요.",
      "- 주행/작동 중 재현 조건, 최근 정비 이력, 누유량(방울/흔적)을 적어 주세요.",
      "- 안전을 위해 오염 부위를 즉시 닦고, 심할 경우 운행을 중지해 주세요.",
    ].join('\n');
  }
  if(/자연\s*하강|실린더/.test(t)){
    return [
      "실린더 자연하강 점검",
      "- 하부 누유/밸브 씰 상태, 라인 압력 저하 여부를 확인합니다.",
      "- 하중/작업 조건, 시간당 하강량을 기록해 주세요.",
      "- 영상 첨부 시 판단에 도움이 됩니다.",
    ].join('\n');
  }
  if(/진행|조회|상태/.test(t)){
    return [
      "진행 조회",
      "- 본 데모에서는 실제 조회가 되지 않습니다.",
      "- 접수번호 또는 차량번호로 공식 채널에서 확인해 주세요.",
    ].join('\n');
  }

  // 기본 답변
  return [
    "도움이 필요하신 내용을 좀 더 자세히 알려주세요 😊",
    "예) '접수 방법', '운영시간', '누유 해결', '자연 하강', '진행 조회'",
  ].join('\n');
}

function onSend(text){
  if(!text.trim()) return;
  addMsg(text,'user');
  // 응답 지연 연출
  setTimeout(()=> addMsg(botReply(text),'bot'), 300);
}

chat.form.addEventListener('submit',(e)=>{
  e.preventDefault();
  onSend(chat.input.value);
  chat.input.value = '';
});
document.querySelectorAll('.chip[data-q]').forEach(btn=>{
  btn.addEventListener('click', ()=> onSend(btn.dataset.q));
});

// 대화 내보내기/초기화
$('#btnExportChat').addEventListener('click', ()=>{
  const lines = [...document.querySelectorAll('.msg')].map(m=>{
    const who = m.classList.contains('user') ? 'USER' : 'BOT';
    const text = m.querySelector('.bubble')?.innerText || '';
    const time = m.querySelector('.meta')?.innerText || '';
    return `[${who}] ${time}\n${text}\n`;
  }).join('\n');
  const blob = new Blob([lines], {type:'text/plain;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `chat_${Date.now()}.txt`;
  a.click();
});
$('#btnClearChat').addEventListener('click', ()=>{
  if(confirm('대화를 모두 지울까요?')) $('#chat').innerHTML='';
});

// 초기 안내 출력
addMsg("안녕하세요! 선진특장 A/S 챗봇입니다.\n좌측에 정보를 입력해 초안을 만들고, 궁금한 점은 여기에서 물어보세요.\n예) '접수 방법', '운영시간', '누유 해결', '자연 하강', '진행 조회'");

// 초안 자동 갱신
['custName','phone','model','vin','plate','region','symptom','consent'].forEach(id=>{
  const el = document.getElementById(id);
  el.addEventListener('input', ()=>{ /* 실시간은 미리보기 열려있을 때만 사용자가 원할 수 있어 수동 생성 중심 */
  });
});
