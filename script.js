const apiKey = "";

class BetaManager {
    constructor() {
        this.features = new Map();
        this.states = new Map();
    }

    register(id, name, onEnable, onDisable, hideInDrawer = false) {
        this.features.set(id, { name, onEnable, onDisable, hideInDrawer });
        this.states.set(id, false);
        this.refreshUI();
    }

    toggle(id) {
        if (!this.features.has(id)) return;
        const currentState = this.states.get(id);
        const newState = !currentState;
        this.states.set(id, newState);
        
        // Play Feedback Sound
        playUISound(newState ? 'on' : 'off');

        const feature = this.features.get(id);
        if (newState && feature.onEnable) feature.onEnable();
        else if (!newState && feature.onDisable) feature.onDisable();
        
        // Sync Sidebar Bubbles
        const funnySound = document.getElementById('funny-sound-checkbox');
        const digitalGlitch = document.getElementById('digital-glitch-checkbox');
        
        if (id === 'beta1' && digitalGlitch) digitalGlitch.checked = newState;
        if (id === 'beta2' && funnySound) funnySound.checked = newState;

        const item = document.getElementById(`beta-item-${id}`);
        if(item) {
            if (newState) item.classList.add('active');
            else item.classList.remove('active');
        }
    }

    getState(id) {
        return this.states.get(id) || false;
    }

    refreshUI() {
        const drawer = document.getElementById('beta-drawer');
        if (!drawer) return;
        drawer.innerHTML = '';
        
        // Ensure buttons are contained horizontally
        let visibleIdx = 1;
        this.features.forEach((feature, id) => {
            if (feature.hideInDrawer) return;

            const item = document.createElement('div');
            item.className = 'beta-item';
            item.id = `beta-item-${id}`;
            item.setAttribute('data-tooltip', feature.name);
            if (this.getState(id)) item.classList.add('active');
            
            item.onclick = () => this.toggle(id);
            
            const numSpan = document.createElement('span');
            numSpan.className = 'beta-num';
            numSpan.innerText = visibleIdx++;
            
            item.appendChild(numSpan);
            drawer.appendChild(item);
        });
    }

    renderUI() { /* No longer used individually */ }

}
window.betaManager = new BetaManager();

