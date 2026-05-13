import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/GLTFLoader.js';

// --- 1. CENÁRIO ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 
scene.fog = new THREE.Fog(0x87CEEB, 10, 80);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 4, 8);
camera.lookAt(0, 0, -10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); // Melhora a qualidade no celular
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- 2. LUZES ---
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(-10, 20, 10);
sun.castShadow = true;
scene.add(sun);

// --- 3. PISTA ---
const groundMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 1000), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- 4. VARIÁVEIS ---
const laneWidth = 3;
let currentLane = 0;
let isJumping = false;
let jumpVelocity = 0;
const gravity = -0.015;
let speed = 0.5;
let score = 0;
let gameActive = true;
let controlsInverted = false;
let isSpaceMap = false; 
const obstacles = [];
const items = [];
let mixer, playerModel;

// Boneco reserva
playerModel = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
playerModel.position.y = 1;
scene.add(playerModel);
const playerBox = new THREE.Box3();

// Carregar Robô
const loader = new GLTFLoader();
loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/RobotExpressive/RobotExpressive.glb', (gltf) => {
    scene.remove(playerModel);
    playerModel = gltf.scene;
    playerModel.scale.set(0.4, 0.4, 0.4);
    playerModel.rotation.y = Math.PI;
    scene.add(playerModel);
    mixer = new THREE.AnimationMixer(playerModel);
    const run = THREE.AnimationClip.findByName(gltf.animations, 'Running');
    if (run) mixer.clipAction(run).play();
});

// --- 5. CONTROLES DE CELULAR (SWIPE) ---
let touchStartX = 0;
let touchStartY = 0;

window.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, false);

window.addEventListener('touchend', (e) => {
    if (!gameActive) return;
    
    let touchEndX = e.changedTouches[0].screenX;
    let touchEndY = e.changedTouches[0].screenY;
    
    let diffX = touchEndX - touchStartX;
    let diffY = touchEndY - touchStartY;

    // Detecta se o movimento foi horizontal ou vertical
    if (Math.abs(diffX) > Math.abs(diffY)) {
        // Movimento Horizontal
        let move = 0;
        if (diffX > 30) move = 1; // Swipe Direita
        if (diffX < -30) move = -1; // Swipe Esquerda
        
        if (controlsInverted) move *= -1;

        if (move === -1 && currentLane > -1) currentLane--;
        if (move === 1 && currentLane < 1) currentLane++;
    } else {
        // Movimento Vertical
        if (diffY < -30 && !isJumping) { // Swipe Cima
            isJumping = true;
            jumpVelocity = 0.35;
        }
    }
}, false);

// Mantém suporte ao teclado também
window.addEventListener('keydown', (e) => {
    if (!gameActive) return;
    let move = 0;
    if (e.key === 'ArrowLeft' || e.key === 'a') move = -1;
    if (e.key === 'ArrowRight' || e.key === 'd') move = 1;
    if (controlsInverted) move *= -1;
    if (move === -1 && currentLane > -1) currentLane--;
    if (move === 1 && currentLane < 1) currentLane++;
    if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') && !isJumping) {
        isJumping = true;
        jumpVelocity = 0.35;
    }
});

// --- 6. GERAÇÃO (Obstáculos e Itens) ---
function spawnObstacle() {
    if (!gameActive) return;
    const obsColor = isSpaceMap ? 0x9b59b6 : 0xffa502;
    const obs = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2, 1.8), new THREE.MeshStandardMaterial({ color: obsColor }));
    obs.position.set((Math.floor(Math.random() * 3) - 1) * laneWidth, 1, -100);
    scene.add(obs);
    obstacles.push({ mesh: obs, box: new THREE.Box3() });
    setTimeout(spawnObstacle, Math.max(400, 1500 - (score * 0.2)));
}

function spawnItem() {
    if (!gameActive) return;
    const rand = Math.random();
    let type, color;
    if (rand < 0.5) { type = 'teleport'; color = 0x9b59b6; }
    else if (rand < 0.8) { type = 'speed'; color = 0x00ffff; }
    else { type = 'bad'; color = 0xff0000; }
    
    const itemMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.5 }));
    itemMesh.position.set((Math.floor(Math.random() * 3) - 1) * laneWidth, 1.5, -100);
    scene.add(itemMesh);
    items.push({ mesh: itemMesh, box: new THREE.Box3(), type: type });
    setTimeout(spawnItem, 2000 + Math.random() * 3000);
}

spawnObstacle();
spawnItem();

// --- 7. TELEPORTE ---
function teleport() {
    isSpaceMap = !isSpaceMap;
    if (isSpaceMap) {
        scene.background = new THREE.Color(0x0a0a2a);
        scene.fog.color.set(0x0a0a2a);
        groundMat.color.set(0x1a1a1a);
    } else {
        scene.background = new THREE.Color(0x87CEEB);
        scene.fog.color.set(0x87CEEB);
        groundMat.color.set(0x444444);
    }
    obstacles.forEach(obs => scene.remove(obs.mesh));
    obstacles.length = 0;
}

// --- 8. LOOP E AJUSTE DE TELA ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    const delta = 0.016;
    if (gameActive) {
        if (playerModel) {
            playerModel.position.x += (currentLane * laneWidth - playerModel.position.x) * 0.15;
            if (isJumping) {
                playerModel.position.y += jumpVelocity;
                jumpVelocity += gravity;
                if (playerModel.position.y <= 0) { playerModel.position.y = 0; isJumping = false; }
            }
            if (mixer) mixer.update(delta);
            playerBox.setFromObject(playerModel);
        }
        obstacles.forEach((obs, i) => {
            obs.mesh.position.z += speed;
            obs.box.setFromObject(obs.mesh);
            if (playerBox.intersectsBox(obs.box)) gameOver();
            if (obs.mesh.position.z > 10) { scene.remove(obs.mesh); obstacles.splice(i, 1); }
        });
        items.forEach((item, i) => {
            item.mesh.position.z += speed;
            item.mesh.rotation.y += 0.05;
            item.box.setFromObject(item.mesh);
            if (playerBox.intersectsBox(item.box)) {
                if (item.type === 'teleport') teleport();
                else applyEffect(item.type);
                scene.remove(item.mesh);
                items.splice(i, 1);
            }
            if (item.mesh.position.z > 10) { scene.remove(item.mesh); items.splice(i, 1); }
        });
        score++;
        const scoreEl = document.getElementById('score');
        if(scoreEl) scoreEl.innerText = `Pontos: ${Math.floor(score / 10)}`;
    }
    renderer.render(scene, camera);
}

function applyEffect(type) {
    if (type === 'speed') {
        speed *= 1.8;
        setTimeout(() => { speed = 0.5; }, 5000);
    } else if (type === 'bad') {
        controlsInverted = true;
        setTimeout(() => { controlsInverted = false; }, 5000);
    }
}

function gameOver() {
    gameActive = false;
    document.getElementById('game-over')?.classList.remove('hidden');
}

document.getElementById('restart-btn').onclick = () => location.reload();
animate();