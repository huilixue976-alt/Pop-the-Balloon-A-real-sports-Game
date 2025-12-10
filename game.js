// 游戏主逻辑
class BalloonGame {
    constructor() {
        // 游戏状态
        this.gameActive = false;
        this.gamePaused = false;
        this.gameTime = 60; // 默认游戏时间
        this.timeLeft = 60;
        this.score = 0;
        this.hits = 0;
        this.misses = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.gameTimer = null;
        
        // 摄像头权限状态
        this.cameraPermissionGranted = false;
        
        // 气球相关
        this.balloons = [];
        this.balloonSpeed = 3; // 1-5
        this.maxBalloons = 8;
        this.balloonSpawnInterval = null;
        
        // 运动检测相关
        this.motionCanvas = document.createElement('canvas');
        this.motionCtx = this.motionCanvas.getContext('2d');
        this.prevFrame = null;
        this.motionThreshold = 45; // 增加运动检测阈值，减少噪声导致的误报
        this.motionDetectionActive = false;
        this.lastMotionDetectionTime = 0;
        this.motionDetectionInterval = 150; // 每150毫秒检测一次运动，进一步减少误报
        this.motionSamplePoints = 10; // 增加检测点数量
        
        // 摄像头和画布
        this.video = document.getElementById('camera-video');
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 游戏元素
        this.scoreElement = document.getElementById('score');
        this.timeElement = document.getElementById('time');
        this.hitsElement = document.getElementById('hits');
        this.accuracyElement = document.getElementById('accuracy');
        
        // 设置元素
        this.gameTimeSlider = document.getElementById('game-time');
        this.timeValueElement = document.getElementById('time-value');
        this.balloonSpeedSlider = document.getElementById('balloon-speed');
        this.speedValueElement = document.getElementById('speed-value');
        this.balloonCountSlider = document.getElementById('balloon-count');
        this.countValueElement = document.getElementById('count-value');
        this.cameraModeSelect = document.getElementById('camera-mode');
        
        // 按钮
        this.startBtn = document.getElementById('start-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.fullscreenBtn = document.getElementById('fullscreen-btn');
        this.helpBtn = document.getElementById('help-btn');
        this.playAgainBtn = document.getElementById('play-again-btn-overlay');
        this.closeGameOverBtn = document.getElementById('close-game-over-btn-overlay');
        
        // 模态框和覆盖层
        this.helpModal = document.getElementById('help-modal');
        this.gameOverModal = document.getElementById('game-over-modal');
        this.gameOverOverlay = document.getElementById('game-over-overlay');
        this.closeModalButtons = document.querySelectorAll('.close-modal');
        
        // 游戏记录
        this.gameHistory = [];
        
    // 气球总数统计（用于准确率计算）
    this.totalBalloons = 0;
    
    // 音频元素
    this.popSound = null;
    this.missSound = null;
    
    // 初始化
    this.init();
    }
    
    init() {
        // 设置画布尺寸
        this.setCanvasSize();
        window.addEventListener('resize', () => this.setCanvasSize());
        
        // 设置运动检测画布尺寸
        this.motionCanvas.width = 80; // 进一步降低分辨率以提高性能
        this.motionCanvas.height = 60;
        
        // 初始化事件监听器
        this.initEventListeners();
        
        // 初始化设置滑块
        this.initSettings();
        
        // 初始化摄像头
        this.initCamera();
        
        // 加载声音文件
        this.loadSounds();
        
        // 开始游戏循环
        this.gameLoop();
    }
    
    setCanvasSize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }
    