// ─────────────────────────────────────────────────────────────────────────────
// 行星点击挑战游戏模块 (Beta 2 - Planetary Click Challenge)
// ─────────────────────────────────────────────────────────────────────────────
const PlanetaryGame = {
    isPlaying: false,
    score: 0,
    timeLeft: 60,
    targets: [],
    _timerInterval: null,
    _hudEl: null,
    _scoreEl: null,  // 直接 DOM 引用，避免 getElementById 失效
    _timeEl: null,
    _scene: null,
    _planetMesh: null,

    bind(scene, planetMesh) {
        this._scene = scene;
        this._planetMesh = planetMesh;
    },

    start() {
        if (!this._scene || !this._planetMesh) {
            console.error('[PlanetaryGame] 场景未绑定！');
            return;
        }
        // 确保停止旧实例
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
        this._clearTargets();
        this._removeHUD();

        this.isPlaying = true;
        this.score = 0;
        this.timeLeft = 60;
        this._createHUD();

        // 生成初始目标（一次性 20 个）
        for (let i = 0; i < this.MAX_TARGETS; i++) this._spawnOne();

        // 启动倒计时
        const self = this;
        this._timerInterval = setInterval(function() {
            self.timeLeft--;
            if (self._timeEl) {
                self._timeEl.textContent = self.timeLeft;
                self._timeEl.style.color = self.timeLeft <= 10 ? '#ff4444' : '#ffcc44';
            }
            if (self.timeLeft <= 0) self._gameOver();
        }, 1000);
    },

    stop() {
        this.isPlaying = false;
        clearInterval(this._timerInterval);
        this._timerInterval = null;
        this._clearTargets();
        this._removeHUD();
    },

    MAX_TARGETS: 20,

    _spawnOne() {
        try {
            if (!this._planetMesh) return;

            const geo   = this._planetMesh.geometry;
            const posAttr = geo.attributes.position;
            const idx     = geo.index;

            // 兼容 indexed 和 non-indexed
            const totalFaces = idx ? Math.floor(idx.count / 3) : Math.floor(posAttr.count / 3);
            if (totalFaces <= 0) return;

            let vA, vB, vC, centroid, faceNormal;

            // 最多尝试 50 次，找到不与已有目标重叠的面
            for (let attempt = 0; attempt < 50; attempt++) {
                const fi = Math.floor(Math.random() * totalFaces);
                let i0, i1, i2;
                if (idx) {
                    i0 = idx.getX(fi * 3);
                    i1 = idx.getX(fi * 3 + 1);
                    i2 = idx.getX(fi * 3 + 2);
                } else {
                    i0 = fi * 3;
                    i1 = fi * 3 + 1;
                    i2 = fi * 3 + 2;
                }

                vA = new THREE.Vector3().fromBufferAttribute(posAttr, i0);
                vB = new THREE.Vector3().fromBufferAttribute(posAttr, i1);
                vC = new THREE.Vector3().fromBufferAttribute(posAttr, i2);

                centroid = new THREE.Vector3()
                    .addVectors(vA, vB).add(vC).divideScalar(3);

                // 对球体：法线 = 中心归一化方向
                faceNormal = centroid.clone().normalize();

                // 放置位置（局部坐标）
                const placePos = centroid; // 贴在面上（高度由 CylinderGeometry 的 height/2 自动推出）

                // 防重叠：按局部坐标距离判断
                const tooClose = this.targets.some(t =>
                    t.position.distanceTo(placePos) < 10
                );
                if (!tooClose) break;
            }

            if (!vA || !centroid) return;

            // 面边长 → 三棱柱半径（外接圆半径 = 边长 / √3）
            const edgeLen = vA.distanceTo(vB);
            const radius  = (edgeLen / Math.sqrt(3)) * 0.95; // 外接圆半径收缩 5% 留出缝隙
            const height  = 0.6; // 更扁平的按键

            // 正三棱柱（radialSegments = 3）
            const targetGeo = new THREE.CylinderGeometry(radius, radius, height, 3, 1);

            const targetMat = new THREE.MeshStandardMaterial({
                color:            0xff8800,
                emissive:         0xff4400,
                emissiveIntensity: 1.0,
                roughness:        0.35,
                metalness:        0.5,
                transparent:      true,
                opacity:          0.9
            });

            const target = new THREE.Mesh(targetGeo, targetMat);

            // ── 精确对齐到三角面 ──────────────────────────────────────────
            // 1. 位置：面中心沿法线抬起 height/2（让底面贴合星球表面）
            target.position.copy(
                centroid.clone().add(faceNormal.clone().multiplyScalar(height / 2))
            );

            // 2. 旋转矩阵：  Y轴 → faceNormal（使底面平行于球面）
            //               Z轴 → centroid→vA 方向（因为 Cylinder(3段) 首个顶点位于 +Z 轴）
            const zDir = new THREE.Vector3().subVectors(vA, centroid);
            // 将 zDir 投影到面平面（去除法线分量）
            zDir.sub(faceNormal.clone().multiplyScalar(zDir.dot(faceNormal))).normalize();
            const zAxis = zDir;

            // X轴：Y x Z，保证满足右手正交系（无镜像翻转）
            const xAxis = new THREE.Vector3().crossVectors(faceNormal, zAxis).normalize();

            const mat4 = new THREE.Matrix4().makeBasis(xAxis, faceNormal, zAxis);
            target.quaternion.setFromRotationMatrix(mat4);
            // ──────────────────────────────────────────────────────────────

            target.userData.isPlanetTarget = true;

            // 作为 coreMesh 子节点，随星球旋转
            this._planetMesh.add(target);
            this.targets.push(target);

        } catch (e) {
            console.error('[PlanetaryGame] SpawnOne 错误:', e);
        }
    },

    handleHit(target) {
        const i = this.targets.indexOf(target);
        this.targets.splice(i, 1);

        // 缩放消失动画
        const startTime = performance.now();
        const scene = this._scene;
        const animate = () => {
            const t = Math.min((performance.now() - startTime) / 250, 1);
            const s = 1 - t;
            target.scale.set(s, s, s);
            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                // 从父节点（planetMesh）中移除
                if (target.parent) target.parent.remove(target);
                target.geometry.dispose();
                target.material.dispose();
            }
        };
        requestAnimationFrame(animate);

        this.score++;
        if (this._scoreEl) this._scoreEl.textContent = this.score;
        // 维持目标数量
        const needed = this.MAX_TARGETS - this.targets.length;
        for (let i = 0; i < needed; i++) this._spawnOne();
        playUISound('on');
    },

    _clearTargets() {
        this.targets.forEach(t => {
            if (t.parent) t.parent.remove(t);
            t.geometry.dispose();
            t.material.dispose();
        });
        this.targets = [];
    },

    _createHUD() {
        // 先移除旧 HUD
        const old = document.getElementById('planet-game-hud');
        if (old) old.remove();

        const hud = document.createElement('div');
        hud.id = 'planet-game-hud';
        hud.className = 'game-ui';

        const inner = document.createElement('div');
        inner.className = 'game-ui-inner';

        const row1 = document.createElement('div');
        row1.className = 'game-ui-row';
        row1.innerHTML = '<span class="game-label">🎯 得分</span>';
        const scoreEl = document.createElement('span');
        scoreEl.className = 'game-value';
        scoreEl.textContent = '0';
        row1.appendChild(scoreEl);
        this._scoreEl = scoreEl;

        const row2 = document.createElement('div');
        row2.className = 'game-ui-row';
        row2.innerHTML = '<span class="game-label">⏱ 剩余</span>';
        const timeEl = document.createElement('span');
        timeEl.className = 'game-value';
        timeEl.textContent = '60';
        row2.appendChild(timeEl);
        this._timeEl = timeEl;

        inner.appendChild(row1);
        inner.appendChild(row2);
        hud.appendChild(inner);
        document.body.appendChild(hud);
        this._hudEl = hud;
    },

    _removeHUD() {
        if (this._hudEl) { this._hudEl.remove(); this._hudEl = null; }
        this._scoreEl = null;
        this._timeEl = null;
        const modal = document.getElementById('planet-game-modal');
        if (modal) modal.remove();
    },

    _gameOver() {
        this.isPlaying = false;
        clearInterval(this._timerInterval);
        this._timerInterval = null;
        this._clearTargets();

        const modal = document.createElement('div');
        modal.id = 'planet-game-modal';
        modal.className = 'game-modal';
        modal.innerHTML = `
            <div class="game-modal-inner">
                <div class="game-modal-title">🌍 挑战结束</div>
                <div class="game-modal-score">${this.score}</div>
                <div class="game-modal-label">颗目标被摧毁</div>
                <div class="game-modal-actions">
                    <button id="pg-restart">再来一次</button>
                    <button id="pg-quit">退出</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('pg-restart').onclick = () => {
            modal.remove();
            this.start();
        };
        document.getElementById('pg-quit').onclick = () => {
            modal.remove();
            this._removeHUD();
            window.betaManager.states.set('beta2', false);
            const betaItem = document.getElementById('beta-item-beta2');
            if (betaItem) betaItem.classList.remove('active');
        };
    }
};

window.betaManager = new BetaManager();

// Function to setup Beta trigger logic
function setupBetaUI() {
    const trigger = document.getElementById('beta-trigger');
    const drawer = document.getElementById('beta-drawer');
    if (trigger && drawer) {
        trigger.onclick = () => {
            playUISound('tap');
            const isOpen = drawer.classList.toggle('open');
            trigger.classList.toggle('active', isOpen);
        };
    }
}


const state = {
    coreColor: '#3b82f6',
    orbitColor: '#383838',
    showPoints: true,
    particleCount: 2500,
    lerp: 0.10,
    speed: 1.0,
    opacity: 0.85,
    radius: 1.50,
    trail: 15,
    damping: 0.04,
    springStrength: 0.15,
    perfMode: false,
    volume: 0.5,
    sfxVolume: 0.2, // Default 20%
    verticalSpread: 0.15,
    orbitWidth: 0.00 // Orbit radial spread multiplier
};

let scene, camera, renderer, coreMesh, wireframeMesh;
let skyboxMesh; // Deep Space Skybox Mesh
let stardustSystem; // Global Stardust
let voidEmbersSystem; // Close Drifting Dust
let composer, bloomPass;
let raycaster, mouse = new THREE.Vector2(), clickHighlights = [];
let targetRadius = 380, currentRadius = 380;
let targetAzimuth = 0, currentAzimuth = 0;
let targetElevation = 0.2, currentElevation = 0.2;
let isFrozen = false;
let isAutoLeveling = false;
let elevationVelocity = 0, azimuthVelocity = 0;
const hudTrail = []; // HUD dot trail history
const HUD_TRAIL_MAX = 20; // Slightly longer for fluid effect
let isHandDetected = false;
let currentHandPos = { x: 0, y: 0 };

// Audio System initialization
const sfxBubble01 = new Audio('audio/sfx_ui_click_bubble_01.flac');
const sfxBubble02 = new Audio('audio/sfx_ui_click_bubble_02.wav');
const sfxOn = new Audio('audio/sfx_ui_button_on.WAV');
const sfxOff = new Audio('audio/sfx_ui_button_off.WAV');
const sfxTap = new Audio('audio/sfx_ui_base_tap.WAV');

[sfxBubble01, sfxBubble02, sfxOn, sfxOff, sfxTap].forEach(s => s.preload = 'auto');

/**
 * Global UI Sound Player
 * @param {'on'|'off'|'tap'} type 
 */
function playUISound(type) {
    let sound;
    if (type === 'on') sound = sfxOn;
    else if (type === 'off') sound = sfxOff;
    else if (type === 'tap') sound = sfxTap;
    
    if (sound) {
        sound.volume = state.sfxVolume !== undefined ? state.sfxVolume : 0.2;
        sound.currentTime = 0;
        sound.play().catch(e => console.warn("UI SFX failed:", e));
    }
}
const INITIAL_ELEVATION = 0.2, INITIAL_AZIMUTH = 0;
let lastDetectionTime = 0;
let hudAlpha = 0; // Dynamic opacity for HUD elements

// Beta 2: Gesture Drone Synth (Web Audio API)
let droneAudioCtx = null;
let droneOsc = null;
let droneGain = null;
let lastHandPosForVelocity = { x: 0, y: 0 };
let handVelocity = 0;

// Beta 3: Stable Field Synth
let droneOsc2 = null;
let droneGain2 = null;
let droneLFO = null; 
let droneLFOGain = null;
let droneRhythmOsc = null;
let droneTremoloGain = null;
let lastIsFrozen = false; 

function playTransitionSFX(type) {
    if (!droneAudioCtx) return;
    
    const now = droneAudioCtx.currentTime;
    const masterSFX = (state.sfxVolume || 0.2);

    if (type === 'freeze') {
        // Locked Sound - Simple Downward Scan
        const osc = droneAudioCtx.createOscillator();
        const g = droneAudioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.2);
        g.gain.setValueAtTime(masterSFX * 0.6, now);
        g.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.connect(g);
        g.connect(droneAudioCtx.destination);
        osc.start();
        osc.stop(now + 0.25);
    } else if (type === 'unlock') {
        // Startup Sound - Simple Upward Scan
        const osc = droneAudioCtx.createOscillator();
        const g = droneAudioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.25);
        g.gain.setValueAtTime(masterSFX * 0.6, now);
        g.gain.linearRampToValueAtTime(0, now + 0.25);
        osc.connect(g);
        g.connect(droneAudioCtx.destination);
        osc.start();
        osc.stop(now + 0.3);
    }
}

function initDroneAudio() {
    if (droneAudioCtx) return;
    try {
        droneAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Beta 2 Nodes (Pulse Click - Sine)
        droneOsc = droneAudioCtx.createOscillator();
        droneGain = droneAudioCtx.createGain();
        droneOsc.type = 'sine';
        droneOsc.frequency.setValueAtTime(120, droneAudioCtx.currentTime);
        droneGain.gain.setValueAtTime(0, droneAudioCtx.currentTime);
        droneOsc.connect(droneGain);
        droneGain.connect(droneAudioCtx.destination);
        droneOsc.start();

        // Beta 3 Nodes (Stable Field - Sawtooth + Texture LFO + Rhythmic LFO)
        droneOsc2 = droneAudioCtx.createOscillator();
        droneGain2 = droneAudioCtx.createGain();
        droneLFO = droneAudioCtx.createOscillator();
        droneLFOGain = droneAudioCtx.createGain();
        
        // Rhythmic Tremolo Nodes
        droneRhythmOsc = droneAudioCtx.createOscillator();
        const droneRhythmDepth = droneAudioCtx.createGain();
        droneTremoloGain = droneAudioCtx.createGain();

        droneOsc2.type = 'sawtooth';
        droneOsc2.frequency.setValueAtTime(100, droneAudioCtx.currentTime);
        
        // texture LFO (15Hz Sine AM)
        droneLFO.type = 'sine';
        droneLFO.frequency.setValueAtTime(15, droneAudioCtx.currentTime);
        droneLFOGain.gain.setValueAtTime(0.4, droneAudioCtx.currentTime);

        // Rhythmic LFO (1.5Hz Sine for Natural Breathing)
        droneRhythmOsc.type = 'sine';
        droneRhythmOsc.frequency.setValueAtTime(1.5, droneAudioCtx.currentTime);
        droneRhythmDepth.gain.setValueAtTime(0.25, droneAudioCtx.currentTime); // Depth for 0.5-1.0 range
        droneTremoloGain.gain.setValueAtTime(0.75, droneAudioCtx.currentTime); // Offset for 0.5-1.0 range

        // Chain: Osc -> Texture VCA -> Rhythm VCA -> Master Gain
        droneLFO.connect(droneLFOGain.gain);
        droneOsc2.connect(droneLFOGain);
        
        droneRhythmOsc.connect(droneRhythmDepth);
        droneRhythmDepth.connect(droneTremoloGain.gain);
        droneLFOGain.connect(droneTremoloGain);
        
        droneTremoloGain.connect(droneGain2);
        droneGain2.connect(droneAudioCtx.destination);

        droneGain2.gain.setValueAtTime(0, droneAudioCtx.currentTime);
        
        droneOsc2.start();
        droneLFO.start();
        droneRhythmOsc.start();

    } catch (e) {
        console.error("Drone Audio failed:", e);
    }
}

class ParticleSystem {
    constructor(scene, maxCount = 5000) {
        this.maxCount = maxCount;
        this.particles = [];
        this.historyLength = 30; // Increased to support max c-trail (25)
        
        // Trail Geometry
        this.trailGeo = new THREE.BufferGeometry();
        this.trailPositions = new Float32Array(maxCount * this.historyLength * 2 * 3);
        this.trailColors = new Float32Array(maxCount * this.historyLength * 2 * 3);
        this.trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
        this.trailGeo.setAttribute('color', new THREE.BufferAttribute(this.trailColors, 3));

        this.trailLines = new THREE.LineSegments(this.trailGeo, new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));
        scene.add(this.trailLines);

        // Initialize Pool
        for (let i = 0; i < maxCount; i++) {
            this.particles.push({
                angle: Math.random() * Math.PI * 2,
                normROff: (Math.random() + Math.random() - 1),
                normY: (Math.random() + Math.random() - 1),
                speed: 0.002 + Math.random() * 0.005,
                history: [],
                active: false
            });
        }
    }

    update(state, planetRadius) {
        if (!state.showPoints) {
            this.trailLines.visible = false;
            return;
        }
        this.trailLines.visible = true;

        const currentDensity = state.particleCount;
        const orbitCol = new THREE.Color(state.orbitColor);
        const ringR = planetRadius * state.radius;
        const posAttr = this.trailGeo.attributes.position;
        const colAttr = this.trailGeo.attributes.color;
        let vIdx = 0;

        const maxVertices = this.maxCount * this.historyLength * 2;

        for (let i = 0; i < this.maxCount; i++) {
            const p = this.particles[i];
            
            // Pool Visibility Control
            if (i < currentDensity) {
                if (!p.active) {
                    p.active = true;
                    p.history = []; // Reset to prevent jumps
                }
                
                p.angle += p.speed * state.speed;
                const rOffset = p.normROff * 50 * state.orbitWidth;
                const r = ringR + rOffset;
                const x = Math.cos(p.angle) * r;
                const z = Math.sin(p.angle) * r;
                const y = p.normY * 20 * state.verticalSpread;

                p.history.unshift(new THREE.Vector3(x, y, z));
                if (p.history.length > this.historyLength) p.history.pop();

                // Draw Trails with steep gradient (Pure Flow)
                if (state.trail > 0 && p.history.length > 1) {
                    const len = Math.min(p.history.length - 1, state.trail);
                    for (let j = 0; j < len; j++) {
                        if (vIdx + 2 > maxVertices) break;

                        // Steep opacity curve: Head 1.0 -> Tail 0
                        const ratio1 = Math.pow(1.0 - (j / state.trail), 1.5);
                        const ratio2 = Math.pow(1.0 - ((j + 1) / state.trail), 1.5);

                        posAttr.setXYZ(vIdx, p.history[j].x, p.history[j].y, p.history[j].z);
                        colAttr.setXYZ(vIdx, orbitCol.r * ratio1, orbitCol.g * ratio1, orbitCol.b * ratio1);
                        vIdx++;

                        posAttr.setXYZ(vIdx, p.history[j + 1].x, p.history[j + 1].y, p.history[j + 1].z);
                        colAttr.setXYZ(vIdx, orbitCol.r * ratio2, orbitCol.g * ratio2, orbitCol.b * ratio2);
                        vIdx++;
                    }
                }
            } else {
                p.active = false;
            }
        }

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        this.trailLines.geometry.setDrawRange(0, vIdx);
    }
}

const PLANET_RADIUS = 42;
let particleSystem;

const auroraVertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
        vUv = uv;
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const auroraFragmentShader = `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;
    varying vec3 vPosition;

    // Fast Noise
    float noise(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
        vec2 uv = vUv;
        float angle = atan(vPosition.y, vPosition.x);
        float dist = length(vPosition.xy);
        
        // Circular energy flow
        float flow = angle * 2.0 + uTime * 2.0;
        float strength = sin(flow + dist * 0.05) * 0.5 + 0.5;
        
        // Layered waves for "Aurora" look
        float wave1 = sin(angle * 5.0 - uTime * 1.5 + dist * 0.02) * 0.5 + 0.5;
        float wave2 = sin(angle * 3.0 + uTime * 0.8 - dist * 0.01) * 0.5 + 0.5;
        float intensity = mix(wave1, wave2, 0.5) * strength;
        
        // Radial gradient fade (Inner/Outer edges)
        float innerR = 80.0;
        float outerR = 180.0;
        float fade = smoothstep(innerR, innerR + 20.0, dist) * (1.0 - smoothstep(outerR - 40.0, outerR, dist));
        
        vec3 finalColor = mix(uColor, vec3(1.0, 1.0, 1.0), intensity * 0.4);
        gl_FragColor = vec4(finalColor, intensity * fade * 0.8);
    }
`;

const stardustVertexShader = `
    attribute float aSize;
    attribute float aSpeed;
    attribute float aOffset;
    varying float vTwinkle;
    uniform float uTime;
    uniform float uHaloMode;

    void main() {
        // Individual twinkling: oscillating between 0.3 and 1.0 (or higher in Halo mode)
        float baseTwinkle = sin(uTime * aSpeed + aOffset) * 0.5 + 0.5;
        // Mode linkage: more intense and faster breathing in Halo mode
        vTwinkle = mix(baseTwinkle * 0.5 + 0.3, baseTwinkle * 0.8 + 0.4, uHaloMode);
        
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const stardustFragmentShader = `
    varying float vTwinkle;
    uniform vec3 uColor;
    void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float soft = 1.0 - smoothstep(0.0, 0.5, dist);
        gl_FragColor = vec4(uColor, soft * vTwinkle * 0.6);
    }
`;


async function fetchAiColors(prompt) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                systemInstruction: { parts: [{ text: "返回 JSON: {core: string, orbit: string}。配色需符合关键词意境，且具备高级感。" }] },
                generationConfig: { responseMimeType: "application/json" }
            })
        });
        const result = await response.json();
        return JSON.parse(result.candidates[0].content.parts[0].text);
    } catch (e) { return null; }
}

