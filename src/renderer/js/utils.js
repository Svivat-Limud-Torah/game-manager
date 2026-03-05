// ==================== Utility Functions ====================

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatRelativeTime(date) {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'עכשיו';
    if (minutes < 60) return `לפני ${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `לפני ${hours} שע'`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'אתמול';
    return `לפני ${days} ימים`;
}

function formatPlayTime(minutes) {
    if (!minutes || minutes < 1) return null;
    if (minutes < 60) return `${minutes} דק'`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}ש' ${m}ד'` : `${h} שע'`;
}

function getRankEmoji(index) {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return index + 1;
}

// ==================== Sound ====================

function playSound(name) {
    if (!soundEnabled) return;
    const src = SOUND_MAP[name];
    if (!src) return;
    if (!soundCache[name]) {
        soundCache[name] = new Audio(src);
    }
    const audio = soundCache[name];
    audio.volume = soundVolume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
}

function toggleVolumePopup() {
    const popup = document.getElementById('volume-popup');
    if (!popup) return;
    popup.classList.toggle('hidden');
}

function toggleVolumeMute() {
    soundEnabled = !soundEnabled;
    updateVolumeIcon();
    const cb = document.getElementById('pref-sound');
    if (cb) cb.checked = soundEnabled;
    window.api.customization.toggleSound(soundEnabled);
    playSound('click');
}

function onVolumeSliderInput(val) {
    soundVolume = val / 100;
    document.getElementById('volume-pct').textContent = `${val}%`;
    updateVolumeTrackFill(val);
    window.api.customization.setVolume(soundVolume);
}

function updateVolumeIcon() {
    const icon = document.getElementById('volume-icon');
    const muteBtn = document.getElementById('volume-mute-btn');
    if (!icon) return;
    if (!soundEnabled) {
        icon.textContent = '🔇';
        if (muteBtn) { muteBtn.textContent = '🔊 בטל השתקה'; muteBtn.classList.add('muted'); }
    } else if (soundVolume === 0) {
        icon.textContent = '🔇';
        if (muteBtn) { muteBtn.textContent = '🔇 השתק'; muteBtn.classList.remove('muted'); }
    } else if (soundVolume < 0.4) {
        icon.textContent = '🔈';
        if (muteBtn) { muteBtn.textContent = '🔇 השתק'; muteBtn.classList.remove('muted'); }
    } else {
        icon.textContent = '🔊';
        if (muteBtn) { muteBtn.textContent = '🔇 השתק'; muteBtn.classList.remove('muted'); }
    }
}

function updateVolumeTrackFill(pct) {
    const slider = document.getElementById('volume-slider');
    if (slider) slider.style.setProperty('--fill', `${pct}%`);
}

// ==================== Confirm Modal ====================

function showConfirm(message, { title = '⚠️ אישור', confirmText = 'כן, אני בטוח', cancelText = 'ביטול', danger = true } = {}) {
    return new Promise(resolve => {
        _confirmResolve = resolve;
        document.getElementById('confirm-modal-title').textContent = title;
        document.getElementById('confirm-modal-message').textContent = message;
        const okBtn = document.getElementById('confirm-ok-btn');
        okBtn.textContent = confirmText;
        okBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
        okBtn.onclick = () => closeConfirm(true);
        document.getElementById('confirm-cancel-btn').textContent = cancelText;
        document.getElementById('confirm-cancel-btn').onclick = () => closeConfirm(false);
        document.getElementById('confirm-modal').classList.remove('hidden');
    });
}

function closeConfirm(value) {
    document.getElementById('confirm-modal').classList.add('hidden');
    if (_confirmResolve) {
        const cb = _confirmResolve;
        _confirmResolve = null;
        cb(value);
    }
}

// ==================== Loading Skeleton ====================

function showSkeleton(containerId, count = 4, type = 'card') {
    const el = document.getElementById(containerId);
    if (!el) return;
    const tmpl = type === 'list'
        ? `<div class="skeleton-row"><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text-sm"></div></div>`
        : `<div class="skeleton-card"><div class="skeleton skeleton-icon"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text-sm"></div></div>`;
    el.innerHTML = Array(count).fill(tmpl).join('');
}

// ==================== Live Clock ====================

function startClock() {
    function tick() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        const el = document.getElementById('clock-time');
        if (el) el.textContent = `${h}:${m}:${s}`;
    }
    tick();
    setInterval(tick, 1000);
}

// ==================== Tooltips ====================

function setupTooltips() {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;
    document.addEventListener('mouseover', e => {
        const el = e.target.closest('[data-tooltip]');
        if (!el) return;
        const text = el.dataset.tooltip;
        if (!text) return;
        tooltip.textContent = text;
        tooltip.classList.add('visible');
    });
    document.addEventListener('mouseout', e => {
        if (e.target.closest('[data-tooltip]')) tooltip.classList.remove('visible');
    });
    document.addEventListener('mousemove', e => {
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top  = (e.clientY - 10) + 'px';
    });
}

// ==================== PIN Modal ====================

