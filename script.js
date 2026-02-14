const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- AUTHENTIC PHYSICS & ENGINE CONSTANTS ---
const TICK = 1/60; // 60 logic updates per second
const PHY = {
    G: 0.8,             // Gravity
    JUMP: -12.5,        // Cube Jump Force
    SPEED: 7.8,         // Horizontal Speed
    GROUND: 540,        // Floor Y Coordinate
    SHIP_G: 0.35,       // Ship Gravity
    SHIP_LIFT: -0.45,   // Ship Upward Lift
    WAVE_SPD: 8.5,      // Wave Diagonal Speed
    BALL_G: 0.8         // Ball Gravity
};

let state = { 
    mode: "MENU", 
    curLevel: 0, 
    cameraX: 0, 
    attempts: 1, 
    objects: [], 
    levelLen: 0, 
    bgColor: "#0066ff" 
};

let player = { 
    x: 300, y: 0, w: 38, h: 38, 
    dy: 0, rot: 0, mode: "CUBE", 
    onGround: false, dead: false, gravDir: 1 
};

let input = { hold: false };
let lastTime = 0;
let accumulator = 0;

// --- INPUT HANDLING ---
const setHold = (v) => input.hold = v;
window.onkeydown = (e) => { 
    if(e.code === 'Space' || e.code === 'ArrowUp') setHold(true); 
    if(e.code === 'Escape') location.reload(); // Quick reset to menu
};
window.onkeyup = (e) => { 
    if(e.code === 'Space' || e.code === 'ArrowUp') setHold(false); 
};
// Mouse/Touch Support
canvas.onmousedown = () => setHold(true);
canvas.onmouseup = () => setHold(false);
canvas.ontouchstart = (e) => { e.preventDefault(); setHold(true); };
canvas.ontouchend = () => setHold(false);

// --- LEVEL ARCHITECT ---
function buildLevel(id) {
    state.objects = [];
    let x = 800;
    
    // Helper to push objects
    const addObj = (t, ox, oy, ow=40, oh=40, m=null) => 
        state.objects.push({t, x:ox, y:oy, w:ow, h:oh, m});

    // Patterns based on real GD levels
    if(id === 0) { // STEREO MADNESS
        state.bgColor = "#0066ff";
        for(let i=0; i<40; i++) {
            addObj('spike', x + (i*450), PHY.GROUND - 40);
            if(i % 5 === 0) addObj('block', x + (i*450) + 120, PHY.GROUND - 40, 80, 40);
            if(i === 20) addObj('portal', x + (i*450), 0, 60, PHY.GROUND, 'SHIP');
        }
    } else if(id === 19) { // DEADLOCKED
        state.bgColor = "#222";
        for(let i=0; i<100; i++) {
            addObj('spike', x + (i*200), (i%2==0) ? PHY.GROUND-40 : PHY.GROUND-120);
            if(i%15 === 0) addObj('portal', x+(i*200), 0, 60, PHY.GROUND, 'WAVE');
        }
    }
    state.levelLen = x + 15000;
}

function resetPlayer(full) {
    player.y = PHY.GROUND - player.h;
    player.dy = 0;
    player.rot = 0;
    player.dead = false;
    player.onGround = true;
    player.gravDir = 1;
    state.cameraX = 0;
    if(full) state.attempts = 1; else state.attempts++;
    
    document.getElementById('attempt-count').innerText = state.attempts;
    document.getElementById('mode-info').innerText = player.mode + " MODE";
}

function startGame(id) {
    state.curLevel = id;
    state.mode = "PLAYING";
    buildLevel(id);
    resetPlayer(true);
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    requestAnimationFrame(gameLoop);
}