let auroraDisc, auroraMaterial;
function getSoftParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 50000);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // ── Deep Space Skybox (BoxGeometry Mesh) ────────────────────────────────
    // Using BoxGeometry+BackSide so we can rotate individual face textures.
    // Adjust these constants (multiples of Math.PI/2) to fix Up/Down seams:
    const SKY_UP_ROTATION   = Math.PI / 2;  // 0, PI/2, PI, -PI/2
    const SKY_DOWN_ROTATION = Math.PI / 2;  // tweak independently

    const texLoader = new THREE.TextureLoader();
    const skyPath = 'assets/textures/skybox/';

    // Face order for BoxGeometry: +X, -X, +Y, -Y, +Z, -Z
    const skyFaces = [
        { file: 'skybox_right.png',  rotation: 0 },              // +X
        { file: 'skybox_left.png',   rotation: 0 },              // -X
        { file: 'skybox_up.png',     rotation: SKY_UP_ROTATION },// +Y
        { file: 'skybox_down.png',   rotation: SKY_DOWN_ROTATION},// -Y
        { file: 'skybox_back.png',   rotation: 0 },              // +Z (swapped)
        { file: 'skybox_front.png',  rotation: 0 },              // -Z (swapped)
    ];

    const skyMaterials = skyFaces.map(({ file, rotation }) => {
        const tex = texLoader.load(skyPath + file);
        tex.encoding = THREE.sRGBEncoding;
        if (rotation !== 0) {
            tex.center.set(0.5, 0.5);
            tex.rotation = rotation;
        }
        return new THREE.MeshBasicMaterial({
            map: tex,
            side: THREE.BackSide,
            depthWrite: false
        });
    });

    const skyGeo = new THREE.BoxGeometry(4000, 4000, 4000);
    skyboxMesh = new THREE.Mesh(skyGeo, skyMaterials);
    skyboxMesh.renderOrder = -1;
    skyboxMesh.frustumCulled = false; // Never cull — always render the background
    scene.add(skyboxMesh);
    // ────────────────────────────────────────────────────────────────────────

    const coreGeo = new THREE.IcosahedronGeometry(PLANET_RADIUS, 5);
    const coreMat = new THREE.MeshPhysicalMaterial({
        color: state.coreColor,
        transparent: true,
        opacity: state.opacity,
        metalness: 0.1,
        roughness: 0.05,
        transmission: 0.95,
        thickness: 5,
        ior: 1.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05
    });

    // Beta 2: Shader Pulse Injection
    coreMat.userData.pulses = {
        uClickPositions: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
        uClickTimes: { value: [0, 0, 0, 0, 0] },
        uPulseSpeed: { value: 1.5 },
        uPulseWidth: { value: 0.06 }, // Reduced for finer detail
        uPulseEnabled: { value: 1.0 }, // PERMANENTLY ENABLED
        uTime: { value: 0 }
    };

    coreMat.onBeforeCompile = (shader) => {
        shader.uniforms.uClickPositions = coreMat.userData.pulses.uClickPositions;
        shader.uniforms.uClickTimes = coreMat.userData.pulses.uClickTimes;
        shader.uniforms.uPulseSpeed = coreMat.userData.pulses.uPulseSpeed;
        shader.uniforms.uPulseWidth = coreMat.userData.pulses.uPulseWidth;
        shader.uniforms.uPulseEnabled = coreMat.userData.pulses.uPulseEnabled;
        shader.uniforms.uTime = coreMat.userData.pulses.uTime;

        shader.vertexShader = `
            varying vec3 vLocalPosition;
            ${shader.vertexShader}
        `.replace(
            `#include <worldpos_vertex>`,
            `#include <worldpos_vertex>
             vLocalPosition = transformed.xyz;`
        );

        shader.fragmentShader = `
            uniform vec3 uClickPositions[5];
            uniform float uClickTimes[5];
            uniform float uPulseSpeed;
            uniform float uPulseWidth;
            uniform float uPulseEnabled;
            uniform float uTime;
            varying vec3 vLocalPosition;
            ${shader.fragmentShader}
        `.replace(
            `#include <dithering_fragment>`,
            `#include <dithering_fragment>
            if (uPulseEnabled > 0.5) {
                vec3 normV = normalize(vLocalPosition);
                float totalPulse = 0.0;
                for (int i = 0; i < 5; i++) {
                    if (uClickTimes[i] > 0.0) {
                        float age = uTime - uClickTimes[i];
                        if (age > 0.0 && age < 2.5) { // Slightly shorter lifetime for snappier feel
                            float dist = acos(clamp(dot(normV, normalize(uClickPositions[i])), -1.0, 1.0));
                            float wavePos = age * uPulseSpeed;
                            
                            // Volumetric/Thickness Logic: Double-layer pulse
                            // 1. Sharp Core (High intensity peak)
                            float core = smoothstep(wavePos - uPulseWidth * 0.3, wavePos, dist) - 
                                         smoothstep(wavePos, wavePos + uPulseWidth * 0.3, dist);
                                         
                            // 2. Outer Glow (Simulating volumetric thickness)
                            float glow = smoothstep(wavePos - uPulseWidth, wavePos, dist) - 
                                         smoothstep(wavePos, wavePos + uPulseWidth, dist);
                            
                            float pulseIntensity = core * 2.0 + glow * 0.6;
                            
                            // Combined decay: fade over time AND fade out before reaching back-side (PI)
                            float timeFade = 1.0 - smoothstep(0.0, 2.5, age);
                            float distFade = 1.0 - smoothstep(1.2, 2.5, dist); 
                            totalPulse += pulseIntensity * timeFade * distFade;
                        }
                    }
                }
                // DYNAMIC COLOR SYNC: Use core planet color with HDR-like boost
                // (diffuseColor.rgb is the base material color in MeshPhysicalMaterial)
                vec3 pulseColor = (diffuseColor.rgb * 2.5 + vec3(0.2)) * totalPulse; 
                gl_FragColor.rgb += pulseColor; 
            }
            `
        );
    };
    coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    const wireMat = new THREE.MeshBasicMaterial({
        color: state.coreColor,
        wireframe: true,
        transparent: true,
        opacity: 0.15
    });
    wireframeMesh = new THREE.Mesh(coreGeo, wireMat);
    wireframeMesh.scale.setScalar(1.002);
    scene.add(wireframeMesh);

    const mainLight = new THREE.PointLight(0xffffff, 1.2, 1000);
    mainLight.position.set(150, 200, 150);
    scene.add(mainLight);
    scene.add(new THREE.AmbientLight(0x404040, 0.5));

    // 1. New Particle System (Class-based Object Pool)
    particleSystem = new ParticleSystem(scene, 5000);


    // 2. Aurora Disc Implementation (High Quality)
    const ringGeo = new THREE.RingGeometry(80, 180, 128);
    auroraMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(state.orbitColor) }
        },
        vertexShader: auroraVertexShader,
        fragmentShader: auroraFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    auroraDisc = new THREE.Mesh(ringGeo, auroraMaterial);
    auroraDisc.rotation.x = Math.PI / 2;
    scene.add(auroraDisc);

    // 3. Global Stardust (Void Dust) Implementation
    const starCount = 3000;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starSize = new Float32Array(starCount);
    const starSpeed = new Float32Array(starCount);
    const starOffset = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
        // Distance 500-1000 for background effect
        const r = 500 + Math.random() * 500;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        starPos[i * 3 + 2] = r * Math.cos(phi);

        starSize[i] = 1.0 + Math.random() * 3.0;
        starSpeed[i] = 0.5 + Math.random() * 2.5;
        starOffset[i] = Math.random() * Math.PI * 2;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSize, 1));
    starGeo.setAttribute('aSpeed', new THREE.BufferAttribute(starSpeed, 1));
    starGeo.setAttribute('aOffset', new THREE.BufferAttribute(starOffset, 1));

    const starMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uHaloMode: { value: 0 },
            uColor: { value: new THREE.Color(0xd1f3ff) } // Subtle Cyan/White
        },
        vertexShader: stardustVertexShader,
        fragmentShader: stardustFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    stardustSystem = new THREE.Points(starGeo, starMat);
    scene.add(stardustSystem);

    // 4. Void Embers (Close Drifting Particles) Implementation
    const emberCount = 800;
    const emberGeo = new THREE.BufferGeometry();
    const emberPos = new Float32Array(emberCount * 3);
    const emberSpeeds = [];

    for (let i = 0; i < emberCount; i++) {
        const r = 120 + Math.random() * 150;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        emberPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        emberPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        emberPos[i * 3 + 2] = r * Math.cos(phi);

        emberSpeeds.push({
            x: (Math.random() - 0.5) * 0.2,
            y: (Math.random() - 0.5) * 0.2,
            z: (Math.random() - 0.5) * 0.2,
            phase: Math.random() * Math.PI * 2
        });
    }
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    const emberMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.5,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        map: getSoftParticleTexture(),
        depthWrite: false
    });
    voidEmbersSystem = new THREE.Points(emberGeo, emberMat);
    voidEmbersSystem.userData.speeds = emberSpeeds;
    scene.add(voidEmbersSystem);



    // Sync Initial State (Confirm default OFF via JS logic)
    const setHalo = (enabled) => {
        state.perfMode = false; // Never force hide trails/points for perf unless explicitly asked
        if (auroraDisc) auroraDisc.visible = enabled;

        // Decoupled: ParticleSystem handles visibility based on state.showPoints

        if (bloomPass) bloomPass.enabled = enabled;
        if (stardustSystem) stardustSystem.material.uniforms.uHaloMode.value = enabled ? 1 : 0;
    };

    // Initial check from HTML
    const isHalo = document.getElementById('halo-checkbox')?.checked ?? false;
    setHalo(isHalo);

    // Robust Global Wheel Listener
    window.addEventListener('wheel', (e) => {
        targetRadius = Math.max(150, Math.min(1000, targetRadius + e.deltaY * 0.5));
    }, { passive: true, capture: true });

    initClickInteraction();
    
    // Background Music Logic
    const bgMusic = document.getElementById('bg-music');
    const volSlider = document.getElementById('volume-slider');
    
    if (bgMusic && volSlider) {
        bgMusic.volume = state.volume;
        
        // Auto-play on first interaction (Browser Policy)
        const startMusic = () => {
            bgMusic.play().catch(e => console.log("Audio waiting for interaction..."));
            window.removeEventListener('mousedown', startMusic);
            window.removeEventListener('touchstart', startMusic);
        };
        window.addEventListener('mousedown', startMusic);
        window.addEventListener('touchstart', startMusic);

        // Volume sync
        volSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            state.volume = val / 100;
            bgMusic.volume = state.volume;
            
            // Update label
            const label = volSlider.parentElement.previousElementSibling;
            if (label) label.innerText = `系统音量 (${val}%)`;
        };
    }

    create3DMenu();
    updateTitleSpeed(state.speed);

    // Click Pulse Permanent Integration (Singleton Listener)
    const handlePulsePulse = (e) => {
        const intersect = e.detail;
        const userData = coreMesh.material.userData.pulses;
        if (!userData) return;
        
        const localPoint = coreMesh.worldToLocal(intersect.point.clone());
        localPoint.normalize(); 
        
        const idx = pulseClickIndex % 5;
        userData.uClickPositions.value[idx].copy(localPoint);
        userData.uClickTimes.value[idx] = performance.now() / 1000;
        pulseClickIndex++;

        // Play Random Audio (70/30 split)
        const randomVal = Math.random();
        const soundToPlay = (randomVal < 0.7) ? sfxBubble01 : sfxBubble02;
        soundToPlay.volume = state.sfxVolume !== undefined ? state.sfxVolume : 0.2;
        soundToPlay.currentTime = 0; 
        soundToPlay.play().catch(err => console.warn("Audio playback failed:", err));
    };
    window.addEventListener('sphere-pulse-click', handlePulsePulse);

    // --- UI Interaction SFX Delegation ---
    const sidebar = document.getElementById('hybrid-menu');
    const betaWrapper = document.getElementById('beta-drawer');

    const setupSFXDelegation = (container) => {
        if (!container) return;

        // 1. Toggle On/Off for Checkboxes
        container.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                playUISound(e.target.checked ? 'on' : 'off');
            }
        });

        // 2. Tap for Buttons and specific classes
        container.addEventListener('click', (e) => {
            const target = e.target;
            // Ignore range and checkbox (handled by change or specific logic)
            if (target.tagName === 'INPUT' && (target.type === 'range' || target.type === 'checkbox')) return;

            const isButton = target.tagName === 'BUTTON';
            const isBetaBox = target.closest('.beta-box');
            const isToggleIcon = target.closest('.toggle-icon');

            if (isButton || isBetaBox || isToggleIcon) {
                playUISound('tap');
            }
        });
    };

    setupSFXDelegation(sidebar);

    // 3. Extra Triggers (outside delegated containers) - DELETED (moved to onclick)
    
    // Toggle for Hybrid HTML Menu
    const hybridMenu = document.getElementById('hybrid-menu');
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle && hybridMenu) {
        menuToggle.onclick = () => {
            playUISound('tap'); // Unified Sound
            const isOpen = hybridMenu.classList.toggle('open');
            menuToggle.classList.toggle('active', isOpen);
            if (!isOpen) {
                // Reset tilt when closed
                hybridMenu.style.setProperty('--rotateX', '0deg');
                hybridMenu.style.setProperty('--rotateY', '0deg');
            }
        };

        // 3D Tilt Parallax Effect
        hybridMenu.addEventListener('mousemove', (e) => {
            if (!hybridMenu.classList.contains('open')) return;
            
            // Enable fast transform transition specifically during hover
            hybridMenu.style.transition = 'transform 0.1s ease-out';
            
            const rect = hybridMenu.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            // Calculate rotation with damping (larger divisor = less sensitive)
            let rotateX = -(y - centerY) / 25;
            let rotateY = (x - centerX) / 25;

            // Clamp the rotation to maintain a subtle, elegant effect (±8 degrees)
            rotateX = Math.max(-8, Math.min(8, rotateX));
            rotateY = Math.max(-8, Math.min(8, rotateY));

            hybridMenu.style.setProperty('--rotateX', `${rotateX}deg`);
            hybridMenu.style.setProperty('--rotateY', `${rotateY}deg`);
        });

        hybridMenu.addEventListener('mouseleave', () => {
            if (!hybridMenu.classList.contains('open')) return;
            
            // Smoothly reset tilt over 0.4s
            hybridMenu.style.transition = 'transform 0.4s ease';
            hybridMenu.style.setProperty('--rotateX', '0deg');
            hybridMenu.style.setProperty('--rotateY', '0deg');
            
            // Clean up inline transition so it defaults back to stylesheet logic
            setTimeout(() => {
                hybridMenu.style.transition = '';
            }, 400);
        });
    }

    // 2D Menu Sliders Sync (Orbit Width & Radius)
    const orbitWidthSlider = document.getElementById('orbit-width-slider');
    const radiusSlider = document.getElementById('radius-slider');
    
    if (orbitWidthSlider) {
        orbitWidthSlider.oninput = (e) => {
            state.orbitWidth = parseFloat(e.target.value);
            document.getElementById('orbit-width-val').innerText = state.orbitWidth.toFixed(2);
        };
    }
    if (radiusSlider) {
        radiusSlider.oninput = (e) => {
            state.radius = parseFloat(e.target.value);
            document.getElementById('radius-val').innerText = state.radius.toFixed(2);
            // Optionally update the 3D menu panel if visible
            const radiusPanel = menuPanels.find(p => p.userData.key === 'radius');
            if (radiusPanel) {
                updateMenuTexture(radiusPanel);
            }
        };
    }
    
    // SFX Volume Control Logic
    const sfxVolSlider = document.getElementById('sfx-volume-slider');
    const sfxVolVal = document.getElementById('sfx-volume-value');
    if (sfxVolSlider) {
        sfxVolSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            state.sfxVolume = val / 100;
            if (sfxVolVal) sfxVolVal.innerText = `(${val}%)`;
            
            // Sync to 3D menu if exists
            const volumePanel = menuPanels.find(p => p.userData.key === 'sfxVolume');
            if (volumePanel) updateMenuTexture(volumePanel);
        };
    }

    // Click Pulse Counter (Integrated)
    let pulseClickIndex = 0;

    // Sidebar Feature Toggles (Formerly Beta)
    const pointsToggle = document.getElementById('show-points-checkbox');
    const funnySoundToggle = document.getElementById('funny-sound-checkbox');
    const digitalGlitchToggle = document.getElementById('digital-glitch-checkbox');

    if (pointsToggle) {
        pointsToggle.onchange = (e) => {
            state.showPoints = e.target.checked;

        };
    }

    // --- Unified Beta Registration ---

    // 隐藏模块 1: 数字故障底层音效 (Sidebar)
    window.betaManager.register('beta-audio-1', '数字故障底层', () => {
        if (!droneAudioCtx) initDroneAudio();
    }, () => {}, true);

    // 隐藏模块 2: 手势嗡鸣底层音效 (Sidebar)
    window.betaManager.register('beta-audio-2', '手势嗡鸣底层', () => {
        if (!droneAudioCtx) initDroneAudio();
    }, () => {}, true);

    // Beta 1: 极速流光 (Drawer 第1项)
    window.betaManager.register('beta1', '极速流光', () => {
        state.speed = 10.0;
        state.trail = 30;
        updateTitleSpeed(10.0);
        const speedSlider = document.getElementById('c-speed');
        if (speedSlider) speedSlider.value = 10.0;
    }, () => {
        state.speed = 1.0;
        state.trail = 15;
        updateTitleSpeed(1.0);
        const speedSlider = document.getElementById('c-speed');
        if (speedSlider) speedSlider.value = 1.0;
    });


    // Beta 2: 行星点击挑战 (Drawer 第2项)
    PlanetaryGame.bind(scene, coreMesh);
    window.betaManager.register('beta2', '行星挑战', () => PlanetaryGame.start(), () => PlanetaryGame.stop());

    // Sidebar Checkbox Click-Sync Logic
    if (funnySoundToggle) {
        funnySoundToggle.onchange = (e) => {
            if (e.target.checked !== window.betaManager.getState('beta-audio-2')) {
                window.betaManager.toggle('beta-audio-2');
            }
        };
    }

    if (digitalGlitchToggle) {
        digitalGlitchToggle.onchange = (e) => {
            if (e.target.checked !== window.betaManager.getState('beta-audio-1')) {
                window.betaManager.toggle('beta-audio-1');
            }
        };
    }

    // Post-Processing Initial
    const renderScene = new THREE.RenderPass(scene, camera);
    const bloomParams = {
        exposure: 1,
        bloomStrength: 1.5,
        bloomThreshold: 0.1,
        bloomRadius: 0.85
    };

    bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        bloomParams.bloomStrength,
        bloomParams.bloomRadius,
        bloomParams.bloomThreshold
    );

    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Set initial bloom state after composer creation
    bloomPass.enabled = isHalo;

    // Halo Mode Toggle
    const haloToggle = document.getElementById('halo-checkbox');
    if (haloToggle) {
        haloToggle.onchange = (e) => setHalo(e.target.checked);
    }

    // 3D Menu Toggle
    const menu3dToggle = document.getElementById('menu3d-checkbox');
    if (menu3dToggle) {
        // Sync initial state
        if (menuOrbit) menuOrbit.visible = menu3dToggle.checked;
        
        menu3dToggle.onchange = (e) => {
            if (menuOrbit) menuOrbit.visible = e.target.checked;
        };
    }



    // --- UI Synchronizers & Safe Listeners ---
    const safeUpdateLabel = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    const syncUI = (c, o) => {
        state.coreColor = c; state.orbitColor = o;
        const coreIn = document.getElementById('c-core');
        const orbitIn = document.getElementById('c-orbit');
        if (coreIn) coreIn.value = c;
        if (orbitIn) orbitIn.value = o;

        document.documentElement.style.setProperty('--accent', c);
        document.documentElement.style.setProperty('--core-color', c);
        if (coreMesh) coreMesh.material.color.set(c);
        if (wireframeMesh) wireframeMesh.material.color.set(c);
        if (trailLines) trailLines.material.color.set(o);
        if (particlePoints) particlePoints.material.color.set(o);
        updateTitleSpeed(state.speed);
    };

    const cCore = document.getElementById('c-core');
    if (cCore) cCore.oninput = (e) => {
        const val = e.target.value;
        syncUI(val, state.orbitColor);
        document.documentElement.style.setProperty('--core-color', val);
    };

    const cOrbit = document.getElementById('c-orbit');
    if (cOrbit) cOrbit.oninput = (e) => syncUI(state.coreColor, e.target.value);

    // Sidebar Sliders (Hidden inputs for 3D sync)
    const cCount = document.getElementById('c-count');
    if (cCount) cCount.oninput = (e) => {
        state.particleCount = parseInt(e.target.value);
        safeUpdateLabel('v-count', state.particleCount);
    };

    const cSens = document.getElementById('c-sens');
    if (cSens) cSens.oninput = (e) => {
        state.lerp = parseFloat(e.target.value);
        safeUpdateLabel('v-sens', state.lerp.toFixed(2));
    };

    const cSpeed = document.getElementById('c-speed');
    if (cSpeed) cSpeed.oninput = (e) => {
        state.speed = parseFloat(e.target.value);
        safeUpdateLabel('v-speed', state.speed.toFixed(1) + 'x');
        updateTitleSpeed(state.speed);
    };

    const cOpacity = document.getElementById('c-opacity');
    if (cOpacity) cOpacity.oninput = (e) => {
        state.opacity = parseFloat(e.target.value);
        safeUpdateLabel('v-opacity', state.opacity.toFixed(2));
        if (coreMesh) coreMesh.material.opacity = state.opacity;
    };

    const cRadius = document.getElementById('c-radius');
    if (cRadius) cRadius.oninput = (e) => {
        state.radius = parseFloat(e.target.value);
        safeUpdateLabel('v-radius', state.radius.toFixed(2));
    };

    const cTrail = document.getElementById('c-trail');
    if (cTrail) cTrail.oninput = (e) => {
        state.trail = parseInt(e.target.value);
        safeUpdateLabel('v-trail', state.trail);
    };

    const cDamping = document.getElementById('c-damping');
    if (cDamping) cDamping.oninput = (e) => {
        state.damping = parseFloat(e.target.value);
        safeUpdateLabel('v-damping', state.damping.toFixed(2));
    };

    const aiBtn = document.getElementById('ai-gen-btn');
    if (aiBtn) aiBtn.onclick = async () => {
        const p = document.getElementById('ai-prompt')?.value;
        if (!p) return;
        aiBtn.disabled = true; aiBtn.innerText = "分析中";
        const res = await fetchAiColors(p);
        if (res) syncUI(res.core, res.orbit);
        aiBtn.disabled = false; aiBtn.innerText = "赋予";
    };

    setupBetaUI();

    animate();
}

