'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const FAST_SPEED = 0.6;
const SLOW_SPEED = 0.08;
const BRAKING = 4;
const RESPAWN_DELAY = 800;
const PIECE_SPEED = 120;
const PIECE_SPIN = 1.5;
const GRAVITY = 500;
const PIECE_LIFE = 1;
const GOOD_CUT = 45;
const LABEL_LIFE = 1.2;
const ROUND_TIME = 60;
const RESTART_DELAY = 1;
const SHAPE_SIZE = 60;
const NEXT_LEVEL_DELAY = 2;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'black';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function fitToCircle(points){
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of points){
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    }
    const midX = (minX + maxX) /2;
    const midY = (minY + maxY) /2;

    let furthest = 0;
    for(const [x, y] of points){
        furthest = Math.max(furthest, Math.hypot(x - midX, y - midY));
    }
    return points.map(([x, y]) => ({x: (x - midX) / furthest, y: (y - midY) / furthest }));
}

function regularPolygon(corners) {
    const points = [];
    for(let i =0; i < corners; i++){
        const angle = (i/corners) * Math.PI * 2;
        points.push([Math.cos(angle), Math.sin(angle)]);
    }
    return points;
}

function starShape(spikes, dip){
    const points = [];
    for (let i = 0; i< spikes * 2; i++){
        const angle = (i / (spikes * 2)) * Math.PI * 2;
        const distance = i % 2 === 0? 1: dip;
        points.push([Math.cos(angle) * distance, Math.sin(angle) * distance]);
    }
    return points;
}

function heartShape() {
    const points = [];
    for (let i = 0; i<48; i++){
        const t = (i / 48) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = -(13 * Math.cos(t) -5 * Math.cos(2*t) - 2* Math.cos(3*t) - Math.cos(4 *t));
        points.push([x, y]);
    }
    return points;
}

const REGULAR_SHAPES = [
    { name: 'circle',    color: '#3fa7d6', points: fitToCircle(regularPolygon(48)) },
    { name: 'triangle',  color: '#f2c14e', points: fitToCircle(regularPolygon(3)) },
    { name: 'square',    color: '#e4572e', points: fitToCircle(regularPolygon(4)) },
    { name: 'rectangle', color: '#8e6ccf', points: fitToCircle([[0, 0], [2, 0], [2, 1], [0, 1]]) },
    { name: 'pentagon',  color: '#4cb944', points: fitToCircle(regularPolygon(5)) },
    { name: 'hexagon',   color: '#f78ca2', points: fitToCircle(regularPolygon(6)) },
];

const IRREGULAR_SHAPES = [
    { name: 'star',      color: '#ffd23f', points: fitToCircle(starShape(5, 0.45)) },
    { name: 'heart',     color: '#e63946', points: fitToCircle(heartShape()) },
    { name: 'arrow',     color: '#3fa7d6', points: fitToCircle([[0, 1], [4, 1], [4, 0], [6, 2], [4, 4], [4, 3], [0, 3]]) },
    { name: 'lightning', color: '#f2c14e', points: fitToCircle([[3, 0], [0, 5], [2, 5], [1, 9], [5, 3], [3, 3], [4.5, 0]]) },
    { name: 'cross',     color: '#4cb944', points: fitToCircle([[1, 0], [2, 0], [2, 1], [3, 1], [3, 2], [2, 2], [2, 3], [1, 3], [1, 2], [0, 2], [0, 1], [1, 1]]) },
    { name: 'L-shape',   color: '#8e6ccf', points: fitToCircle([[0, 0], [1, 0], [1, 2], [2, 2], [2, 3], [0, 3]]) },
];

let level = 1;
let passed = false;

function levelTarget() {
    return 4 + level;
}

function levelRadius() {
    return Math.max(36, SHAPE_SIZE - (level - 1) * 4);
}

function levelSlowSpeed() {
    return SLOW_SPEED * (1 + (level - 1) * 0.2);
}

function pickDesign() {
    let list;
    if(level <= 2){
        list = REGULAR_SHAPES;
    } else if (level <= 4){
        list = Math.random() < 0.5 ? REGULAR_SHAPES : IRREGULAR_SHAPES;

    } else {
        list = Math.random() < 0.75 ? IRREGULAR_SHAPES : REGULAR_SHAPES;
    }
    return list[Math.floor(Math.random() * list.length)];
}

