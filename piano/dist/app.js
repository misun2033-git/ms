import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';

const supabase = createClient(
  'https://omeurrqouwaomzarntsq.supabase.co',
  'sb_publishable_Sa0Rdk1HSUgC8EU0QGI3sQ_wepkahfO'
);
let currentUser = null;

const notes = [
  { id:'C4', ko:'도', key:'a', freq:261.63 }, { id:'Cs4', ko:'도♯', key:'w', freq:277.18, black:true },
  { id:'D4', ko:'레', key:'s', freq:293.66 }, { id:'Ds4', ko:'레♯', key:'e', freq:311.13, black:true },
  { id:'E4', ko:'미', key:'d', freq:329.63 }, { id:'F4', ko:'파', key:'f', freq:349.23 },
  { id:'Fs4', ko:'파♯', key:'t', freq:369.99, black:true }, { id:'G4', ko:'솔', key:'g', freq:392.00 },
  { id:'Gs4', ko:'솔♯', key:'y', freq:415.30, black:true }, { id:'A4', ko:'라', key:'h', freq:440.00 },
  { id:'As4', ko:'라♯', key:'u', freq:466.16, black:true }, { id:'B4', ko:'시', key:'j', freq:493.88 },
  { id:'C5', ko:'높은 도', key:'k', freq:523.25 }
];
const song = ['C4','C4','G4','G4','A4','A4','G4','F4','F4','E4','E4','D4','D4','C4'];
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const piano = document.querySelector('#piano');
const score = document.querySelector('#score');
let recording = false, recordStarted = 0, recorded = [], practiceIndex = 0, playedCount = 0, labelsOn = true;
let playbackTimers = [];

const normalizeId = value => value.trim().toLowerCase();
const accountEmail = id => `${normalizeId(id)}@piano-class.local`;
const authMessage = message => { document.querySelector('#authMessage').textContent = message; };

async function signIn() {
  const id = normalizeId(document.querySelector('#userId').value);
  const password = document.querySelector('#password').value;
  if (!/^[a-z0-9_-]{3,24}$/.test(id)) return authMessage('아이디는 영문, 숫자, 밑줄, 하이픈으로 3자 이상 입력해 주세요.');
  authMessage('로그인 중입니다…');
  const { error } = await supabase.auth.signInWithPassword({ email: accountEmail(id), password });
  authMessage(error ? '아이디 또는 비밀번호를 확인해 주세요.' : '');
}

async function signUp() {
  const id = normalizeId(document.querySelector('#userId').value);
  const password = document.querySelector('#password').value;
  if (!/^[a-z0-9_-]{3,24}$/.test(id)) return authMessage('아이디는 영문, 숫자, 밑줄, 하이픈으로 3자 이상 입력해 주세요.');
  if (password.length < 6) return authMessage('비밀번호는 6자 이상 입력해 주세요.');
  authMessage('계정을 만들고 있습니다…');
  const { data, error } = await supabase.auth.signUp({ email: accountEmail(id), password, options: { data: { username: id } } });
  if (error) return authMessage(error.message.includes('already') ? '이미 사용 중인 아이디입니다.' : '가입하지 못했습니다. 다른 아이디로 다시 시도해 주세요.');
  authMessage(data.session ? '' : '가입이 완료되었습니다. 로그인을 눌러 시작하세요.');
}

async function loadPracticeHistory() {
  if (!currentUser) return;
  const { data, error } = await supabase.from('practice_sessions').select('id,song,notes_played,completed,practiced_at').order('practiced_at', { ascending: false }).limit(8);
  const el = document.querySelector('#practiceHistory');
  if (error) { el.innerHTML = '<p>기록을 불러오지 못했습니다.</p>'; return; }
  el.innerHTML = data.length ? data.map(row => `<article><strong>${row.completed ? '⭐' : '🎹'} ${row.song}</strong><span>${new Date(row.practiced_at).toLocaleString('ko-KR')} · ${row.notes_played}음</span></article>`).join('') : '<p>저장된 연습 기록이 아직 없어요.</p>';
}

async function savePractice(completed = false) {
  if (!currentUser) return;
  const { error } = await supabase.from('practice_sessions').insert({ user_id: currentUser.id, song: '작은 별', notes_played: playedCount, completed });
  document.querySelector('#status').textContent = error ? '기록을 저장하지 못했습니다.' : '연습 기록을 저장했어요.';
  if (!error) loadPracticeHistory();
}

supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user ?? null;
  document.querySelector('#authGate').classList.toggle('hidden', Boolean(currentUser));
  document.querySelector('.shell').classList.toggle('locked', !currentUser);
  if (currentUser) loadPracticeHistory();
});

document.querySelector('#authForm').addEventListener('submit', event => { event.preventDefault(); signIn(); });
document.querySelector('#signUpBtn').addEventListener('click', signUp);
document.querySelector('#signOutBtn').addEventListener('click', () => supabase.auth.signOut());
document.querySelector('#savePracticeBtn').addEventListener('click', () => savePractice(false));

function makePiano() {
  const whiteNotes = notes.filter(n => !n.black);
  whiteNotes.forEach(n => piano.appendChild(makeKey(n)));
  const whiteIndex = { Cs4:1, Ds4:2, Fs4:4, Gs4:5, As4:6 };
  notes.filter(n => n.black).forEach(n => {
    const el = makeKey(n);
    const i = whiteIndex[n.id];
    el.style.left = `calc(${i} * (100% / 8) - 4.3%)`;
    piano.appendChild(el);
  });
}