function animate() {
    requestAnimationFrame(animate);

    // Highliht Animation
    for (let i = clickHighlights.length - 1; i >= 0; i--) {
        const h = clickHighlights[i];
        h.material.opacity -= 0.04;
        if (h.material.opacity <= 0) {
            coreMesh.remove(h);
            h.geometry.dispose();
            h.material.dispose();
            clickHighlights.splice(i, 1);
        }
    }

    // Beta 2: Sync Shader Time
    if (coreMesh && coreMesh.material.userData.pulses) {
        coreMesh.material.userData.pulses.uTime.value = performance.now() / 1000;
    }


    // Auto-Leveling Mechanism (Spring Physics)
    if (isAutoLeveling) {
        // Spring force toward initial elevation
        const elevationForce = (INITIAL_ELEVATION - currentElevation) * state.springStrength;
        elevationVelocity += elevationForce;
        elevationVelocity *= state.damping;
        currentElevation += elevationVelocity;
        targetElevation = currentElevation;

        // Spring force toward initial azimuth (optional, for full reset)
        const azimuthForce = (INITIAL_AZIMUTH - currentAzimuth) * state.springStrength;
        azimuthVelocity += azimuthForce;
        azimuthVelocity *= state.damping;
        currentAzimuth += azimuthVelocity;
        targetAzimuth = currentAzimuth;

        // Stop auto-leveling when close enough and velocity is low
        if (Math.abs(currentElevation - INITIAL_ELEVATION) < 0.001 && Math.abs(elevationVelocity) < 0.0001 &&
            Math.abs(currentAzimuth - INITIAL_AZIMUTH) < 0.001 && Math.abs(azimuthVelocity) < 0.0001) {
            isAutoLeveling = false;
            elevationVelocity = 0;
            azimuthVelocity = 0;
        }
    }

    // Standard rotation (Y-axis spin)
    const rotationSpeed = 0.001 * state.speed;
    coreMesh.rotation.y += rotationSpeed;
    wireframeMesh.rotation.y += rotationSpeed;

    // Deep Space Auto-Rotation
    if (skyboxMesh) {
        skyboxMesh.rotation.x += 0.0001;
        skyboxMesh.rotation.y += 0.0002;
    }

    // Update Aurora Shader
    if (auroraMaterial && auroraDisc.visible) {
        auroraMaterial.uniforms.uTime.value += 0.01 * state.speed;
        auroraMaterial.uniforms.uColor.value.set(state.orbitColor);
    }

    // Update Global Stardust
    if (stardustSystem) {
        stardustSystem.rotation.y += 0.0005; // Parallax motion
        stardustSystem.material.uniforms.uTime.value += 0.01;
    }

    // Update Void Embers (Drift)
    if (voidEmbersSystem) {
        const pos = voidEmbersSystem.geometry.attributes.position;
        const speeds = voidEmbersSystem.userData.speeds;
        for (let i = 0; i < speeds.length; i++) {
            const s = speeds[i];
            const time = Date.now() * 0.001;
            pos.array[i * 3] += s.x + Math.sin(time + s.phase) * 0.05;
            pos.array[i * 3 + 1] += s.y + Math.cos(time + s.phase) * 0.05;
            pos.array[i * 3 + 2] += s.z + Math.sin(time * 0.5 + s.phase) * 0.05;

            // Boundary reset (keep near core)
            const dist = Math.sqrt(pos.array[i * 3] ** 2 + pos.array[i * 3 + 1] ** 2 + pos.array[i * 3 + 2] ** 2);
            if (dist > 400) {
                pos.array[i * 3] *= 0.5; pos.array[i * 3 + 1] *= 0.5; pos.array[i * 3 + 2] *= 0.5;
            }
        }
        pos.needsUpdate = true;
    }



    // Update Particle System (Pure Flow Trails)
    if (particleSystem) {
        particleSystem.update(state, PLANET_RADIUS);
    }



    currentAzimuth += (targetAzimuth - currentAzimuth) * state.lerp;
    currentElevation += (targetElevation - currentElevation) * state.lerp;
        currentRadius += (targetRadius - currentRadius) * state.lerp;

    camera.position.set(
        currentRadius * Math.cos(currentElevation) * Math.sin(currentAzimuth),
        currentRadius * Math.sin(currentElevation),
        currentRadius * Math.cos(currentElevation) * Math.cos(currentAzimuth)
    );
    camera.lookAt(0, 0, 0);

    // Keep skybox centered on camera so it feels infinite
    if (skyboxMesh) skyboxMesh.position.copy(camera.position);

    // 动态更新 PlanetaryGame 目标的高光和透明度 (背对时自然变暗变透明)
    if (PlanetaryGame && PlanetaryGame.isPlaying) {
        PlanetaryGame.targets.forEach(target => {
            const targetNormal = new THREE.Vector3(0, 1, 0).transformDirection(target.matrixWorld).normalize();
            const viewDir = new THREE.Vector3().subVectors(camera.position, target.getWorldPosition(new THREE.Vector3())).normalize();
            const dot = targetNormal.dot(viewDir);
            
            // 平滑过渡 (dot 取值: 正面 1，边缘 0，背面 -1)
            // dot 在 -0.1 到 +0.2 之间进行插值
            const factor = Math.max(0, Math.min(1, (dot + 0.1) / 0.3)); 
            
            target.material.emissiveIntensity = 0.05 + 0.95 * factor;
            target.material.opacity = 0.15 + 0.75 * factor;
        });
    }

    updateHUD();

    if (composer && !state.perfMode) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }

    // --- Beta 2 (Hidden Audio): Gesture Drone Modulation ---
    if (window.betaManager.getState('beta-audio-2') && droneAudioCtx) {
        const baseGain = (state.sfxVolume || 0.2) * 0.05; // 5% base hum
        if (isHandDetected && !isFrozen) {
            const targetFreq = 120 + (handVelocity * 20);
            const targetGain = (state.sfxVolume || 0.2) * 0.5;
            droneOsc.frequency.setTargetAtTime(targetFreq, droneAudioCtx.currentTime, 0.05);
            droneGain.gain.setTargetAtTime(targetGain + baseGain, droneAudioCtx.currentTime, 0.1);
        } else {
            droneGain.gain.setTargetAtTime(baseGain, droneAudioCtx.currentTime, 0.3);
        }
    } else if (droneGain) {
        droneGain.gain.setTargetAtTime(0, droneAudioCtx.currentTime, 0.3);
    }

    // --- Beta 1 (Hidden Audio): Stable Field Modulation ---
    if (window.betaManager.getState('beta-audio-1') && droneAudioCtx && droneOsc2) {
        const baseGain = (state.sfxVolume || 0.2) * 0.05;
        const targetGain = (state.sfxVolume || 0.2) * 0.35;
        
        if (isHandDetected) {
            if (isFrozen && !lastIsFrozen) playTransitionSFX('freeze');
            else if (!isFrozen && lastIsFrozen) playTransitionSFX('unlock');

            if (!isFrozen) {
                droneGain2.gain.setTargetAtTime(targetGain + baseGain, droneAudioCtx.currentTime, 0.1);
            } else {
                droneGain2.gain.setTargetAtTime(baseGain, droneAudioCtx.currentTime, 0.1);
            }
        } else {
            droneGain2.gain.setTargetAtTime(baseGain, droneAudioCtx.currentTime, 0.2);
        }
        lastIsFrozen = isFrozen;
    } else if (droneGain2) {
        droneGain2.gain.setTargetAtTime(0, droneAudioCtx.currentTime, 0.2);
    }
}

