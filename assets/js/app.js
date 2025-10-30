const elements = {
  mainScreen: document.getElementById("main-screen"),
  configScreen: document.getElementById("config-screen"),
  time: document.getElementById("time"),
  status: document.getElementById("status"),
  exerciseCount: document.getElementById("exercise-count"),
  intervalCount: document.getElementById("interval-count"),
  playBtn: document.getElementById("play-btn"),
  pauseBtn: document.getElementById("pause-btn"),
  configBtn: document.getElementById("config-btn"),
  backBtn: document.getElementById("back-btn"),
  configForm: document.getElementById("config-form"),
  resetBtn: document.getElementById("reset-btn"),
};

const configFields = ["warmup","start-delay","work","rest","cooldown","exercises","intervals"];
let timer, currentPhase, timeLeft, exercise, interval, isRunning = false;
let config = loadConfig();

let wakeObj = null;
let ctx = null;

const audio = new Audio('assets/sounds/fondo.mp3');


function loadConfig() {
  const defaults = {
    warmup: 0,
    "start-delay": 3,
    work: 20,
    rest: 10,
    cooldown: 0,
    exercises: 8,
    intervals: 1
  };
  return JSON.parse(localStorage.getItem("tabataConfig")) || defaults;
}

function saveConfig() {
  localStorage.setItem("tabataConfig", JSON.stringify(config));
}

function showScreen(screen) {
  elements.mainScreen.classList.toggle("active", screen === "main");
  elements.configScreen.classList.toggle("active", screen === "config");
}

function initializeAudio(){
  if(ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  console.log('audio inicializado!');
}

function beep(frequency = 800, duration = 150) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration / 1000);
  osc.stop(ctx.currentTime + duration / 1000);
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  exercise = 1;
  interval = 1;
  currentPhase = "warmup";
  initializeAudio();
  blockScreen()
  startPhase(config.warmup > 0 ? "warmup" : "start-delay");
  audio.play().then(r => console.info('bg music started'));
}

function startPhase(phase) {
  currentPhase = phase;
  switch (phase) {
    case "warmup":
      setPhase("Entrada en calor", config.warmup, "start-delay");
      break;
    case "start-delay":
      setPhase("Preparado", config["start-delay"], "work");
      break;
    case "work":
      setPhase("Ejercicio", config.work, "rest");
      break;
    case "rest":
      setPhase("Descanso", config.rest, "nextExercise");
      break;
    case "cooldown":
      setPhase("Enfriamiento", config.cooldown, "done");
      break;
  }
}


function nextExercise() {
  if (exercise < config.exercises) {
    exercise++;
    startPhase("work");
  } else if (interval < config.intervals) {
    interval++;
    exercise = 1;
    startPhase("cooldown"); // descanso entre intervalos
  } else {
    startPhase("cooldown");
  }
}

function updateDisplay() {
    elements.time.textContent = String(timeLeft).padStart(2, "0");
    elements.exerciseCount.textContent = exercise;
    elements.intervalCount.textContent = interval;
}

function pauseTimer() {
    if (!isRunning) return;
    clearInterval(timer);
    isRunning = false;
}

function resetTimer() {
    releaseScreen();
    clearInterval(timer);
    isRunning = false;
    exercise = 0;
    interval = 0;
    elements.status.textContent = "Preparado";
    elements.time.textContent = "00";
    elements.exerciseCount.textContent = "0";
    elements.intervalCount.textContent = "0";
   
    updateProgressTime(0);
    elements.mainScreen.className = "card active";
    audio.pause()
    audio.currentTime = 0;
}


function finish() {
  releaseScreen()
  elements.mainScreen.className = "card active done";
  elements.status.textContent = "¡Completado!";
  elements.time.textContent = "00";
  beep(1200);
  isRunning = false;
  audio.pause()
  audio.currentTime = 0;
}


function updateProgressTime(percent) {
  const progress = 565.5 - (percent * 565.5);
  const circle = document.getElementById('progressbar');
  circle.style.strokeDashoffset = progress;
}


function setPhase(label, duration, nextPhase) {
    // limpiar clases visuales previas
    let beepVolume = 1500;
    elements.mainScreen.className = "card active";
    elements.mainScreen.classList.add(currentPhase);

    elements.mainScreen.classList.add("pulse");
    setTimeout(() => elements.mainScreen.classList.remove("pulse"), 800);


    if (duration <= 0) return nextPhase === "done" ? finish() : startPhase(nextPhase);
    elements.status.textContent = label;
    timeLeft = duration;
    const totalTime = duration;
    updateProgressTime(0);
    updateDisplay();
    clearInterval(timer);
    beep(beepVolume); // inicio de fase
    timer = setInterval(() => {
         timeLeft--;
        const percent = (totalTime - timeLeft) / totalTime;
        updateProgressTime(percent);
       
        updateDisplay();
        if (timeLeft < 4 && timeLeft > 0) {
          beep(beepVolume); // preaviso
          beepVolume -= 200;
        }
        if (timeLeft <= 0) {
            clearInterval(timer);
            
            if (nextPhase === "nextExercise") nextExercise();
            else if (nextPhase === "done") finish();
            else startPhase(nextPhase);
        }
    }, 1000);
}


elements.playBtn.addEventListener("click", startTimer);
elements.pauseBtn.addEventListener("click", pauseTimer);
elements.configBtn.addEventListener("click", () => {
  if(isRunning)return;
  showScreen("config");
  configFields.forEach(f => document.getElementById(f).value = config[f]);
});
elements.backBtn.addEventListener("click", () => showScreen("main"));

elements.configForm.addEventListener("submit", e => {
  e.preventDefault();
  configFields.forEach(f => config[f] = Number(document.getElementById(f).value));
  saveConfig();
  showScreen("main");
});

elements.resetBtn.addEventListener("click", resetTimer);

async function blockScreen() {
  try{
    if(wakeObj) return;
    wakeObj = await navigator.wakeLock.request('screen');
    console.log('se activo el bloqueo de pantalla')
  } catch (error) {
    console.error('No se pudio: ' +  error);
  }
}

async function releaseScreen() {
  try{
    if(wakeObj){
        await wakeObj.release();
        wakeObj = null;
        console.log('se desbloqueo la pantalla');
    }
  } catch (error) {
    console.error('No se pudio: ' +  error);
  }
}

// === DETECTOR DE NUEVAS VERSIONES DEL SERVICE WORKER ===
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Si el SW cambia (hay versión nueva)
    const notice = document.createElement('div');
    notice.innerHTML = `
      <div style="
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: #007bff;
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        font-size: 0.95em;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      ">
        🔄 Nueva versión disponible 
        <button id="update-btn" style="
          background: white;
          color: #007bff;
          border: none;
          padding: 5px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        ">Actualizar</button>
      </div>
    `;
    document.body.appendChild(notice);

    document.getElementById('update-btn').addEventListener('click', () => {
      window.location.reload(true);
    });
  });
}