function showPinModal(message) {
    return new Promise((resolve) => {
        pinResolve = resolve;
        document.getElementById('pin-modal').classList.remove('hidden');
        document.getElementById('pin-modal-message').textContent = message || 'הזן קוד PIN של ההורה';
        document.getElementById('pin-input').value = '';
        document.getElementById('pin-error').classList.add('hidden');
        document.getElementById('pin-input').focus();

        document.getElementById('pin-confirm-btn').onclick = () => {
            const pin = document.getElementById('pin-input').value;
            if (!pin) {
                document.getElementById('pin-error').textContent = 'יש להזין קוד';
                document.getElementById('pin-error').classList.remove('hidden');
                return;
            }
            document.getElementById('pin-modal').classList.add('hidden');
            pinResolve = null;
            resolve(pin);
        };

        document.getElementById('pin-input').onkeydown = (e) => {
            if (e.key === 'Enter') document.getElementById('pin-confirm-btn').click();
        };
    });
}

function closePinModal() {
    document.getElementById('pin-modal').classList.add('hidden');
    if (pinResolve) { pinResolve(null); pinResolve = null; }
}

// ==================== Image Modal ====================

function showItemImage(src, name) {
    document.getElementById('modal-image').src = src;
    document.getElementById('modal-item-name').textContent = name;
    document.getElementById('image-modal').classList.remove('hidden');
}

function closeImageModal() {
    document.getElementById('image-modal').classList.add('hidden');
}

// ==================== Confetti ====================

(function initConfettiCanvas() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animId = null;

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    function randBetween(a, b) { return a + Math.random() * (b - a); }

    function makeParticle(x, y, vx, vy, color, shape) {
        return { x, y, vx, vy, color, shape: shape || 'rect',
                 size: randBetween(6, 14), rotation: randBetween(0, Math.PI * 2),
                 rotSpeed: randBetween(-0.12, 0.12), alpha: 1, gravity: 0.35 };
    }

    const PALETTES = {
        levelup:     ['#6c5ce7','#a29bfe','#ffd700','#fdcb6e','#fff'],
        achievement: ['#f39c12','#ffd700','#fdcb6e','#e17055','#fff'],
        purchase:    ['#00cec9','#55efc4','#6c5ce7','#a29bfe','#ffeaa7'],
        birthday:    ['#fd79a8','#e17055','#74b9ff','#55efc4','#ffd700','#a29bfe','#fff'],
    };

    function burst(type) {
        resize();
        const W = canvas.width, H = canvas.height;
        const palette = PALETTES[type] || PALETTES.birthday;
        particles = [];

        if (type === 'levelup') {
            for (let i = 0; i < 120; i++) {
                const angle = (i / 120) * Math.PI * 2;
                const speed = randBetween(4, 14);
                particles.push(makeParticle(W/2, H/2, Math.cos(angle)*speed, Math.sin(angle)*speed - 3, palette[i % palette.length]));
            }
        } else if (type === 'achievement') {
            for (let i = 0; i < 100; i++) {
                particles.push(makeParticle(randBetween(0, W), randBetween(-50, -5), randBetween(-2, 2), randBetween(3, 9), palette[i % palette.length]));
            }
        } else if (type === 'purchase') {
            for (let i = 0; i < 80; i++) {
                particles.push(makeParticle(randBetween(W*0.3, W*0.7), randBetween(-40, 0), randBetween(-3, 3), randBetween(4, 10), palette[i % palette.length], 'circle'));
            }
        } else {
            for (let i = 0; i < 200; i++) {
                const edge = Math.floor(Math.random() * 4);
                let x, y, vx, vy;
                if (edge === 0) { x = randBetween(0, W); y = -10; vx = randBetween(-3, 3); vy = randBetween(4, 12); }
                else if (edge === 1) { x = W+10; y = randBetween(0, H); vx = randBetween(-12, -4); vy = randBetween(-3, 3); }
                else if (edge === 2) { x = randBetween(0, W); y = H+10; vx = randBetween(-3, 3); vy = randBetween(-12, -4); }
                else { x = -10; y = randBetween(0, H); vx = randBetween(4, 12); vy = randBetween(-3, 3); }
                particles.push(makeParticle(x, y, vx, vy, palette[i % palette.length], i%3===0?'circle':'rect'));
            }
        }

        if (animId) cancelAnimationFrame(animId);
        animate();
    }

    function drawParticle(p) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        if (p.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, p.size/2, 0, Math.PI*2);
            ctx.fill();
        } else {
            ctx.fillRect(-p.size/2, -p.size/4, p.size, p.size/2);
        }
        ctx.restore();
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles = particles.filter(p => p.alpha > 0.02);
        if (particles.length === 0) { animId = null; return; }
        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= 0.99;
            p.rotation += p.rotSpeed;
            p.alpha -= 0.012;
            drawParticle(p);
        }
        animId = requestAnimationFrame(animate);
    }

    window.launchConfetti = burst;
})();

// ==================== Help Section ====================
function toggleHelp(btn) {
    const topic = btn.closest('.help-topic');
    const isOpen = topic.classList.contains('help-open');
    // Close all
    document.querySelectorAll('.help-topic.help-open').forEach(t => t.classList.remove('help-open'));
    if (!isOpen) topic.classList.add('help-open');
}