function updateHUD() {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Smooth Alpha Transition (Fade In/Out)
    const targetAlpha = isHandDetected ? 1.0 : 0.0;
    hudAlpha += (targetAlpha - hudAlpha) * 0.15;

    if (isHandDetected) {
        // Reset if it's a new detection (prevent jump lines)
        if (Date.now() - lastDetectionTime > 500) {
            hudTrail.length = 0;
        }
        lastDetectionTime = Date.now();
        
        hudTrail.push({ x: currentHandPos.x, y: currentHandPos.y });
        if (hudTrail.length > HUD_TRAIL_MAX) hudTrail.shift();
    } else {
        // Fade out trail points over time
        if (hudTrail.length > 0) {
            hudTrail.shift();
        }
    }

    // Stop rendering if completely invisible
    if (hudAlpha < 0.01 && hudTrail.length === 0) return;

    // Fluid Ribbon Rendering
    const baseColor = (isFrozen) ? '255,71,87' : `${parseInt(state.coreColor.slice(1,3),16)},${parseInt(state.coreColor.slice(3,5),16)},${parseInt(state.coreColor.slice(5,7),16)}`;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (hudTrail.length >= 2) {
        for (let i = 0; i < hudTrail.length - 1; i++) {
            const t = i / (hudTrail.length - 1);
            ctx.beginPath();
            ctx.moveTo(hudTrail[i].x, hudTrail[i].y);
            ctx.lineTo(hudTrail[i + 1].x, hudTrail[i + 1].y);
            
            // Multiply internal trail alpha by global hudAlpha
            ctx.strokeStyle = `rgba(${baseColor}, ${t * 0.6 * hudAlpha})`;
            ctx.lineWidth = 1 + t * 5;
            ctx.stroke();
        }
    }

    // Draw main glowing dot at the head (or last known head)
    if (hudTrail.length > 0) {
        const head = hudTrail[hudTrail.length - 1];
        drawGlowingDot(head.x, head.y, 6, hudAlpha);
    }
}