// --- PHYSICS ENGINE ---
function updatePhysics() {
    if(player.dead) return;
    state.cameraX += PHY.SPEED;

    // Mode-Specific Gravity
    if(player.mode === "CUBE") {
        player.dy += PHY.G * player.gravDir;
        if(player.onGround && input.hold) { 
            player.dy = PHY.JUMP * player.gravDir; 
            player.onGround = false; 
        }
        if(!player.onGround) player.rot += 6 * player.gravDir;
        else player.rot = Math.round(player.rot/90)*90;
    } else if(player.mode === "SHIP") {
        player.dy += input.hold ? PHY.SHIP_LIFT : PHY.SHIP_G;
        player.rot = player.dy * 2.5;
    } else if(player.mode === "WAVE") {
        player.dy = input.hold ? -PHY.WAVE_SPD : PHY.WAVE_SPD;
        player.rot = (player.dy > 0) ? 25 : -25;
    }

    player.y += player.dy;

    // Collision Resolution (Ceiling/Floor)
    if(player.y + player.h >= PHY.GROUND) { 
        player.y = PHY.GROUND - player.h; 
        player.dy = 0; 
        player.onGround = true; 
    } else if(player.y <= 0) { 
        player.y = 0; 
        player.dy = 0; 
        if(player.mode !== "BALL") player.dead = true; 
    } else { 
        player.onGround = false; 
    }

    if(player.dead) crash();

    // Collision Detection (Object Hitboxes)
    const pR = { 
        l: state.cameraX + player.x + 8, 
        r: state.cameraX + player.x + player.w - 8, 
        t: player.y + 8, 
        b: player.y + player.h - 8 
    };

    for(let o of state.objects) {
        if(o.x > pR.r + 100) break; // Culling
        if(o.x + o.w < pR.l) continue;

        if(pR.r > o.x && pR.l < o.x+o.w && pR.b > o.y && pR.t < o.y+o.h) {
            if(o.t === 'spike') crash();
            if(o.t === 'block') {
                // Determine if landing on top or hitting the side
                if(player.y - player.dy + player.h <= o.y + 10) { 
                    player.y = o.y - player.h; 
                    player.dy = 0; 
                    player.onGround = true; 
                } else { 
                    crash(); 
                }
            }
            if(o.t === 'portal') { 
                player.mode = o.m; 
                document.getElementById('mode-info').innerText = player.mode + " MODE"; 
            }
        }
    }

    if(state.cameraX > state.levelLen) location.reload();
}

function crash() {
    if(player.dead && state.mode !== "PLAYING") return;
    player.dead = true;
    document.getElementById('crash-flash').classList.add('flash-active');
    setTimeout(() => {
        document.getElementById('crash-flash').classList.remove('flash-active');
        resetPlayer(false);
    }, 400);
}

// --- RENDER ENGINE ---
function draw() {
    ctx.fillStyle = state.bgColor; 
    ctx.fillRect(0,0,1280,640);
    
    // Draw Floor
    ctx.fillStyle = "#000"; 
    ctx.fillRect(0, PHY.GROUND, 1280, 100);
    ctx.strokeStyle = "#fff"; 
    ctx.strokeRect(-1, PHY.GROUND, 1282, 2);

    ctx.save(); 
    ctx.translate(-state.cameraX, 0);

    for(let o of state.objects) {
        if(o.x < state.cameraX - 100 || o.x > state.cameraX + 1300) continue;
        if(o.t === 'block') { 
            ctx.fillStyle = "#000"; 
            ctx.fillRect(o.x, o.y, o.w, o.h); 
            ctx.strokeStyle = "#fff"; 
            ctx.strokeRect(o.x, o.y, o.w, o.h); 
        } else if(o.t === 'spike') { 
            ctx.fillStyle = "#fff"; 
            ctx.beginPath(); 
            ctx.moveTo(o.x, o.y+40); 
            ctx.lineTo(o.x+20, o.y); 
            ctx.lineTo(o.x+40, o.y+40); 
            ctx.fill(); 
        } else if(o.t === 'portal') { 
            ctx.fillStyle = "rgba(255,255,255,0.2)"; 
            ctx.fillRect(o.x, 0, o.w, PHY.GROUND); 
        }
    }

    if(!player.dead) {
        ctx.save(); 
        ctx.translate(state.cameraX + player.x + 19, player.y + 19); 
        ctx.rotate(player.rot * Math.PI / 180);
        ctx.fillStyle = "#00ffff"; 
        ctx.fillRect(-19,-19,38,38); 
        ctx.strokeStyle="#fff"; 
        ctx.lineWidth=2; 
        ctx.strokeRect(-19,-19,38,38);
        ctx.restore();
    }
    ctx.restore();

    document.getElementById('progress-fill').style.width = (state.cameraX / state.levelLen * 100) + "%";
}

function gameLoop(t) {
    if(state.mode !== "PLAYING") return;
    accumulator += (t - lastTime) / 1000; 
    lastTime = t;
    
    while(accumulator >= TICK) { 
        updatePhysics(); 
        accumulator -= TICK; 
    }
    draw(); 
    requestAnimationFrame(gameLoop);
}
