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

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'black';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

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
    radius: 50,
    speed: FAST_SPEED,
    color: '#3fa7d6',
    alive: true,
};

function resetShape() {
    shape.x = -shape.radius;
    shape.y = canvas.height * (0.2 + Math.random() * 0.6);
    shape.speed = FAST_SPEED;
    shape.alive = true;
}
resetShape();

function updateShape(dt) {
    if (!shape.alive) return;
    
    if (shape.x > shape.radius) {
        shape.speed += (SLOW_SPEED - shape.speed) * Math.min(1, BRAKING * dt);

    }
    shape.x += shape.speed * canvas.width * dt;
    if (shape.x - shape.radius > canvas.width) {
        missShape();
        resetShape();
    }
}

function drawShape() {
    if (!shape.alive) return;

    ctx.fillStyle = shape.color;
    ctx.beginPath();
    ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
    ctx.fill();
}

function distanceToLine(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx*dx + dy *dy;

    if(lengthSquared === 0) {
        return Math.hypot(px -x1,py -y1);
    }
    let t = ((px-x1) * dx + (py-y1) *dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    return Math.hypot(px - closestX, py - closestY);
}

function lineCutsShape() {
    const startDistance = Math.hypot(line.startX - shape.x, line.startY - shape.y);
    const endDistance = Math.hypot(line.endX - shape.x, line.endY - shape.y);
    const startsOutside = startDistance > shape.radius;
    const endsOutside = endDistance > shape.radius;

    const passesThrough = 
        distanceToLine(shape.x, shape.y, line.startX, line.startY, line.endX, line.endY) < shape.radius;

    return startsOutside && endsOutside && passesThrough;   
}

function cutShape() {
    const result = measureCut();
    showRatio(result);
    changeScore(result.small >= GOOD_CUT ? 1 : -1);
    splitShape();
    shape.alive = false;
    setTimeout(resetShape, RESPAWN_DELAY);
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
            side: side,
            cutX: cutX,
            cutY: cutY,
            dirX: dirX,
            dirY: dirY,
            normalX: normalX,
            normalY: normalY,
            vx: shape.speed * canvas.width + normalX * side * PIECE_SPEED,
            vy: normalY * side * PIECE_SPEED,
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
        ctx.beginPath();
        ctx.arc(0, 0, piece.radius, 0, Math.PI * 2);
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

function measureCut() {
    const r = shape.radius;
    const d = distanceToLine(shape.x, shape.y, line.startX, line.startY, line.endX, line.endY);
    const smallArea = r * r * Math.acos(d/r) -d * Math.sqrt(r*r-d*d);
    const totalArea = Math.PI * r * r;

    const small = Math.round((smallArea/totalArea) * 100);
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
    labels.push({
        text: 'Missed',
        good: false,
        x: canvas.width - 80,
        y: shape.y,
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

let lastTime = 0;

function gameLoop(time) {
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    updateShape(dt);
    updatePieces(dt);
    updateLabels(dt);
    updateScore(dt);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPieces();
    drawShape();
    drawLine();
    drawLabels();
    drawScore();

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);