function drawGlowingDot(x, y, r, alpha) {
    const baseColor = (isFrozen) ? '255,71,87' : `${parseInt(state.coreColor.slice(1,3),16)},${parseInt(state.coreColor.slice(3,5),16)},${parseInt(state.coreColor.slice(5,7),16)}`;
    ctx.shadowBlur = 16 * alpha;
    ctx.shadowColor = `rgba(${baseColor}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${baseColor}, ${alpha})`;
    ctx.fill();
    ctx.shadowBlur = 0;
}

const video = document.querySelector('.input_video');
const canvas = document.getElementById('hand-canvas');
const ctx = canvas.getContext('2d');
canvas.width = 180; canvas.height = 135;

// 3D Menu Variables
let menuOrbit;
const menuPanels = [];
const PANEL_RADIUS = 500;

function createMenuTexture(title, valueLabel, color, key) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Percentage of slider fill
    const ranges = {
        particleCount: [0, 5000],
        lerp: [0.01, 0.3],
        speed: [0, 5],
        opacity: [0, 1],
        radius: [1.5, 4.0],
        trail: [0, 25],
        damping: [0, 1],
        verticalSpread: [0.01, 0.5]
    };
    const r = ranges[key] || [0, 1];
    const pct = (state[key] - r[0]) / (r[1] - r[0]);

    // Background - Glassmorphism style
    ctx.fillStyle = 'rgba(0, 20, 40, 0.7)';
    // Native roundRect support check
    if (ctx.roundRect) {
        ctx.roundRect(50, 50, 924, 412, 30);
    } else {
        ctx.rect(50, 50, 924, 412);
    }
    ctx.fill();

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 15;
    ctx.stroke();

    // Title
    ctx.fillStyle = color;
    ctx.font = 'bold 80px PingFang SC, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, 512, 160);

    // Value Label
    ctx.font = '60px PingFang SC, Arial';
    ctx.fillText(valueLabel, 512, 260);

    // Slider Track
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 30;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(150, 360);
    ctx.lineTo(874, 360);
    ctx.stroke();

    // Slider Fill
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(150, 360);
    ctx.lineTo(150 + (874 - 150) * Math.max(0, Math.min(1, pct)), 360);
    ctx.stroke();

    return new THREE.CanvasTexture(canvas);
}