    initEventListeners() {
        // 游戏控制按钮
        this.startBtn.addEventListener('click', () => this.toggleGame());
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        this.resetBtn.addEventListener('click', () => this.resetGame());
        this.helpBtn.addEventListener('click', () => this.showHelp());
        
        // 全屏按钮
        if (this.fullscreenBtn) {
            this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }
        
        // 全屏状态变化事件监听器（处理Esc键退出全屏）
        document.addEventListener('fullscreenchange', () => this.updateFullscreenButton());
        document.addEventListener('webkitfullscreenchange', () => this.updateFullscreenButton());
        document.addEventListener('mozfullscreenchange', () => this.updateFullscreenButton());
        document.addEventListener('MSFullscreenChange', () => this.updateFullscreenButton());
        
        // 游戏结束按钮
        this.playAgainBtn.addEventListener('click', () => {
            this.hideGameOver();
            this.resetGame();
            this.startGame();
        });
        
        this.closeGameOverBtn.addEventListener('click', () => this.hideGameOver());
        
        // 模态框关闭按钮
        this.closeModalButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.helpModal.style.display = 'none';
            });
        });
        
        // 点击模态框外部关闭
        window.addEventListener('click', (e) => {
            if (e.target === this.helpModal) {
                this.helpModal.style.display = 'none';
            }
            if (e.target === this.gameOverOverlay) {
                this.hideGameOver();
            }
        });
        
        // 画布点击事件（用于测试和调试）
        this.canvas.addEventListener('click', (e) => {
            if (!this.gameActive) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // 检查是否点击到气球
            this.checkBalloonHit(x, y);
        });
        
        // 触摸事件支持
        this.canvas.addEventListener('touchstart', (e) => {
            if (!this.gameActive) return;
            
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const touch = e.touches[0];
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            
            this.checkBalloonHit(x, y);
        });
    }
    
    initSettings() {
        // 游戏时长滑块
        this.gameTimeSlider.addEventListener('input', () => {
            this.gameTime = parseInt(this.gameTimeSlider.value);
            this.timeValueElement.textContent = this.gameTime;
            if (!this.gameActive) {
                this.timeLeft = this.gameTime;
                this.timeElement.textContent = this.timeLeft;
            }
        });
        
        // 气球速度滑块
        this.balloonSpeedSlider.addEventListener('input', () => {
            this.balloonSpeed = parseInt(this.balloonSpeedSlider.value);
            const speedLabels = ['很慢', '慢', '中等', '快', '很快'];
            this.speedValueElement.textContent = speedLabels[this.balloonSpeed - 1];
        });
        
        // 气球数量滑块
        this.balloonCountSlider.addEventListener('input', () => {
            this.maxBalloons = parseInt(this.balloonCountSlider.value);
            this.countValueElement.textContent = this.maxBalloons;
        });
    }
    
    async initCamera() {
        try {
            const constraints = {
                video: {
                    facingMode: this.cameraModeSelect.value,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = stream;
            this.cameraPermissionGranted = true; // 设置摄像头权限为已授予
            
            // 摄像头模式切换
            this.cameraModeSelect.addEventListener('change', async () => {
                if (this.video.srcObject) {
                    this.video.srcObject.getTracks().forEach(track => track.stop());
                }
                
                const newConstraints = {
                    video: {
                        facingMode: this.cameraModeSelect.value,
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                };
                
                try {
                    const newStream = await navigator.mediaDevices.getUserMedia(newConstraints);
                    this.video.srcObject = newStream;
                } catch (err) {
                    console.error('切换摄像头失败:', err);
                }
            });
            
            // 隐藏摄像头覆盖层
            document.querySelector('.camera-overlay').style.display = 'none';
            
        } catch (err) {
            console.error('摄像头访问失败:', err);
            this.cameraPermissionGranted = false; // 设置摄像头权限为未授予
            document.querySelector('.overlay-text').textContent = '摄像头访问失败，请检查权限';
            document.querySelector('.overlay-hint').textContent = '您仍然可以点击气球进行游戏';
        }
    }
    
    toggleGame() {
        if (!this.gameActive) {
            this.startGame();
        } else {
            this.endGame();
        }
    }
    
    startGame() {
        if (this.gameActive) return;
        
        // 检查摄像头权限
        if (!this.cameraPermissionGranted) {
            alert('请先允许使用摄像头才能开始游戏！\n\n请点击页面上的"允许摄像头"按钮或刷新页面重新授权。');
            return;
        }
        
        this.gameActive = true;
        this.gamePaused = false;
        this.timeLeft = this.gameTime;
        
        // 更新按钮状态
        this.startBtn.innerHTML = '<i class="fas fa-stop"></i> 结束游戏';
        this.startBtn.classList.remove('btn-primary');
        this.startBtn.classList.add('btn-danger');
        this.pauseBtn.disabled = false;
        
        // 清除现有气球
        this.balloons = [];
        
        // 重置运动检测
        this.prevFrame = null;
        this.motionDetectionActive = true;
        
        // 开始游戏计时器
        this.startGameTimer();
        
        // 开始生成气球
        this.startBalloonSpawning();
        
        // 更新UI
        this.updateUI();
    }
    
    endGame() {
        if (!this.gameActive) return;
        
        this.gameActive = false;
        
        // 清除计时器
        clearInterval(this.gameTimer);
        clearInterval(this.balloonSpawnInterval);
        
        // 更新按钮状态
        this.startBtn.innerHTML = '<i class="fas fa-play"></i> 开始游戏';
        this.startBtn.classList.remove('btn-danger');
        this.startBtn.classList.add('btn-primary');
        this.pauseBtn.disabled = true;
        this.pauseBtn.innerHTML = '<i class="fas fa-pause"></i> 暂停';
        
        // 显示游戏结束模态框
        this.showGameOver();
        
        // 保存游戏记录
        this.saveGameHistory();
    }
    
    togglePause() {
        if (!this.gameActive) return;
        
        this.gamePaused = !this.gamePaused;
        
        if (this.gamePaused) {
            // 暂停游戏
            clearInterval(this.gameTimer);
            clearInterval(this.balloonSpawnInterval);
            this.pauseBtn.innerHTML = '<i class="fas fa-play"></i> 继续';
        } else {
            // 继续游戏
            this.startGameTimer();
            this.startBalloonSpawning();
            this.pauseBtn.innerHTML = '<i class="fas fa-pause"></i> 暂停';
        }
    }
    
resetGame() {
    // 清除游戏状态
    this.gameActive = false;
    this.gamePaused = false;
    this.score = 0;
    this.hits = 0;
    this.misses = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.timeLeft = this.gameTime;
    
    // 重置气球总数统计
    this.totalBalloons = 0;
    
    // 清除气球
    this.balloons = [];
    
    // 重置运动检测
    this.prevFrame = null;
    this.motionDetectionActive = false;
    
    // 清除计时器
    clearInterval(this.gameTimer);
    clearInterval(this.balloonSpawnInterval);
    
    // 重置按钮状态
    this.startBtn.innerHTML = '<i class="fas fa-play"></i> 开始游戏';
    this.startBtn.classList.remove('btn-danger');
    this.startBtn.classList.add('btn-primary');
    this.pauseBtn.disabled = true;
    this.pauseBtn.innerHTML = '<i class="fas fa-pause"></i> 暂停';
    
    // 更新UI
    this.updateUI();
}
    
    startGameTimer() {
        clearInterval(this.gameTimer);
        
        this.gameTimer = setInterval(() => {
            if (!this.gamePaused) {
                this.timeLeft--;
                this.timeElement.textContent = this.timeLeft;
                
                if (this.timeLeft <= 0) {
                    this.endGame();
                }
            }
        }, 1000);
    }
    
    startBalloonSpawning() {
        clearInterval(this.balloonSpawnInterval);
        
        // 根据设置调整生成间隔
        const spawnInterval = 1500 - (this.balloonSpeed * 200); // 速度越快，生成间隔越短
        
        this.balloonSpawnInterval = setInterval(() => {
            if (!this.gamePaused && this.balloons.length < this.maxBalloons) {
                this.createBalloon();
            }
        }, spawnInterval);
    }
    
    createBalloon() {
        const colors = [
            '#FF6B6B', '#FFD166', '#FF9E6D', '#FF4081', '#7C4DFF',
            '#EF476F', '#FFEB3B', '#4CAF50', '#00BCD4', '#E91E63'
        ];
        
        const balloon = {
            x: Math.random() * (this.canvas.width - 100) + 50,
            y: Math.random() * (this.canvas.height - 100) + 50, // 在屏幕任意位置出现
            radius: 30 + Math.random() * 20,
            color: colors[Math.floor(Math.random() * colors.length)],
            speed: 0.5 + Math.random() * 0.5, // 减少移动速度，因为气球不再向上浮动
            popped: false,
            popAnimation: 0,
            floatOffset: Math.random() * Math.PI * 2,
            floatSpeed: 0.5 + Math.random() * 1,
            createTime: Date.now(), // 记录创建时间
            lifetime: 3000, // 气球出现3秒后自动消失
            directionX: Math.random() * 2 - 1, // 随机水平方向
            directionY: Math.random() * 2 - 1  // 随机垂直方向
        };
        
        // 标准化方向向量
        const length = Math.sqrt(balloon.directionX * balloon.directionX + balloon.directionY * balloon.directionY);
        balloon.directionX /= length;
        balloon.directionY /= length;
        
        this.balloons.push(balloon);
        this.totalBalloons++; // 增加气球总数统计
    }
    
    checkBalloonHit(x, y) {
        for (let i = this.balloons.length - 1; i >= 0; i--) {
            const balloon = this.balloons[i];
            
            if (balloon.popped) continue;
            
            // 计算距离
            const distance = Math.sqrt(
                Math.pow(x - balloon.x, 2) + Math.pow(y - balloon.y, 2)
            );
            
            if (distance <= balloon.radius) {
                this.popBalloon(i);
                return true;
            }
        }
        return false;
    }
    
    popBalloon(index, isAutoDisappear = false) {
        const balloon = this.balloons[index];
        balloon.popped = true;
        balloon.popStartTime = Date.now();
        balloon.isAutoDisappear = isAutoDisappear; // 标记是否为自动消失
        
        if (!isAutoDisappear) {
            // 手动爆破：更新分数
            this.hits++;
            this.combo++;
            
            // 基础分数
            let points = 10;
            
            // 连击奖励
            if (this.combo >= 3) {
                points += this.combo * 2;
                
                // 显示连击效果
                this.showComboEffect(balloon.x, balloon.y);
            }
            
            this.score += points;
            
            // 更新最大连击
            if (this.combo > this.maxCombo) {
                this.maxCombo = this.combo;
            }
            
            // 检查成就
            this.checkAchievements();
            
            // 播放爆破音效
            this.playPopSound(true);
    } else {
        // 自动消失：重置连击
        this.combo = 0;
        this.misses++;
        
        // 自动消失的气球不播放任何声音（根据用户要求）
        // this.playPopSound(false); // 注释掉这行代码
    }
        
        // 更新UI
        this.updateUI();
        
        // 1秒后移除气球
        setTimeout(() => {
            this.balloons.splice(index, 1);
        }, 1000);
    }
    
    showComboEffect(x, y) {
        const comboText = document.createElement('div');
        comboText.className = 'combo-effect';
        comboText.textContent = `${this.combo} 连击! +${this.combo * 2}`;
        comboText.style.left = `${x}px`;
        comboText.style.top = `${y}px`;
        
        this.canvas.parentElement.appendChild(comboText);
        
        // 动画结束后移除
        setTimeout(() => {
            comboText.remove();
        }, 1500);
    }
    
    loadSounds() {
        try {
            // 加载爆炸声音
            this.popSound = new Audio('explosion_sound.m4a');
            this.popSound.preload = 'auto';
            this.popSound.volume = 0.7;
            
            // 加载消失声音（使用同一个文件但调整音量）
            this.missSound = new Audio('explosion_sound.m4a');
            this.missSound.preload = 'auto';
            this.missSound.volume = 0.3;
            
            // 尝试预加载声音
            this.popSound.load();
            this.missSound.load();
        } catch (e) {
            console.error('声音加载失败:', e);
        }
    }
    
    playPopSound(isPop = true) {
        try {
            if (isPop && this.popSound) {
                // 播放爆炸声音，从0.3秒开始播放
                this.popSound.currentTime = 0.3;
                this.popSound.play().catch(e => console.log('播放爆炸声音失败:', e));
            } else if (!isPop && this.missSound) {
                // 播放消失声音，从0.3秒开始播放
                this.missSound.currentTime = 0.3;
                this.missSound.play().catch(e => console.log('播放消失声音失败:', e));
            }
        } catch (e) {
            // 静默失败，不影响游戏进行
            console.log('播放声音失败:', e);
        }
    }
    
    checkAchievements() {
        // 首次命中
        if (this.hits === 1) {
            document.getElementById('first-hit').classList.add('unlocked');
        }
        
        // 5连击
        if (this.combo === 5) {
            document.getElementById('combo-5').classList.add('unlocked');
        }
        
        // 完美游戏（准确率100%且命中超过10次）
        const accuracy = this.hits + this.misses > 0 ? 
            Math.round((this.hits / (this.hits + this.misses)) * 100) : 0;
        
        if (this.hits >= 10 && accuracy === 100) {
            document.getElementById('perfect-game').classList.add('unlocked');
        }
    }
    
    updateUI() {
        // 更新分数
        this.scoreElement.textContent = this.score;
        this.hitsElement.textContent = this.hits;
        
        // 计算准确率：触碰的气球个数 ÷ 出现的气球总数
        const accuracy = this.totalBalloons > 0 ? 
            Math.round((this.hits / this.totalBalloons) * 100) : 0;
        this.accuracyElement.textContent = `${accuracy}%`;
        
        // 更新游戏记录
        this.updateGameHistory();
    }
    
    updateGameHistory() {
        const historyElement = document.getElementById('game-history');
        
        if (this.gameHistory.length === 0) {
            historyElement.innerHTML = '<p>暂无游戏记录</p>';
            return;
        }
        
        let historyHTML = '';
        this.gameHistory.slice(-5).reverse().forEach((record, index) => {
            historyHTML += `
                <div class="history-item" style="margin-bottom: 10px; padding: 10px; background: #f0f0f0; border-radius: 5px;">
                    <strong>游戏 ${this.gameHistory.length - index}</strong><br>
                    得分: ${record.score} | 命中: ${record.hits} | 准确率: ${record.accuracy}%<br>
                    <small>${record.date}</small>
                </div>
            `;
        });
        
        historyElement.innerHTML = historyHTML;
    }
    
    saveGameHistory() {
        // 计算准确率：触碰的气球个数 ÷ 出现的气球总数
        const accuracy = this.totalBalloons > 0 ? 
            Math.round((this.hits / this.totalBalloons) * 100) : 0;
        
        const record = {
            score: this.score,
            hits: this.hits,
            misses: this.misses,
            accuracy: accuracy,
            maxCombo: this.maxCombo,
            date: new Date().toLocaleString('zh-CN')
        };
        
        this.gameHistory.push(record);
        this.updateGameHistory();
        
        // 注意：不再更新模态框中的统计信息，因为我们现在使用覆盖层
        // 覆盖层中的统计信息已经在showGameOver方法中更新
    }
    
    showHelp() {
        this.helpModal.style.display = 'flex';
    }
    
    showGameOver() {
        // 更新覆盖层中的统计信息
        const accuracy = this.totalBalloons > 0 ? 
            Math.round((this.hits / this.totalBalloons) * 100) : 0;
        
        document.getElementById('final-score-overlay').textContent = this.score;
        document.getElementById('final-hits-overlay').textContent = this.hits;
        document.getElementById('final-accuracy-overlay').textContent = `${accuracy}%`;
        
        // 显示覆盖层
        this.gameOverOverlay.style.display = 'flex';
    }
    
    hideGameOver() {
        this.gameOverOverlay.style.display = 'none';
    }
    
    toggleFullscreen() {
        const container = document.querySelector('.camera-container');
        if (!container) return;
        
        if (!document.fullscreenElement) {
            // 进入全屏
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) { /* Safari */
                container.webkitRequestFullscreen();
            } else if (container.msRequestFullscreen) { /* IE11 */
                container.msRequestFullscreen();
            }
            
            // 更新按钮文本
            if (this.fullscreenBtn) {
                this.fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i> 退出全屏';
            }
        } else {
            // 退出全屏
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) { /* Safari */
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) { /* IE11 */
                document.msExitFullscreen();
            }
            
            // 更新按钮文本
            if (this.fullscreenBtn) {
                this.fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i> 全屏';
            }
        }
    }
    
    updateFullscreenButton() {
        // 检查当前全屏状态并更新按钮文本
        if (this.fullscreenBtn) {
            if (document.fullscreenElement || 
                document.webkitFullscreenElement || 
                document.mozFullScreenElement || 
                document.msFullscreenElement) {
                // 在全屏状态
                this.fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i> 退出全屏';
            } else {
                // 不在全屏状态
                this.fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i> 全屏';
            }
        }
    }
    
    detectMotion() {
        if (this.video.readyState !== this.video.HAVE_ENOUGH_DATA) {
            return;
        }
        
        // 将当前视频帧绘制到运动检测画布上
        this.motionCtx.save();
        this.motionCtx.scale(-1, 1); // 镜像效果
        this.motionCtx.drawImage(
            this.video, 
            -this.motionCanvas.width, 
            0, 
            this.motionCanvas.width, 
            this.motionCanvas.height
        );
        this.motionCtx.restore();
        
        // 获取当前帧的图像数据
        const currentFrame = this.motionCtx.getImageData(
            0, 
            0, 
            this.motionCanvas.width, 
            this.motionCanvas.height
        );
        
        // 如果是第一帧，保存为前一帧并返回
        if (!this.prevFrame) {
            this.prevFrame = currentFrame;
            return;
        }
        
        // 计算当前帧和前一帧的差异
        let motionDetected = false;
        const motionPoints = [];
        
        for (let i = 0; i < currentFrame.data.length; i += 4) {
            // 获取RGB值
            const r1 = this.prevFrame.data[i];
            const g1 = this.prevFrame.data[i + 1];
            const b1 = this.prevFrame.data[i + 2];
            
            const r2 = currentFrame.data[i];
            const g2 = currentFrame.data[i + 1];
            const b2 = currentFrame.data[i + 2];
            
            // 计算颜色差异
            const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
            
            if (diff > this.motionThreshold) {
                motionDetected = true;
                
                // 计算像素位置
                const pixelIndex = i / 4;
                const x = pixelIndex % this.motionCanvas.width;
                const y = Math.floor(pixelIndex / this.motionCanvas.width);
                
                // 将低分辨率坐标映射回原始画布坐标
                const scaledX = (x / this.motionCanvas.width) * this.canvas.width;
                const scaledY = (y / this.motionCanvas.height) * this.canvas.height;
                
                motionPoints.push({ x: scaledX, y: scaledY });
            }
        }
        
        // 保存当前帧作为下一帧的前一帧
        this.prevFrame = currentFrame;
        
        // 如果检测到运动，检查是否触碰到气球
        if (motionDetected && motionPoints.length > 0) {
            // 改进的碰撞检测：基于像素变化判断触碰
            // 不再只检查中心点和随机点，而是检查所有运动点是否在气球区域内
            
            // 为每个气球创建一个命中计数器
            const balloonHitCounts = new Array(this.balloons.length).fill(0);
            
            // 检查每个运动点是否在气球区域内
            for (const point of motionPoints) {
                for (let i = 0; i < this.balloons.length; i++) {
                    const balloon = this.balloons[i];
                    
                    if (balloon.popped) continue;
                    
                    // 计算距离
                    const distance = Math.sqrt(
                        Math.pow(point.x - balloon.x, 2) + Math.pow(point.y - balloon.y, 2)
                    );
                    
                    if (distance <= balloon.radius) {
                        balloonHitCounts[i]++;
                    }
                }
            }
            
            // 如果某个气球被足够多的运动点命中，则爆破它
            for (let i = 0; i < balloonHitCounts.length; i++) {
                if (balloonHitCounts[i] > 8) { // 增加阈值，需要9个运动点命中才判定为触碰，减少误报
                    this.popBalloon(i);
                }
            }
        }
    }
    
    gameLoop() {
        // 清除画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制摄像头视频
        if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
            this.ctx.save();
            this.ctx.scale(-1, 1); // 镜像效果
            this.ctx.drawImage(this.video, -this.canvas.width, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
            
            // 运动检测
            if (this.gameActive && !this.gamePaused && this.motionDetectionActive) {
                const currentTime = Date.now();
                if (currentTime - this.lastMotionDetectionTime > this.motionDetectionInterval) {
                    this.detectMotion();
                    this.lastMotionDetectionTime = currentTime;
                }
            }
        }
        
        // 更新和绘制气球
        this.updateBalloons();
        this.drawBalloons();
        
        // 绘制实时得分显示
        this.drawRealTimeScore();
        
        // 继续游戏循环
        requestAnimationFrame(() => this.gameLoop());
    }
    
    drawRealTimeScore() {
        if (!this.gameActive) return;
        
        // 保存当前上下文状态
        this.ctx.save();
        
        // 设置实时得分显示样式
        this.ctx.font = 'bold 24px Arial, sans-serif';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.lineWidth = 3;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        
        // 绘制实时得分背景
        const padding = 15;
        const lineHeight = 30;
        const scoreText = `得分: ${this.score}`;
        const hitsText = `命中: ${this.hits}`;
        const comboText = `连击: ${this.combo}`;
        const timeText = `时间: ${this.timeLeft}s`;
        
        // 计算文本宽度
        this.ctx.font = 'bold 24px Arial, sans-serif';
        const scoreWidth = this.ctx.measureText(scoreText).width;
        const hitsWidth = this.ctx.measureText(hitsText).width;
        const comboWidth = this.ctx.measureText(comboText).width;
        const timeWidth = this.ctx.measureText(timeText).width;
        
        const maxWidth = Math.max(scoreWidth, hitsWidth, comboWidth, timeWidth) + padding * 2;
        const totalHeight = lineHeight * 4 + padding * 2;
        
        // 绘制背景矩形
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.roundRect(10, 10, maxWidth, totalHeight, 10);
        this.ctx.fill();
        this.ctx.stroke();
        
        // 绘制得分文本
        this.ctx.font = 'bold 24px Arial, sans-serif';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.textAlign = 'left';
        
        let y = 10 + padding;
        this.ctx.fillText(scoreText, 10 + padding, y);
        
        y += lineHeight;
        this.ctx.fillText(hitsText, 10 + padding, y);
        
        y += lineHeight;
        
        // 连击数使用特殊颜色
        if (this.combo >= 3) {
            this.ctx.fillStyle = '#FFD700'; // 金色
        } else {
            this.ctx.fillStyle = '#FFFFFF';
        }
        this.ctx.fillText(comboText, 10 + padding, y);
        
        y += lineHeight;
        this.ctx.fillStyle = this.timeLeft <= 10 ? '#FF6B6B' : '#FFFFFF'; // 时间少于10秒时变红
        this.ctx.fillText(timeText, 10 + padding, y);
        
        // 恢复上下文状态
        this.ctx.restore();
    }
    
    updateBalloons() {
        const currentTime = Date.now();
        
        for (let i = this.balloons.length - 1; i >= 0; i--) {
            const balloon = this.balloons[i];
            
            if (balloon.popped) {
                // 更新爆破动画
                const timeSincePop = currentTime - balloon.popStartTime;
                balloon.popAnimation = Math.min(timeSincePop / 1000, 1);
                
                // 如果动画完成且超过1秒，移除气球
                if (timeSincePop > 1000) {
                    this.balloons.splice(i, 1);
                    this.combo = 0; // 重置连击
                }
                continue;
            }
            
            // 检查气球是否超过生存时间（已移除生存时间限制，气球不会自动消失）
            // 只有当lifetime > 0时才检查生存时间
            if (balloon.lifetime > 0) {
                const timeSinceCreate = currentTime - balloon.createTime;
                if (timeSinceCreate > balloon.lifetime) {
                    // 标记为自动消失
                    this.popBalloon(i, true);
                    continue;
                }
            }
            
            // 更新气球位置（随机方向移动）
            balloon.x += balloon.directionX * balloon.speed;
            balloon.y += balloon.directionY * balloon.speed;
            
            // 添加浮动效果
            balloon.x += Math.sin(balloon.floatOffset) * 0.3;
            balloon.floatOffset += balloon.floatSpeed * 0.05;
            
            // 边界检查，让气球在屏幕内反弹
            if (balloon.x < balloon.radius || balloon.x > this.canvas.width - balloon.radius) {
                balloon.directionX *= -1;
                balloon.x = Math.max(balloon.radius, Math.min(this.canvas.width - balloon.radius, balloon.x));
            }
            
            if (balloon.y < balloon.radius || balloon.y > this.canvas.height - balloon.radius) {
                balloon.directionY *= -1;
                balloon.y = Math.max(balloon.radius, Math.min(this.canvas.height - balloon.radius, balloon.y));
            }
        }
    }
    
    drawBalloons() {
        this.balloons.forEach(balloon => {
            this.ctx.save();
            
            if (balloon.popped) {
                // 绘制爆破动画
                const scale = 1 + balloon.popAnimation * 0.5;
                const alpha = 1 - balloon.popAnimation;
                
                this.ctx.globalAlpha = alpha;
                this.ctx.translate(balloon.x, balloon.y);
                this.ctx.scale(scale, scale);
                
                if (balloon.isAutoDisappear) {
                    // 自动消失效果：淡出
                    this.ctx.fillStyle = balloon.color;
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, balloon.radius * (1 - balloon.popAnimation), 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    // 绘制消失的十字标记
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                    this.ctx.lineWidth = 3;
                    this.ctx.beginPath();
                    this.ctx.moveTo(-balloon.radius * 0.5, -balloon.radius * 0.5);
                    this.ctx.lineTo(balloon.radius * 0.5, balloon.radius * 0.5);
                    this.ctx.moveTo(balloon.radius * 0.5, -balloon.radius * 0.5);
                    this.ctx.lineTo(-balloon.radius * 0.5, balloon.radius * 0.5);
                    this.ctx.stroke();
                } else {
                    // 手动爆破效果：简化的爆炸效果，去掉小点碎片
                    this.ctx.fillStyle = balloon.color;
                    
                    // 绘制简单的爆炸环效果
                    const ringCount = 3; // 减少环的数量
                    for (let i = 0; i < ringCount; i++) {
                        const ringRadius = balloon.radius * (0.5 + i * 0.3) * (1 + balloon.popAnimation * 2);
                        const ringAlpha = 0.7 * (1 - balloon.popAnimation) * (1 - i * 0.3);
                        
                        this.ctx.globalAlpha = ringAlpha;
                        this.ctx.beginPath();
                        this.ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
                        this.ctx.strokeStyle = balloon.color;
                        this.ctx.lineWidth = 3;
                        this.ctx.stroke();
                    }
                    
                    // 绘制爆炸中心（简单的圆形）
                    this.ctx.globalAlpha = 1 - balloon.popAnimation * 0.5;
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, balloon.radius * 0.3 * (1 - balloon.popAnimation * 0.5), 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    // 添加简单的爆炸闪光效果
                    this.ctx.globalAlpha = 0.6 * (1 - balloon.popAnimation);
                    this.ctx.fillStyle = 'rgba(255, 255, 200, 0.4)';
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, balloon.radius * 1.5 * balloon.popAnimation, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    this.ctx.globalAlpha = 1;
                }
                
            } else {
                // 绘制气球形状（更圆的形状）
                this.ctx.translate(balloon.x, balloon.y);
                
                // 添加浮动动画
                const floatY = Math.sin(balloon.floatOffset) * 5;
                this.ctx.translate(0, floatY);
                
                // 创建径向渐变实现中间透明度最高、边缘透明度差的效果
                const balloonGradient = this.ctx.createRadialGradient(
                    0, 0, 0,           // 内圆圆心和半径（中心点）
                    0, 0, balloon.radius  // 外圆圆心和半径（气球边缘）
                );
                
                // 解析颜色为RGBA格式
                const color = balloon.color;
                let r, g, b;
                
                if (color.startsWith('#')) {
                    // 处理十六进制颜色
                    const hex = color.substring(1);
                    if (hex.length === 3) {
                        r = parseInt(hex[0] + hex[0], 16);
                        g = parseInt(hex[1] + hex[1], 16);
                        b = parseInt(hex[2] + hex[2], 16);
                    } else {
                        r = parseInt(hex.substring(0, 2), 16);
                        g = parseInt(hex.substring(2, 4), 16);
                        b = parseInt(hex.substring(4, 6), 16);
                    }
                } else if (color.startsWith('rgb')) {
                    // 处理rgb/rgba颜色
                    const match = color.match(/\d+/g);
                    if (match) {
                        r = parseInt(match[0]);
                        g = parseInt(match[1]);
                        b = parseInt(match[2]);
                    } else {
                        r = 255; g = 107; b = 107; // 默认颜色
                    }
                } else {
                    r = 255; g = 107; b = 107; // 默认颜色
                }
                
                // 添加渐变颜色停止点：中间透明度高（透明），边缘透明度低（不透明）
                // 调整透明度值，让中间更透明，边缘更不透明，效果更明显
                balloonGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.15)`);   // 中心：15%不透明（改得更不透明）
                balloonGradient.addColorStop(0.2, `rgba(${r}, ${g}, ${b}, 0.25)`);  // 靠近中心：25%不透明
                balloonGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.5)`);  // 中间：50%不透明
                balloonGradient.addColorStop(0.8, `rgba(${r}, ${g}, ${b}, 0.95)`); // 靠近边缘：95%不透明
                balloonGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 1)`);      // 边缘：100%不透明（最不透明）
                
                // 绘制气球主体（一个完整的球，不使用拼接画法）
                this.ctx.fillStyle = balloonGradient;
                this.ctx.beginPath();
                // 使用arc绘制一个完整的圆形气球
                this.ctx.arc(0, 0, balloon.radius, 0, Math.PI * 2);
                this.ctx.fill();
                
                // 绘制气球高光（更自然）
                const highlightGradient = this.ctx.createRadialGradient(
                    -balloon.radius * 0.3, -balloon.radius * 0.3, 0,
                    -balloon.radius * 0.3, -balloon.radius * 0.3, balloon.radius * 0.5
                );
                highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
                highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                this.ctx.fillStyle = highlightGradient;
                this.ctx.beginPath();
                this.ctx.ellipse(-balloon.radius * 0.15, -balloon.radius * 0.2, 
                                balloon.radius * 0.25, balloon.radius * 0.3, 0, 0, Math.PI * 2);
                this.ctx.fill();
                
                // 恢复透明度
                this.ctx.globalAlpha = 1;
                
                // 绘制气球绳（绳子起点放到气球形状的最下端）
                this.ctx.strokeStyle = '#666';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                // 绳子起点在气球最下端
                this.ctx.moveTo(0, balloon.radius * 1.05);
                
                // 绘制有曲线的绳子
                for (let i = 1; i <= 10; i++) {
                    const y = balloon.radius * 1.05 + i * 3;
                    const x = Math.sin(i * 0.5 + balloon.floatOffset) * 3;
                    this.ctx.lineTo(x, y);
                }
                this.ctx.stroke();
                
                // 绘制气球结（在绳子起点）
                this.ctx.fillStyle = '#666';
                this.ctx.beginPath();
                this.ctx.arc(0, balloon.radius * 1.05, 3, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            this.ctx.restore();
        });
    }
}

// 初始化游戏
window.addEventListener('DOMContentLoaded', () => {
    const game = new BalloonGame();
    
    // 将游戏实例暴露给全局，便于调试
    window.balloonGame = game;
    
    console.log('运动辅助游戏已加载！');
    console.log('游戏说明：');
    console.log('1. 点击"开始游戏"按钮启动游戏');
    console.log('2. 允许浏览器访问您的摄像头');
    console.log('3. 在摄像头前移动身体触碰气球');
    console.log('4. 或者直接点击/触摸气球进行游戏');
    
    // 初始化分享功能
    initShareFunctionality(game);
});

// 分享功能实现
function initShareFunctionality(game) {
    const shareButtons = document.querySelectorAll('.share-btn');
    const shareModal = document.getElementById('share-modal');
    const closeShareModal = document.getElementById('close-share-modal');
    const shareUrlInput = document.getElementById('share-url');
    const copyUrlBtn = document.getElementById('copy-url-btn');
    const shareWhatsappBtn = document.getElementById('share-whatsapp');
    const shareFacebookBtn = document.getElementById('share-facebook');
    const shareTwitterBtn = document.getElementById('share-twitter');
    const shareWeiboBtn = document.getElementById('share-weibo');
    const shareQRCode = document.getElementById('share-qrcode');
    
    // 检查QRCode库是否可用
    const isQRCodeAvailable = typeof QRCode !== 'undefined';
    
    // 生成分享URL
    function generateShareUrl() {
        const baseUrl = window.location.href.split('?')[0];
        const params = new URLSearchParams();
        
        // 如果有游戏记录，可以包含一些数据
        if (game.gameHistory.length > 0) {
            const latestRecord = game.gameHistory[game.gameHistory.length - 1];
            params.set('score', latestRecord.score);
            params.set('hits', latestRecord.hits);
            params.set('accuracy', latestRecord.accuracy);
        }
        
        params.set('game', 'balloon-motion-game');
        params.set('version', '1.0');
        
        return `${baseUrl}?${params.toString()}`;
    }
    
    // 更新分享URL和二维码
    function updateShareContent() {
        const shareUrl = generateShareUrl();
        shareUrlInput.value = shareUrl;
        
        // 生成二维码（如果QRCode库可用）
        if (shareQRCode && isQRCodeAvailable) {
            try {
                shareQRCode.innerHTML = '';
                new QRCode(shareQRCode, {
                    text: shareUrl,
                    width: 150,
                    height: 150,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            } catch (error) {
                console.error('生成二维码失败:', error);
                shareQRCode.innerHTML = '<p style="color: #666; padding: 20px;">二维码生成失败，请检查网络连接</p>';
            }
        } else if (shareQRCode) {
            // QRCode库不可用，显示提示信息
            shareQRCode.innerHTML = '<p style="color: #666; padding: 20px;">二维码功能需要网络连接，请直接复制链接分享</p>';
        }
        
        return shareUrl;
    }
    
    // 打开分享模态框
    shareButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            try {
                const shareUrl = updateShareContent();
                if (shareModal) {
                    shareModal.style.display = 'flex';
                    
                    // 更新社交媒体分享链接
                    const shareText = encodeURIComponent('快来玩这个超有趣的运动辅助游戏！我在气球爆破游戏中获得了高分！');
                    const encodedUrl = encodeURIComponent(shareUrl);
                    
                    if (shareWhatsappBtn) {
                        shareWhatsappBtn.href = `https://wa.me/?text=${shareText}%20${encodedUrl}`;
                    }
                    
                    if (shareFacebookBtn) {
                        shareFacebookBtn.href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${shareText}`;
                    }
                    
                    if (shareTwitterBtn) {
                        shareTwitterBtn.href = `https://twitter.com/intent/tweet?text=${shareText}&url=${encodedUrl}`;
                    }
                    
                    if (shareWeiboBtn) {
                        shareWeiboBtn.href = `http://service.weibo.com/share/share.php?url=${encodedUrl}&title=${shareText}`;
                    }
                } else {
                    console.error('分享模态框元素未找到');
                    alert('分享功能暂时不可用，请刷新页面重试');
                }
            } catch (error) {
                console.error('打开分享模态框失败:', error);
                alert('分享功能出现错误，请刷新页面重试');
            }
        });
    });
    
    // 关闭分享模态框
    if (closeShareModal) {
        closeShareModal.addEventListener('click', () => {
            shareModal.style.display = 'none';
        });
    }
    
    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === shareModal) {
            shareModal.style.display = 'none';
        }
    });
    
    // 复制URL到剪贴板
    if (copyUrlBtn) {
        copyUrlBtn.addEventListener('click', () => {
            try {
                shareUrlInput.select();
                shareUrlInput.setSelectionRange(0, 99999); // 移动设备支持
                
                // 首先尝试使用现代Clipboard API
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(shareUrlInput.value)
                        .then(() => {
                            showCopySuccess(copyUrlBtn);
                        })
                        .catch(err => {
                            console.error('Clipboard API 失败:', err);
                            // 回退到传统方法
                            fallbackCopyText();
                        });
                } else {
                    // 使用传统方法
                    fallbackCopyText();
                }
                
                function fallbackCopyText() {
                    try {
                        const successful = document.execCommand('copy');
                        if (successful) {
                            showCopySuccess(copyUrlBtn);
                        } else {
                            console.error('复制命令失败');
                            alert('复制失败，请手动选择并复制链接');
                        }
                    } catch (err) {
                        console.error('复制失败:', err);
                        alert('复制失败，请手动选择并复制链接');
                    }
                }
                
                function showCopySuccess(button) {
                    const originalText = button.innerHTML;
                    button.innerHTML = '<i class="fas fa-check"></i> 已复制';
                    button.classList.add('btn-success');
                    
                    setTimeout(() => {
                        button.innerHTML = originalText;
                        button.classList.remove('btn-success');
                    }, 2000);
                }
            } catch (error) {
                console.error('复制URL失败:', error);
                alert('复制失败，请手动选择并复制链接');
            }
        });
    }
    
    // 社交媒体分享按钮点击处理
    const socialButtons = [shareWhatsappBtn, shareFacebookBtn, shareTwitterBtn, shareWeiboBtn];
    socialButtons.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', (e) => {
                // 在新窗口打开分享链接
                e.preventDefault();
                window.open(btn.href, '_blank', 'width=600,height=400');
            });
        }
    });
    
    // 移动设备分享API支持
    if (navigator.share) {
        // 创建原生分享按钮
        const nativeShareBtn = document.createElement('button');
        nativeShareBtn.className = 'btn btn-primary share-native-btn';
        nativeShareBtn.innerHTML = '<i class="fas fa-share-alt"></i> 原生分享';
        nativeShareBtn.style.marginTop = '10px';
        
        // 添加到分享模态框
        const shareActions = document.querySelector('.share-actions');
        if (shareActions) {
            shareActions.appendChild(nativeShareBtn);
            
            nativeShareBtn.addEventListener('click', async () => {
                try {
                    const shareUrl = generateShareUrl();
                    await navigator.share({
                        title: '运动辅助游戏 - 气球爆破',
                        text: '快来玩这个超有趣的运动辅助游戏！我在气球爆破游戏中获得了高分！',
                        url: shareUrl
                    });
                } catch (err) {
                    console.log('分享取消或失败:', err);
                }
            });
        }
    }
    
    // 添加调试信息
    console.log('分享功能初始化完成');
    console.log('QRCode库可用:', isQRCodeAvailable);
    console.log('分享按钮数量:', shareButtons.length);
    console.log('分享模态框:', shareModal ? '找到' : '未找到');
    
    // 游戏结束时的自动分享建议
    const originalShowGameOver = game.showGameOver.bind(game);
    game.showGameOver = function() {
        originalShowGameOver();
        
        // 延迟显示分享建议
        setTimeout(() => {
            const shareSuggestion = document.createElement('div');
            shareSuggestion.className = 'share-suggestion';
            shareSuggestion.innerHTML = `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #007bff;">
                    <h5 style="margin-top: 0; color: #007bff;"><i class="fas fa-share-alt"></i> 分享你的成绩！</h5>
                    <p style="margin-bottom: 10px;">你获得了 ${game.score} 分！与朋友分享这个有趣的游戏吧！</p>
                    <button class="btn btn-sm btn-primary share-btn">
                        <i class="fas fa-share"></i> 立即分享
                    </button>
                </div>
            `;
            
            const gameOverContent = document.querySelector('.game-over-content');
            if (gameOverContent) {
                gameOverContent.appendChild(shareSuggestion);
                
                // 重新绑定分享按钮事件
                const newShareBtn = shareSuggestion.querySelector('.share-btn');
                if (newShareBtn) {
                    newShareBtn.addEventListener('click', () => {
                        const shareUrl = updateShareContent();
                        shareModal.style.display = 'flex';
                    });
                }
            }
        }, 500);
    };
    
    console.log('分享功能已初始化');
}