function drawLevel() {
    const x = canvas.width / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(40, 20, 5, 0.85)';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeText('LEVEL', x, 20);
    ctx.fillStyle = '#f3e6d3';
    ctx.fillText('LEVEL', x, 20);
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeText(String(level), x, 40);
    ctx.fillText(String(level), x, 40);
    const goal = 'Goal ' + levelTarget();
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeText(goal, x, 94);
    ctx.fillStyle = score >= levelTarget() ? '#7ee081' : '#f3e6d3';
    ctx.fillText(goal, x, 94);
    ctx.restore();
}

function traceShape(points, centerX, centerY){
    ctx.beginPath();
    ctx.moveTo(centerX + points[0].x, centerY + points[0].y);
    for (let i = 1; i < points.length; i++){
        ctx.lineTo(centerX + points[i].x, centerY + points[i].y);
    }
    ctx.closePath();
}
const line = {
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    isDrawing: false,
    visible: false,
};

let hideTimer = null

canvas.addEventListener('pointerdown', (e) => {
    startAudio();

    if (gameState === 'menu') return;

    if (gameState === 'over'){
        if (overTime > RESTART_DELAY) restartGame();
        return;
    }
    clearTimeout(hideTimer);
    line.isDrawing = true;
    line.startX = e.offsetX;
    line.startY = e.offsetY;
    line.endX = e.offsetX;
    line.endY = e.offsetY;
    line.visible = true;
});

canvas.addEventListener('pointermove', (e) => {
    if (!line.isDrawing) return;
    line.endX = e.offsetX;
    line.endY = e.offsetY;
});

function finishLine() {
    if (!line.isDrawing) return;
    line.isDrawing = false;

    if (shape.alive && lineCutsShape()){
        cutShape();
    }

    hideTimer = setTimeout(() => {
        line.visible = false;
    }, 500);
}

canvas.addEventListener('pointerup', finishLine);
canvas.addEventListener('pointerleave', finishLine);

function drawLine() {
    if (!line.visible) return;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(line.startX, line.startY);
    ctx.lineTo(line.endX, line.endY);
    ctx.stroke();
}

const shape = {
    x: 0,
    y: 0,
    radius: SHAPE_SIZE,
    speed: FAST_SPEED,
    color: '#3fa7d6',
    name: '',
    points: [],
    dirX: 1,
    dirY: 0,
    span: 0,
    travelled: 0,
    alive: true,
};

function resetShape() {
    shape.radius = levelRadius();
    const design = pickDesign();
    const turn = Math.random() * Math.PI * 2;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);

    shape.name = design.name;
    shape.color = design.color;
    shape.points = design.points.map((p) => ({
        x: (p.x * cos - p.y * sin) * shape.radius,
        y: (p.x * sin + p.y * cos) * shape.radius,
    }));

    const entry = Math.floor(Math.random() * 4);
    if (entry === 0) {
        shape.x = -shape.radius;
        shape.y = canvas.height * (0.2 + Math.random() * 0.6);
        shape.dirX = 1;
        shape.dirY = 0;
    } else if (entry === 1){
        shape.x = canvas.width + shape.radius;
        shape.y = canvas.height * (0.2 + Math.random() * 0.6);
        shape.dirX = -1;
        shape.dirY = 0;
    } else if (entry === 2){
        shape.x = canvas.width * (0.2 + Math.random() * 0.6);
        shape.y = -shape.radius;
        shape.dirX = 0;
        shape.dirY = 1;
    } else {
        shape.x = canvas.width * (0.2 + Math.random() * 0.6);
        shape.y = canvas.height + shape.radius;
        shape.dirX = 0;
        shape.dirY = -1;
    }
    shape.span = shape.dirX !== 0 ?canvas.width : canvas.height;
    shape.travelled = 0;
    shape.speed = FAST_SPEED;
    shape.alive = true;
}
resetShape();

function updateShape(dt) {
    if (!shape.alive) return;
    
    if (shape.travelled > shape.radius * 2) {
        shape.speed += (levelSlowSpeed() - shape.speed) * Math.min(1, BRAKING * dt);

    }
    const step = shape.speed * shape.span * dt;
    shape.x += shape.dirX * step;
    shape.y += shape.dirY * step;
    shape.travelled += step;
    const offScreen = 
        shape.x + shape.radius < 0 ||
        shape.x - shape.radius > canvas.width ||
        shape.y + shape.radius < 0 ||
        shape.y - shape.radius > canvas.height;

    if (shape.travelled > shape.radius * 2 && offScreen){
        missShape();
        resetShape();
    }
}

function drawShape() {
    if (!shape.alive) return;

    ctx.fillStyle = shape.color;
    traceShape(shape.points, shape.x, shape.y);
    ctx.fill();
}