function makeKey(note) {
  const el = document.createElement('button');
  el.className = `key ${note.black ? 'black' : 'white'}`;
  el.dataset.note = note.id;
  el.setAttribute('aria-label', `${note.ko}, 키보드 ${note.key.toUpperCase()}`);
  el.innerHTML = `<span class="key-label">${note.ko}<small>${note.key.toUpperCase()}</small></span>`;
  el.addEventListener('pointerdown', e => { e.preventDefault(); playNote(note); });
  return el;
}

function playNote(note, track = true) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const harmonic = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const harmonicGain = audioCtx.createGain();
  osc.type = 'triangle'; harmonic.type = 'sine';
  osc.frequency.value = note.freq; harmonic.frequency.value = note.freq * 2;
  gain.gain.setValueAtTime(.32, now); gain.gain.exponentialRampToValueAtTime(.001, now + 1.4);
  harmonicGain.gain.setValueAtTime(.06, now); harmonicGain.gain.exponentialRampToValueAtTime(.001, now + .75);
  osc.connect(gain).connect(audioCtx.destination); harmonic.connect(harmonicGain).connect(audioCtx.destination);
  osc.start(now); harmonic.start(now); osc.stop(now + 1.5); harmonic.stop(now + .8);
  flashKey(note.id);
  if (!track) return;
  playedCount += 1; document.querySelector('#playedCount').textContent = Math.min(playedCount, 20);
  if (recording) recorded.push({ id: note.id, at: performance.now() - recordStarted });
  checkPractice(note.id);
}

function flashKey(id) {
  const el = document.querySelector(`[data-note="${id}"]`);
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 170);
}

function renderScore() {
  score.innerHTML = '';
  song.forEach((id, i) => {
    const chip = document.createElement('span');
    chip.className = `note-chip${i < practiceIndex ? ' done' : i === practiceIndex ? ' current' : ''}`;
    chip.textContent = notes.find(n => n.id === id).ko.replace('높은 ', '↑');
    score.appendChild(chip);
  });
  document.querySelector('#songProgress').style.width = `${practiceIndex / song.length * 100}%`;
}

function checkPractice(id) {
  const guide = document.querySelector('#guideText');
  if (id === song[practiceIndex]) {
    practiceIndex += 1;
    if (practiceIndex === song.length) {
      guide.textContent = '참 잘했어요! 작은 별 한 소절을 완성했어요 🎉';
      document.querySelector('#songProgress').style.width = '100%';
      savePractice(true);
      setTimeout(() => { practiceIndex = 0; renderScore(); guide.textContent = '한 번 더 천천히 연주해볼까요?'; }, 2200);
    } else {
      guide.textContent = `좋아요! 다음은 ${notes.find(n => n.id === song[practiceIndex]).ko}예요.`;
    }
  } else {
    guide.textContent = `${notes.find(n => n.id === song[practiceIndex]).ko}를 찾아 눌러보세요.`;
  }
  renderScore();
}

function stopPlayback() { playbackTimers.forEach(clearTimeout); playbackTimers = []; }
function playSequence(sequence, spacing) {
  stopPlayback();
  sequence.forEach((item, i) => playbackTimers.push(setTimeout(() => {
    const id = typeof item === 'string' ? item : item.id;
    playNote(notes.find(n => n.id === id), false);
  }, typeof item === 'string' ? i * spacing : item.at)));
}

document.addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const note = notes.find(n => n.key === e.key.toLowerCase());
  if (note) { e.preventDefault(); playNote(note); }
});
document.querySelector('#labelToggle').addEventListener('click', e => {
  labelsOn = !labelsOn; piano.classList.toggle('hide-labels', !labelsOn);
  e.currentTarget.classList.toggle('active', labelsOn); e.currentTarget.setAttribute('aria-pressed', labelsOn);
  e.currentTarget.textContent = labelsOn ? '계이름 켜짐' : '계이름 꺼짐';
});
document.querySelector('#tempo').addEventListener('input', e => document.querySelector('#tempoValue').textContent = e.target.value);
document.querySelector('#listenBtn').addEventListener('click', () => {
  const bpm = Number(document.querySelector('#tempo').value);
  document.querySelector('#status').textContent = `작은 별을 ${bpm} BPM으로 들려드릴게요.`;
  playSequence(song, 60000 / bpm);
});
document.querySelector('#resetPracticeBtn').addEventListener('click', () => {
  practiceIndex = 0; stopPlayback(); renderScore(); document.querySelector('#guideText').textContent = '빛나는 첫 음, 도를 눌러보세요.';
});
document.querySelector('#recordBtn').addEventListener('click', e => {
  recording = !recording;
  if (recording) { recorded = []; recordStarted = performance.now(); e.currentTarget.classList.add('recording'); e.currentTarget.innerHTML = '<span></span> 녹음 끝내기'; document.querySelector('#status').textContent = '녹음 중이에요. 편하게 연주하세요.'; }
  else { e.currentTarget.classList.remove('recording'); e.currentTarget.innerHTML = '<span></span> 녹음'; document.querySelector('#status').textContent = recorded.length ? `${recorded.length}개의 음을 녹음했어요.` : '아직 녹음된 음이 없어요.'; document.querySelector('#playBtn').disabled = !recorded.length; document.querySelector('#clearBtn').disabled = !recorded.length; }
});
document.querySelector('#playBtn').addEventListener('click', () => { document.querySelector('#status').textContent = '내 연주를 재생하고 있어요.'; playSequence(recorded); });
document.querySelector('#clearBtn').addEventListener('click', () => { stopPlayback(); recorded = []; document.querySelector('#playBtn').disabled = true; document.querySelector('#clearBtn').disabled = true; document.querySelector('#status').textContent = '녹음을 지웠어요.'; });

makePiano(); renderScore();
