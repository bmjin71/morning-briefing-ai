const GIMPO = { lat: 37.6152, lon: 126.7156 };
let latestWeather = null;
let latestNews = [];
let deferredPrompt = null;

const $ = (id) => document.getElementById(id);

function todayKey(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}

function formatKoreanDate(){
  return new Intl.DateTimeFormat('ko-KR',{dateStyle:'full'}).format(new Date());
}

function weatherLabel(code){
  const map = {
    0:'맑음',1:'대체로 맑음',2:'부분적으로 흐림',3:'흐림',
    45:'안개',48:'서리 안개',51:'약한 이슬비',53:'이슬비',55:'강한 이슬비',
    61:'약한 비',63:'비',65:'강한 비',71:'약한 눈',73:'눈',75:'강한 눈',
    80:'소나기',81:'소나기',82:'강한 소나기',95:'뇌우',96:'우박 가능 뇌우',99:'강한 뇌우'
  };
  return map[code] || '날씨';
}

async function loadWeather(){
  $('weatherStatus').textContent = '김포 날씨를 불러오는 중입니다...';
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${GIMPO.lat}&longitude=${GIMPO.lon}&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&forecast_days=1`;
    const r = await fetch(url);
    if(!r.ok) throw new Error('weather');
    const data = await r.json();
    latestWeather = data;
    $('temp').textContent = `${Math.round(data.current.temperature_2m)}°`;
    $('maxTemp').textContent = `${Math.round(data.daily.temperature_2m_max[0])}°`;
    $('minTemp').textContent = `${Math.round(data.daily.temperature_2m_min[0])}°`;
    $('rain').textContent = `${Math.round(data.daily.precipitation_probability_max[0] ?? 0)}%`;
    $('weatherStatus').textContent = `${weatherLabel(data.current.weather_code)} · 체감 ${Math.round(data.current.apparent_temperature)}°`;
    $('weatherBox').classList.remove('hidden');
  }catch(e){
    $('weatherStatus').textContent = '날씨를 불러오지 못했습니다. 인터넷 연결을 확인해주세요.';
  }
}

async function loadNews(){
  $('newsStatus').textContent = '주요 뉴스를 불러오는 중입니다...';
  $('newsList').innerHTML = '';
  try{
    const rss = encodeURIComponent('https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko');
    const url = `https://api.rss2json.com/v1/api.json?rss_url=${rss}`;
    const r = await fetch(url);
    if(!r.ok) throw new Error('news');
    const data = await r.json();
    if(!data.items || !data.items.length) throw new Error('empty');
    latestNews = data.items.slice(0,5);
    $('newsStatus').textContent = '한국 주요뉴스 5건';
    latestNews.forEach(item=>{
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = item.link;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = item.title;
      li.appendChild(a);
      $('newsList').appendChild(li);
    });
  }catch(e){
    latestNews = [];
    $('newsStatus').textContent = '뉴스 자동 불러오기가 제한되었습니다. 아래 버튼으로 최신 뉴스를 확인하세요.';
  }
}

function getSchedules(){
  const all = JSON.parse(localStorage.getItem('morningSchedules') || '{}');
  return all[todayKey()] || [];
}

function saveSchedules(list){
  const all = JSON.parse(localStorage.getItem('morningSchedules') || '{}');
  all[todayKey()] = list;
  localStorage.setItem('morningSchedules', JSON.stringify(all));
}

function renderSchedules(){
  const list = getSchedules().sort((a,b)=>a.time.localeCompare(b.time));
  $('scheduleList').innerHTML = '';
  if(!list.length){
    const li = document.createElement('li');
    li.innerHTML = '<span class="muted">등록된 일정이 없습니다.</span>';
    $('scheduleList').appendChild(li);
    return;
  }
  list.forEach((item, idx)=>{
    const li = document.createElement('li');
    li.innerHTML = `<time>${item.time}</time><span class="title">${escapeHtml(item.title)}</span><button class="delete-btn" data-idx="${idx}">삭제</button>`;
    $('scheduleList').appendChild(li);
  });
  document.querySelectorAll('.delete-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const list = getSchedules().sort((a,b)=>a.time.localeCompare(b.time));
      list.splice(Number(btn.dataset.idx),1);
      saveSchedules(list);
      renderSchedules();
    });
  });
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function buildBriefing(){
  const parts = ['좋은 아침입니다.'];
  if(latestWeather){
    parts.push(`오늘 김포 날씨는 ${weatherLabel(latestWeather.current.weather_code)}, 현재 ${Math.round(latestWeather.current.temperature_2m)}도, 최고 ${Math.round(latestWeather.daily.temperature_2m_max[0])}도, 최저 ${Math.round(latestWeather.daily.temperature_2m_min[0])}도입니다.`);
    const rain = Math.round(latestWeather.daily.precipitation_probability_max[0] ?? 0);
    if(rain >= 50) parts.push(`강수확률은 ${rain}퍼센트로 우산을 챙기는 것이 좋겠습니다.`);
  }
  if(latestNews.length){
    parts.push('주요 뉴스입니다.');
    latestNews.slice(0,3).forEach((n,i)=>parts.push(`${i+1}번째, ${n.title}.`));
  } else {
    parts.push('뉴스는 Google 뉴스에서 확인할 수 있습니다.');
  }
  const schedules = getSchedules().sort((a,b)=>a.time.localeCompare(b.time));
  if(schedules.length){
    parts.push('오늘 일정입니다.');
    schedules.forEach(s=>parts.push(`${s.time}, ${s.title}.`));
  } else {
    parts.push('오늘 등록된 일정은 없습니다.');
  }
  parts.push('오늘도 좋은 하루 보내세요.');
  return parts.join(' ');
}

function speakBriefing(){
  if(!('speechSynthesis' in window)){
    alert('이 브라우저에서는 음성 읽기를 지원하지 않습니다.');
    return;
  }
  window.speechSynthesis.cancel();
  const text = buildBriefing();
  $('briefingText').textContent = text;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ko-KR';
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

$('scheduleForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const time = $('scheduleTime').value;
  const title = $('scheduleTitle').value.trim();
  if(!time || !title) return;
  const list = getSchedules();
  list.push({time,title});
  saveSchedules(list);
  $('scheduleTitle').value = '';
  renderSchedules();
});

$('speakBtn').addEventListener('click', speakBriefing);
$('stopBtn').addEventListener('click', ()=>window.speechSynthesis?.cancel());
$('refreshBtn').addEventListener('click', async ()=>{
  await Promise.all([loadWeather(), loadNews()]);
  $('briefingText').textContent = '최신 정보로 새로고침했습니다. 브리핑 듣기를 눌러주세요.';
});

window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  $('installBtn').classList.remove('hidden');
});
$('installBtn').addEventListener('click', async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('installBtn').classList.add('hidden');
});

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>navigator.serviceWorker.register('./sw.js'));
}

$('todayText').textContent = formatKoreanDate();
renderSchedules();
Promise.all([loadWeather(), loadNews()]);