function lineCrossings() {
    const dx = line.endX - line.startX;
    const dy = line.endY - line.startY;
    const crossings = [];

    for (let i = 0; i < shape.points.length; i++){
        const corner = shape.points[i];
        const next = shape.points[(i + 1) % shape.points.length];
        const ax = shape.x + corner.x;
        const ay = shape.y+ corner.y;
        const ex = next.x - corner.x;
        const ey = next.y - corner.y;
        const denom = dx * ey - dy * ex;
        if(denom === 0) continue;

        const wx = ax - line.startX;
        const wy = ay - line.startY;
        const alongLine = (wx * ey - wy * ex)/ denom;
        const alongEdge = (wx * dy - wy * dx) / denom;
        if (alongEdge >= 0 && alongEdge < 1) {
            crossings.push(alongLine);
        }
    }
    return crossings;
}

function lineCutsShape() {
    const crossings = lineCrossings();
    if (crossings.length === 0) return false;
    const first = Math.min(...crossings);
    const last = Math.max(...crossings);
    return first > 0 && last < 1;
}

let respawnTimer = null;

function cutShape() {
    const result = measureCut();
    showRatio(result);
    changeScore(result.small >= GOOD_CUT ? 1 : -1);

    playCutSound();
    if (result.small >= GOOD_CUT){
        playGoodSound();
        showFlash('good');
    } else {
        playBadSound();
        showFlash('bad');
        shakeScreen();
    }

    if (result.small === 50) {
        showPerfect(shape.x, shape.y + shape.radius + 30);
    }

    splitShape();
    shape.alive = false;
    respawnTimer = setTimeout(resetShape, RESPAWN_DELAY);

    if (score >= levelTarget()) {
        endRound();
    }
}

const pieces = [];

function splitShape() {
    const length = Math.hypot(line.endX - line.startX, line.endY - line.startY);
    const dirX = (line.endX - line.startX) / length;
    const dirY = (line.endY - line.startY) / length;
    const normalX = -dirY;
    const normalY = dirX;

    const toStartX = line.startX - shape.x;
    const toStartY = line.startY - shape.y;
    const along = -(toStartX * dirX + toStartY * dirY);
    const cutX = toStartX + dirX * along;
    const cutY = toStartY + dirY * along;

    for (const side of [1, -1]) {
        pieces.push({
            x: shape.x,
            y: shape.y,
            radius: shape.radius,
            color: shape.color,
            points: shape.points,
            side: side,
            cutX: cutX,
            cutY: cutY,
            dirX: dirX,
            dirY: dirY,
            normalX: normalX,
            normalY: normalY,
            vx: shape.dirX * shape.speed * shape.span + normalX * side * PIECE_SPEED,
            vy: shape.dirY * shape.speed * shape.span + normalY * side * PIECE_SPEED,
            angle: 0,
            spin: side * PIECE_SPIN,
            life: PIECE_LIFE,
        });
    }
}

function updatePieces(dt) {
    for (const piece of pieces) {
        piece.vy += GRAVITY * dt;
        piece.x += piece.vx * dt;
        piece.y += piece.vy* dt;
        piece.angle += piece.spin * dt;
        piece.life -= dt;
    }

    for (let i = pieces.length - 1; i >= 0; i--) {
        if (pieces[i].life <=0) {
            pieces.splice(i, 1);
        } 
    }
}

function drawPieces() {
    for (const piece of pieces){
        const { cutX, cutY, dirX, dirY, normalX, normalY, side } = piece;
        const big = piece.radius * 3;
        ctx.save();
        ctx.globalAlpha = Math.max(0, piece.life / PIECE_LIFE);
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.angle);

        ctx.beginPath();
        ctx.moveTo(cutX - dirX * big, cutY - dirY * big);
        ctx.lineTo(cutX + dirX * big, cutY + dirY * big);
        ctx.lineTo(cutX + dirX * big + normalX * side * big, cutY + dirY * big + normalY * side * big);
        ctx.lineTo(cutX - dirX * big + normalX * side * big, cutY - dirY * big + normalY * side * big);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = piece.color;
        traceShape(piece.points, 0, 0);
        ctx.fill();
        ctx.clip(); // now drawing is also limited to the circle
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(cutX - dirX * big, cutY - dirY * big);
        ctx.lineTo(cutX + dirX * big, cutY + dirY * big);
        ctx.stroke();
        ctx.restore();
    }
}

function sideOfLine(px, py) {
    return (line.endX - line.startX) * (py - line.startY) - (line.endY - line.startY) * (px - line.startX);
}

function polygonArea(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points [(i + 1) % points.length];
        sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
}