function updateMenuTexture(panel) {
    const { title, key, color, formatter } = panel.userData;
    let val = state[key];
    const label = formatter ? formatter(val) : val;
    panel.material.map = createMenuTexture(title, label, color, key);
    panel.material.map.needsUpdate = true;
}

function create3DMenu() {
    menuOrbit = new THREE.Group();
    // Parenting to coreMesh so it follows planet rotation
    if (coreMesh) {
        coreMesh.add(menuOrbit);
    } else {
        scene.add(menuOrbit);
    }

    const configs = [
        { title: '粒子密度', key: 'particleCount', color: '#8ef9fc', formatter: (b) => Math.round(b) },
        { title: '传感平滑', key: 'lerp', color: '#8efcc4', formatter: (b) => b.toFixed(2) },
        { title: '核心转速', key: 'speed', color: '#fcfc8e', formatter: (b) => b.toFixed(1) + 'X' },
        { title: '核心透明', key: 'opacity', color: '#f472b6', formatter: (b) => b.toFixed(2) },
        { title: '流光半径', key: 'radius', color: '#8b5cf6', formatter: (b) => b.toFixed(2) },
        { title: '环层厚度', key: 'verticalSpread', color: '#FF9900', formatter: (b) => (b * 100).toFixed(0) + '%' },
        { title: '轨迹残影', key: 'trail', color: '#ec4899', formatter: (b) => Math.round(b) },
        { title: '弹性阻尼', key: 'damping', color: '#6366f1', formatter: (b) => b.toFixed(2) }
    ];

    const geom = new THREE.PlaneGeometry(160, 80);

    configs.forEach((cfg, i) => {
        const mat = new THREE.MeshBasicMaterial({
            map: null, // Set in update
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geom, mat);

        // Flip mesh to fix mirrored text when facing center
        mesh.scale.x = -1;

        const angle = (i / configs.length) * Math.PI * 2;
        mesh.position.set(Math.cos(angle) * PANEL_RADIUS, 0, Math.sin(angle) * PANEL_RADIUS);
        mesh.lookAt(0, 0, 0);

        mesh.userData = cfg;
        menuPanels.push(mesh);
        menuOrbit.add(mesh);
        updateMenuTexture(mesh);
    });
}

let lastStatusText = "";

function updateSensorStatus(text, stateType = 'active') {
    if (text === lastStatusText) return;
    lastStatusText = text;

    const hud = document.getElementById('sensor-hud');
    if (!hud) return;

    // 只切换状态类（发光/边框/透明度全部由 CSS 控制）
    hud.className = `cyber-hud status-${stateType}`;

    // 同步系统主题色变量
    document.documentElement.style.setProperty('--core-color', state.coreColor);
}

function dismissLoader() {
    const loader = document.getElementById('loader');
    if (loader && loader.style.display !== 'none') {
        loader.style.transition = 'opacity 0.8s ease';
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 800);
    }
}

function onResults(res) {
    dismissLoader();

    if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
        isHandDetected = true;
        isAutoLeveling = false;
        const marks = res.multiHandLandmarks[0];
        const point = marks[9];
        
        currentHandPos.x = point.x * canvas.width;
        currentHandPos.y = point.y * canvas.height;
        
        // Velocity tracking for Drone
        const dx = currentHandPos.x - lastHandPosForVelocity.x;
        const dy = currentHandPos.y - lastHandPosForVelocity.y;
        handVelocity = Math.sqrt(dx * dx + dy * dy);
        lastHandPosForVelocity.x = currentHandPos.x;
        lastHandPosForVelocity.y = currentHandPos.y;

        const wrist = marks[0];
        const fingerTips = [8, 12, 16, 20];
        const fingerMids = [6, 10, 14, 18];
        let openCount = 0;
        fingerTips.forEach((t, i) => { if (marks[t].y < marks[fingerMids[i]].y) openCount++; });

        isFrozen = openCount < 2;

        if (!isFrozen) {
            targetAzimuth -= (point.x - 0.5) * 0.25;
            targetElevation = Math.max(-1.4, Math.min(1.4, targetElevation - (point.y - 0.5) * 0.22));
            updateSensorStatus("TRACKING", "active");
        } else {
            updateSensorStatus("LOCKED", "locked");
        }
    } else {
        isHandDetected = false;
        if (!isAutoLeveling) {
            isAutoLeveling = true;
            elevationVelocity = 0; azimuthVelocity = 0;
        }
        updateSensorStatus("SIGNAL LOST", "idle");
    }
    updateHUD();
}