function partOnOneSide(points) {
    const part = [];
    for (let i = 0; i < points.length; i++){
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const sideA = sideOfLine(a.x, a.y);
        const sideB = sideOfLine(b.x, b.y);

        if (sideA >= 0) {
            part.push(a);
        }
        if ((sideA >= 0) !== (sideB >= 0)) {
            const t = sideA / (sideA - sideB);
            part.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
    }
    return part;
}

function measureCut() {
    const points = shape.points.map((p) => ({ x: shape.x + p.x, y: shape.y + p.y }));
    const total = polygonArea(points);
    const oneSide = polygonArea(partOnOneSide(points));
    const smaller = Math.min(oneSide, total - oneSide);
    const small = Math.round((smaller / total) * 100);
    return { small: small, big: 100 - small };
}

const labels = [];

function showRatio(result) {
    labels.push({
        text: result.small + ' / ' + result.big,
        good: result.small >= GOOD_CUT,
        x: shape.x,
        y: shape.y - shape.radius - 20,
        life: LABEL_LIFE,
    });
}

function updateLabels(dt) {
    for (const label of labels) {
        label.y -= 40 * dt;
        label.life -= dt;
    }

    for (let i = labels.length - 1; i>= 0; i--) {
        if (labels[i].life <= 0) {
            labels.splice(i, 1);
        }
    }
}

function drawLabels() {
    ctx.save();
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const label of labels) {
        ctx.globalAlpha = Math.max(0, Math.min(1, label.life / 0.4));
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(40,20, 5, 0.85)';
        ctx.strokeText(label.text, label.x, label.y);
        ctx.fillStyle = label.good ? '#7ee081' : '#ff7b6b';
        ctx.fillText(label.text, label.x, label.y);
    }
    ctx.restore();
}

let score = 0;
let scoreFlash = 0;
let scoreFlashGood = true;

function changeScore(amount) {
    score += amount;
    scoreFlash = 0.5;
    scoreFlashGood = amount > 0;
}

function missShape() {
    changeScore(-1);
    playMissSound();
    showFlash('bad');
    shakeScreen();
    labels.push({
        text: 'Missed',
        good: false,
        x: Math.min(Math.max(shape.x, 80), canvas.width - 80),
        y: Math.min(Math.max(shape.y, 150), canvas.height - 30),
        life: LABEL_LIFE,
    });
}

function updateScore(dt) {
    scoreFlash = Math.max(0, scoreFlash -dt);
}

function drawScore() {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(40, 20, 5, 0.85)';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeText('SCORE', 24, 20);
    ctx.fillStyle = '#f3e6d3';
    ctx.fillText('SCORE', 24, 20);
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeText(String(score), 24, 40);
    if (scoreFlash > 0) {
        ctx.fillStyle = scoreFlashGood ? '#7ee081' : '#ff7b6b';
    } else {
        ctx.fillStyle = '#f3e6d3';
    }
    ctx.fillText(String(score), 24, 40);
    ctx.restore();
}

let gameState = 'menu';
let timeLeft = ROUND_TIME;
let overTime = 0;

function updateTimer(dt) {
    if (gameState === 'playing') {
        timeLeft -= dt;
        if (timeLeft <= 0) {
            timeLeft = 0;
            endRound();
        }
    } else {
        overTime += dt;
        if (passed && overTime > NEXT_LEVEL_DELAY){
            restartGame();
        }
    }
}

function endRound() {
    gameState = 'over';
    passed = score >= levelTarget();

    if (passed) {
        playClearSound();
    } else {
        playTimesUpSound();
    }

    overTime = 0;
    shape.alive = false
    clearTimeout(respawnTimer);
    line.isDrawing = false;
    line.visible = false;
}

function restartGame() {
    score = 0;
    timeLeft = ROUND_TIME;
    pieces.length = 0;
    labels.length = 0;
    gameState = 'playing';
    if (passed) level += 1;
    resetShape();
}

function drawTimer() {
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(40, 20, 5, 0.85)';
    const x = canvas.width - 24;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeText('TIME', x, 20);
    ctx.fillStyle = '#f3e6d3';
    ctx.fillText('TIME', x, 20);
    const seconds = String(Math.ceil(timeLeft));
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeText(seconds, x, 40);
    ctx.fillStyle = timeLeft <= 10 ? '#ff7b6b' : '#f3e6d3';
    ctx.fillText(seconds, x, 40);
    ctx.restore();
}