function updateTitleSpeed(speed) {
    const title = document.querySelector('.hud-title');
    if (title) {
        // formula: duration = 10 / speed (faster speed = shorter duration)
        const duration = 10 / Math.max(0.1, speed);
        title.style.setProperty('--flow-speed', duration + 's');
    }
}

const hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
hands.onResults(onResults);

function initCamera() {
    const cam = new Camera(video, { 
        onFrame: async () => {
            try {
                await hands.send({ image: video });
            } catch (e) {
                console.error("Hands processing failed:", e);
            }
        }, 
        width: 180, 
        height: 135 
    });
    
    cam.start().catch(err => {
        console.error("Camera failed to start:", err);
        updateSensorStatus("CAMERA ERROR", "idle");
        dismissLoader(); // Fallback: allow entry even if camera fails
    });
}

window.onload = () => {
    init();
    initSidebarCanvas();
    initCamera(); // Start camera after window load to ensure everything is ready

    // Safety Net: If onResults hasn't fired in 6 seconds, dismiss loader anyway
    setTimeout(() => {
        dismissLoader();
    }, 6000);
};

function initSidebarCanvas() {
    const canvas = document.getElementById('sidebar-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const menu = document.getElementById('hybrid-menu');
    
    let width, height;
    function resizeCanvas() {
        width = canvas.width = menu.clientWidth;
        height = canvas.height = menu.clientHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    const particles = [];
    const count = 18; // Increased by 50% (from 12 to 18)
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8,
            radius: Math.random() * 2.25 + 0.75,
            hasConnection: false // Track connectivity
        });
    }

    function animateNetwork() {
        ctx.clearRect(0, 0, width, height);
        
        // Reset connection status
        particles.forEach(p => p.hasConnection = false);

        // Update & Draw nodes
        ctx.fillStyle = 'rgba(210, 245, 255, 0.9)';
        for (let i = 0; i < count; i++) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            
            if (p.x < 0 || p.x > width) p.vx *= -1;
            if (p.y < 0 || p.y > height) p.vy *= -1;
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 1. Natural Proximity Connections
        ctx.lineWidth = 0.8;
        for (let i = 0; i < count; i++) {
            for (let j = i + 1; j < count; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 85) {
                    particles[i].hasConnection = true;
                    particles[j].hasConnection = true;
                    const alpha = 1 - (dist / 85);
                    ctx.strokeStyle = `rgba(210, 245, 255, ${alpha})`;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }

        // 2. Force Connections for solitary particles (No single dots)
        particles.forEach((p, i) => {
            if (!p.hasConnection) {
                let nearestDist = Infinity;
                let nearestIdx = -1;
                
                particles.forEach((p2, j) => {
                    if (i === j) return;
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const d = dx * dx + dy * dy;
                    if (d < nearestDist) {
                        nearestDist = d;
                        nearestIdx = j;
                    }
                });

                if (nearestIdx !== -1) {
                    const actualDist = Math.sqrt(nearestDist);
                    // Fade out force-connections if they are very far, but maintain minimum visibility
                    const alpha = Math.max(0.2, 1 - (actualDist / 150)); 
                    ctx.strokeStyle = `rgba(210, 245, 255, ${alpha})`;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(particles[nearestIdx].x, particles[nearestIdx].y);
                    ctx.stroke();
                }
            }
        });


        
        requestAnimationFrame(animateNetwork);
    }
    
    animateNetwork();
}

window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
};

function initClickInteraction() {
    raycaster = new THREE.Raycaster();

    // --- 新增：悬停触碰检测 (Planetary Game) ---
    window.addEventListener('mousemove', (event) => {
        if (!PlanetaryGame || !PlanetaryGame.isPlaying || PlanetaryGame.targets.length === 0) return;
        
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const gameIntersects = raycaster.intersectObjects(PlanetaryGame.targets);
        if (gameIntersects.length > 0) {
            const hit = gameIntersects[0];
            
            // --- 核心修复：判断目标是否朝向摄像机（过滤背面目标） ---
            // 获取目标在世界坐标系下的法线（Y轴正方向即面上方）
            const targetNormal = new THREE.Vector3(0, 1, 0).transformDirection(hit.object.matrixWorld).normalize();
            // 相机视线方向
            const viewDir = new THREE.Vector3().subVectors(camera.position, hit.point).normalize();
            
            // 如果法线和视线夹角超过90度（点乘 < 0），说明玩家在看目标的底面/背面，忽略之
            if (targetNormal.dot(viewDir) < 0) return;

            PlanetaryGame.handleHit(hit.object);
            
            // --- 触发原版球面点击特效（波纹与三角高亮） ---
            const coreIntersects = raycaster.intersectObject(coreMesh);
            if (coreIntersects.length > 0) {
                const intersect = coreIntersects[0];
                const face = intersect.face;
                // 生成三角高亮发光面
                const geom = new THREE.BufferGeometry();
                const posAttr = coreMesh.geometry.attributes.position;
                const a = new THREE.Vector3().fromBufferAttribute(posAttr, face.a);
                const b = new THREE.Vector3().fromBufferAttribute(posAttr, face.b);
                const c = new THREE.Vector3().fromBufferAttribute(posAttr, face.c);
                geom.setFromPoints([a, b, c]);
                geom.computeVertexNormals();
                const mat = new THREE.MeshBasicMaterial({ 
                    color: 0xffffff, transparent: true, opacity: 0.8, 
                    side: THREE.DoubleSide, depthTest: false 
                });
                mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -1;
                const highlightMesh = new THREE.Mesh(geom, mat);
                coreMesh.add(highlightMesh);
                clickHighlights.push(highlightMesh);

                // 发射波纹扩散信号
                window.dispatchEvent(new CustomEvent('sphere-pulse-click', { detail: intersect }));
            }
        }
    }, { passive: true });

    window.addEventListener('mousedown', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // 优先级 1: 行星挑战进行时，阻断一切点击波纹和菜单交互
        if (PlanetaryGame && PlanetaryGame.isPlaying) {
            return;
        }

        // 定义剩余目标：3D 菜单面板（优先级2）、核心（优先级3）
        const targets = [];
        if (menuOrbit && menuOrbit.visible) {
            targets.push(...menuPanels);
        }
        targets.push(coreMesh);

        // Single raycast against all candidates, sorted by distance
        const intersects = raycaster.intersectObjects(targets);
        
        if (intersects.length > 0) {
            const intersect = intersects[0]; // Closest hit
            const target = intersect.object;

            // 过滤残留的旧目标 userData（安全防线）
            if (target.userData && target.userData.isPlanetTarget) {
                if (PlanetaryGame) PlanetaryGame.handleHit(target);
                event.stopPropagation();
                return;
            }

            // 1. Check if we hit a Menu Panel
            if (menuPanels.includes(target)) {
                const uvX = intersect.uv.x;
                const { key } = target.userData;
                const ranges = {
                    particleCount: [0, 5000],
                    lerp: [0.01, 0.3],
                    speed: [0, 5],
                    opacity: [0.1, 1],
                    radius: [1.5, 4.0],
                    trail: [0, 25],
                    damping: [0, 1],
                    verticalSpread: [0.01, 0.5],
                    volume: [0, 1]
                };

                const range = ranges[key];
                const newValue = range[0] + (range[1] - range[0]) * uvX;

                state[key] = newValue;
                if (key === 'opacity') coreMesh.material.opacity = newValue;
                if (key === 'speed') updateTitleSpeed(newValue);

                updateMenuTexture(target);
                return;
            }

            // 2. Check if we hit the Core Mesh
            if (target === coreMesh) {
                const face = intersect.face;
                const geom = new THREE.BufferGeometry();
                const posAttr = target.geometry.attributes.position;
                const a = new THREE.Vector3().fromBufferAttribute(posAttr, face.a);
                const b = new THREE.Vector3().fromBufferAttribute(posAttr, face.b);
                const c = new THREE.Vector3().fromBufferAttribute(posAttr, face.c);
                geom.setFromPoints([a, b, c]);
                geom.computeVertexNormals();
                const mat = new THREE.MeshBasicMaterial({ 
                    color: 0xffffff, 
                    transparent: true, 
                    opacity: 0.8, 
                    side: THREE.DoubleSide, 
                    depthTest: false 
                });
                mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -1;
                const highlightMesh = new THREE.Mesh(geom, mat);
                coreMesh.add(highlightMesh);
                clickHighlights.push(highlightMesh);

                // Click Pulse: Always trigger event (Integrated)
                window.dispatchEvent(new CustomEvent('sphere-pulse-click', { detail: intersect }));
            }
        }
    });
}