function drawGameOver() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const title = passed ? 'Level ' + level + ' cleared!' : "Time's up";
    const detail = passed ? 'Time left: ' + Math.ceil(timeLeft) + 's' : 'Score ' + score + ' of  ' + levelTarget();
    const action = passed ? 'Level ' + (level + 1) + ' starting...' : 'Click to try again';
    ctx.save();
    ctx.fillStyle = 'rgba(30, 15, 5, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(40, 20, 5, 0.85)';
    const titleSize = Math.min(64, canvas.width / 11);
    ctx.font = 'bold ' + titleSize + 'px system-ui, sans-serif';
    ctx.lineWidth = 8;
    ctx.strokeText(title, cx, cy - 70);
    ctx.fillStyle = passed ? '#7ee081' : '#f3e6d3';
    ctx.fillText(title, cx, cy - 70);
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeText(detail, cx, cy + 10);
    ctx.fillStyle = '#f3e6d3';
    ctx.fillText(detail, cx, cy + 10);
    if (passed || overTime > RESTART_DELAY) {
        ctx.font = '24px system-ui, sans-serif';
        ctx.fillText(action, cx, cy + 80);
    }
    ctx.restore();
}

let audio = null;

function startAudio() {
    if (!audio) {
        audio = new AudioContext();
    }
    if (audio.state === 'suspended'){
        audio.resume();
    }
}

function playTone(startPitch, endPitch, seconds, type, volume, delay = 0){
    if (!audio) return;
    const start = audio.currentTime + delay;

    const note = audio.createOscillator();
    const fader = audio.createGain();
    note.type = type;
    note.frequency.setValueAtTime(startPitch, start);
    note.frequency.exponentialRampToValueAtTime(endPitch, start + seconds);
    fader.gain.setValueAtTime(volume, start);
    fader.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    note.connect(fader);
    fader.connect(audio.destination);
    note.start(start);
    note.stop(start + seconds);
}

function playCutSound() {
    if (!audio) return;
    const start = audio.currentTime;
    const seconds = 0.18;
    const clip = audio.createBuffer(1, Math.floor(audio.sampleRate * seconds), audio.sampleRate);
    const samples = clip.getChannelData(0);
    for(let i = 0; i < samples.length; i++) {
        samples[i] = Math.random() * 2 - 1;
    }
    const hiss = audio.createBufferSource();
    hiss.buffer = clip;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3000, start);
    filter.frequency.exponentialRampToValueAtTime(500, start + seconds);
    const fader = audio.createGain();
    fader.gain.setValueAtTime(0.5, start);
    fader.gain.exponentialRampToValueAtTime(0.001, start + seconds);

    hiss.connect(filter);
    filter.connect(fader);
    fader.connect(audio.destination);
    hiss.start(start);
}

function playGoodSound(){
    playTone(660, 660, 0.12, 'triangle', 0.25, 0.05);
    playTone(990, 990, 0.2, 'triangle', 0.25, 0.13);
}

function playBadSound() {
    playTone(220, 110, 0.25, 'square', 0.1, 0.05);
}

function playMissSound() {
    playTone(150, 50, 0.3, 'sine', 0.5);
}

function playClearSound() {
    const notes = [523, 659, 784, 1047];
    for (let i = 0; i < notes.length; i++){
        playTone(notes[i], notes[i], 0.25, 'triangle', 0.25, i * 0.1);
    }
}

function playTimesUpSound() {
    const notes = [392, 330, 262];
    for (let i = 0; i < notes.length; i++) {
        playTone(notes[i], notes[i], 0.3, 'triangle', 0.25, i * 0.15);
    } 
}

const flashLayer = document.getElementById('flash');
const perfectText = document.getElementById('perfect');

function shakeScreen() {
    canvas.classList.remove('shake');
    void canvas.offsetWidth;
    canvas.classList.add('shake');
}

function showFlash(kind) {
    flashLayer.className = '';
    void flashLayer.offsetWidth;
    flashLayer.className = kind;
}

function showPerfect(x, y) {
    perfectText.style.left = x + 'px';
    perfectText.style.top = y + 'px';
    perfectText.classList.remove('show');
    void perfectText.offsetWidth;
    perfectText.classList.add('show');
}

const menu = document.getElementById('menu');
const playButton = document.getElementById('play-button');

playButton.addEventListener('click', () => {
    startAudio();
    menu.hidden = true;
    passed = false;
    restartGame();
})

let lastTime = 0;

function gameLoop(time) {
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    if (gameState === 'menu') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        requestAnimationFrame(gameLoop);
        return;
    }

    updateShape(dt);
    updatePieces(dt);
    updateLabels(dt);
    updateScore(dt);
    updateTimer(dt);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPieces();
    drawShape();
    drawLine();
    drawLabels();
    drawScore();
    drawTimer();
    drawLevel();

    if (gameState === 'over') {
        drawGameOver();
    }

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);