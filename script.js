document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('starskyContainer');
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // 统一星星配置
    const starConfig = {
        levels: [
            { name: '微星', scale: 0.3, count: 60, minDistance: 25, hueRotate: 0,   saturate: 0.5, specialClass: null },
            { name: '小星', scale: 0.6, count: 50, minDistance: 35, hueRotate: 200, saturate: 1.2, specialClass: null },
            { name: '中星', scale: 1.0, count: 30, minDistance: 50, hueRotate: 30,  saturate: 1.3, specialClass: null },
            { name: '亮星', scale: 1.5, count: 8,  minDistance: 55, hueRotate: 50,  saturate: 1.5, specialClass: 'star-bright' },
            { name: '超星', scale: 2.0, count: 2,  minDistance: 70, hueRotate: 45,  saturate: 2,   specialClass: 'star-super' }
        ],
        baseSize: 30,
        margin: 40,
        maxAttempts: 2000,
        relaxedDistance: 30
    };

    // 存储已生成星星的位置信息
    const stars = [];

    // 定义星群集中心点
    const clusterCenters = Array.from({ length: 6 }, () => ({
        x: Math.random() * screenW,
        y: Math.random() * screenH
    }));

    // 统一的距离检查函数
    function isTooClose(x, y, scale, minDistance = 40) {
        const starSize = starConfig.baseSize * scale;
        const effectiveDistance = minDistance + starSize * 0.5;

        return stars.some(star => {
            const distance = Math.sqrt(Math.pow(x - star.x, 2) + Math.pow(y - star.y, 2));
            return distance < effectiveDistance;
        });
    }

    // 创建星群位置生成函数
    function generateConstellationPosition(clusterCenters) {
        // 随机选择一个集群中心
        const center = clusterCenters[Math.floor(Math.random() * clusterCenters.length)];

        // 定义集群半径
        const clusterRadius = Math.min(screenW, screenH) / 5;

        // 生成偏向中心的随机半径（使用平方创建更密集的核心）
        const radius = Math.pow(Math.random(), 2) * clusterRadius;

        // 生成随机角度
        const angle = Math.random() * 2 * Math.PI;

        // 计算相对于中心的坐标
        let x = center.x + radius * Math.cos(angle);
        let y = center.y + radius * Math.sin(angle);

        // 确保坐标在屏幕边界内（考虑边距）
        x = Math.max(starConfig.margin, Math.min(screenW - starConfig.margin, x));
        y = Math.max(starConfig.margin, Math.min(screenH - starConfig.margin, y));

        return { x, y };
    }

    // 创建星星元素的统一函数
    function createStar(x, y, level) {
        const star = document.createElement('span');
        star.className = 'star';
        star.dataset.level = level.name;
        star.dataset.size = Math.round(starConfig.baseSize * level.scale);

        // 基础样式
        Object.assign(star.style, {
            left: x + 'px',
            top: y + 'px',
            transform: `scale(${level.scale})`,
            animationDelay: Math.random() * 2 + 's',
            opacity: 0.8 + level.scale * 0.1
        });

        // 特殊效果样式
        if (level.specialClass) star.classList.add(level.specialClass);

        // CSS变量设置
        star.style.setProperty('--center-hue-rotate', `${level.hueRotate}deg`);
        star.style.setProperty('--center-saturate', level.saturate);
        star.style.setProperty('--center-glow-intensity', level.scale);
        star.style.setProperty('--center-glow-size', `${Math.max(16, level.scale * 20)}px`);

        return star;
    }

    // 生成指定数量的星星
    function generateStars(count, level, clusterCenters, useRelaxedDistance = false) {
        const generated = [];
        const minDistance = useRelaxedDistance ? starConfig.relaxedDistance : level.minDistance;
        const maxAttempts = useRelaxedDistance ? 500 : 2000;

        for (let i = 0; i < maxAttempts && generated.length < count; i++) {
            const { x, y } = generateConstellationPosition(clusterCenters);

            if (!isTooClose(x, y, level.scale, minDistance)) {
                const star = createStar(x, y, level);
                container.appendChild(star);
                stars.push({ x, y, scale: level.scale, level: level.name });
                generated.push(star);
            }
        }

        return generated;
    }

    // 主生成流程
    let totalAttempts = 0;
    const results = {};

    // 第一遍生成所有等级的星星
    starConfig.levels.forEach(level => {
        console.log(`生成 ${level.name}，需要 ${level.count} 个`);
        const generated = generateStars(level.count, level, clusterCenters);
        results[level.name] = generated.length;
        totalAttempts += level.count * 2; // 估算尝试次数
    });

    console.log(`第一遍生成完成，总共 ${stars.length} 个星星`);

    // 检查缺失的重要星星并重新生成
    const missingLevels = starConfig.levels.filter(level =>
        results[level.name] < level.count &&
        (level.name === '亮星' || level.name === '超星')
    );

    if (missingLevels.length > 0) {
        console.log('重新生成缺失的重要星星...');
        missingLevels.forEach(level => {
            const missingCount = level.count - results[level.name];
            const regenerated = generateStars(missingCount, level, clusterCenters, true);
            console.log(`重新生成了 ${regenerated.length} 个${level.name}`);
        });
    }

    // 更新统计信息
    function updateStats() {
        const levelCounts = stars.reduce((acc, star) => {
            acc[star.level] = (acc[star.level] || 0) + 1;
            return acc;
        }, {});

        // 更新调试面板
        document.getElementById('totalStars').textContent = stars.length;
        document.getElementById('superStars').textContent = levelCounts['超星'] || 0;
        document.getElementById('brightStars').textContent = levelCounts['亮星'] || 0;
        document.getElementById('attempts').textContent = totalAttempts;

        // 显示调试信息
        document.getElementById('debugInfo').style.display = 'block';

        // 控制台统计信息
        console.log(`生成完成！总共 ${stars.length} 个星星`);
        console.table(starConfig.levels.map(level => ({
            等级: level.name,
            实际数量: levelCounts[level.name] || 0,
            预期数量: level.count,
            缩放: level.scale + 'x',
            最小间距: level.minDistance + 'px'
        })));
    }

    updateStats();

    // 说明面板隐藏/显示功能
    const infoPanel = document.getElementById('starskyInfo');
    const infoToggle = document.getElementById('infoToggle');
    const showInfoBtn = document.getElementById('showInfoBtn');

    // 隐藏面板函数
    function hideInfoPanel() {
        infoPanel.classList.add('hidden');
        showInfoBtn.classList.add('show');
        // 保存状态到localStorage
        localStorage.setItem('infoPanelHidden', 'true');
    }

    // 显示面板函数
    function showInfoPanel() {
        infoPanel.classList.remove('hidden');
        showInfoBtn.classList.remove('show');
        // 保存状态到localStorage
        localStorage.setItem('infoPanelHidden', 'false');
    }

    // 绑定隐藏按钮事件
    infoToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        hideInfoPanel();
    });

    // 绑定显示按钮事件
    showInfoBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        showInfoPanel();
    });

    // 页面加载时检查之前的状态
    const isPanelHidden = localStorage.getItem('infoPanelHidden') === 'true';
    if (isPanelHidden) {
        hideInfoPanel();
    }

    // 点击星星显示信息
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('star')) {
            const level = e.target.dataset.level;
            const size = e.target.dataset.size;
            const rect = e.target.getBoundingClientRect();

            // 创建提示框
            const tooltip = document.createElement('div');
            tooltip.style.position = 'fixed';
            tooltip.style.left = rect.left + 'px';
            tooltip.style.top = (rect.top - 50) + 'px';
            tooltip.style.background = 'rgba(0,0,0,0.8)';
            tooltip.style.color = 'white';
            tooltip.style.padding = '8px 12px';
            tooltip.style.borderRadius = '8px';
            tooltip.style.fontSize = '14px';
            tooltip.style.zIndex = '1000';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.border = '1px solid rgba(255,255,255,0.3)';
            tooltip.style.animation = 'fadeIn 0.3s ease';

            tooltip.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 4px;">${level}</div>
                <div style="font-size: 12px; opacity: 0.8;">大小: ${size}px</div>
            `;

            document.body.appendChild(tooltip);

            // 2秒后自动消失
            setTimeout(() => {
                if (tooltip.parentNode) {
                    tooltip.style.animation = 'fadeOut 0.3s ease';
                    setTimeout(() => {
                        if (tooltip.parentNode) {
                            tooltip.parentNode.removeChild(tooltip);
                        }
                    }, 300);
                }
            }, 2000);

            // 添加点击反馈效果
            e.target.style.animation = 'none';
            e.target.style.transform = `scale(${e.target.style.transform.match(/scale\(([\d.]+)/)[1] * 1.2})`;
            setTimeout(() => {
                e.target.style.transform = e.target.style.transform.replace(/scale\(([\d.]+)/, `scale(${parseFloat(e.target.style.transform.match(/scale\(([\d.]+)/)[1]) / 1.2})`);
            }, 300);
        }
    });
});

// 筛选功能相关变量
let filterPanelVisible = false;
let selectedFilters = new Set(['微星', '小星', '中星', '亮星', '超星']);

// 获取筛选相关DOM元素
const filterToggle = document.getElementById('filterToggle');
const filterPanel = document.getElementById('filterPanel');
const filterOptions = document.getElementById('filterOptions');
const selectAllBtn = document.getElementById('selectAllBtn');
const selectNoneBtn = document.getElementById('selectNoneBtn');
const applyFilterBtn = document.getElementById('applyFilterBtn');

    // 生成筛选选项
    function generateFilterOptions() {
        const emojis = { '微星': '✨', '小星': '⭐', '中星': '🌟', '亮星': '💫', '超星': '🌟' };

        filterOptions.innerHTML = '';

        starConfig.levels.forEach(level => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'filter-option';
            if (selectedFilters.has(level.name)) {
                optionDiv.classList.add('selected');
            }

            optionDiv.innerHTML = `
                <div class="filter-checkbox ${selectedFilters.has(level.name) ? 'checked' : ''}"></div>
                <div class="filter-option-info">
                    <div class="filter-option-name">${emojis[level.name]} ${level.name}</div>
                    <div class="filter-option-detail">${level.count}个 | ${level.scale}x</div>
                </div>
            `;

            optionDiv.addEventListener('click', () => {
                toggleFilterOption(level.name, optionDiv);
            });

            filterOptions.appendChild(optionDiv);
        });
    }

// 切换筛选选项
function toggleFilterOption(levelName, optionDiv) {
    if (selectedFilters.has(levelName)) {
        selectedFilters.delete(levelName);
        optionDiv.classList.remove('selected');
        optionDiv.querySelector('.filter-checkbox').classList.remove('checked');
    } else {
        selectedFilters.add(levelName);
        optionDiv.classList.add('selected');
        optionDiv.querySelector('.filter-checkbox').classList.add('checked');
    }
}

// 应用筛选
function applyFilter() {
    const stars = document.querySelectorAll('.star');
    stars.forEach(star => {
        const level = star.dataset.level;
        if (selectedFilters.has(level)) {
            star.style.display = 'block';
        } else {
            star.style.display = 'none';
        }
    });

    // 隐藏筛选面板
    filterPanel.classList.remove('show');
    filterPanelVisible = false;

    // 更新筛选按钮状态
    updateFilterToggleState();
}

    // 更新筛选按钮状态
    function updateFilterToggleState() {
        const allSelected = starConfig.levels.every(level => selectedFilters.has(level.name));
        const noneSelected = selectedFilters.size === 0;

        if (allSelected) {
            filterToggle.textContent = '🔍';
            filterToggle.title = '星星筛选';
        } else if (noneSelected) {
            filterToggle.textContent = '🚫';
            filterToggle.title = '无星星显示';
        } else {
            filterToggle.textContent = '⚡';
            filterToggle.title = `已选择${selectedFilters.size}个等级`;
        }
    }

// 筛选面板显示/隐藏
filterToggle.addEventListener('click', () => {
    if (filterPanelVisible) {
        filterPanel.classList.remove('show');
        filterPanelVisible = false;
    } else {
        generateFilterOptions();
        filterPanel.classList.add('show');
        filterPanelVisible = true;
    }
});

    // 全选按钮
    selectAllBtn.addEventListener('click', () => {
        selectedFilters = new Set(starConfig.levels.map(level => level.name));
        generateFilterOptions();
    });

// 全不选按钮
selectNoneBtn.addEventListener('click', () => {
    selectedFilters.clear();
    generateFilterOptions();
});

// 应用筛选按钮
applyFilterBtn.addEventListener('click', applyFilter);

// 点击筛选面板外部关闭
document.addEventListener('click', (e) => {
    if (filterPanelVisible && !filterPanel.contains(e.target) && e.target !== filterToggle) {
        filterPanel.classList.remove('show');
        filterPanelVisible = false;
    }
});

// 初始化筛选状态
updateFilterToggleState();

// ==============================================
// 流星特效系统
// ==============================================

// 流星配置
const meteorConfig = {
    minInterval: 3000,        // 最小间隔时间 (ms)
    maxInterval: 8000,        // 最大间隔时间 (ms)
    minSpeed: 8,              // 最小速度 (s)
    maxSpeed: 15,             // 最大速度 (s)
    maxConcurrent: 3,         // 最大同时存在的流星数
    sizes: ['small', 'medium', 'large'], // 流星大小选项
    directions: ['direction-1', 'direction-2', 'direction-3', 'direction-4'] // 流星方向选项
};

// 流星管理器
class MeteorManager {
    constructor(container) {
        this.container = container;
        this.activeMeteors = [];
        this.isRunning = false;
        this.nextMeteorTimeout = null;
    }

    // 启动流星系统
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('🌟 流星特效已启动');
        this.scheduleNextMeteor();
    }

    // 停止流星系统
    stop() {
        this.isRunning = false;
        if (this.nextMeteorTimeout) {
            clearTimeout(this.nextMeteorTimeout);
            this.nextMeteorTimeout = null;
        }
        // 清除所有活跃的流星
        this.activeMeteors.forEach(meteor => {
            if (meteor.parentNode) {
                meteor.parentNode.removeChild(meteor);
            }
        });
        this.activeMeteors = [];
        console.log('🌟 流星特效已停止');
    }

    // 安排下一个流星
    scheduleNextMeteor() {
        if (!this.isRunning) return;

        const interval = Math.random() * (meteorConfig.maxInterval - meteorConfig.minInterval) + meteorConfig.minInterval;
        this.nextMeteorTimeout = setTimeout(() => {
            this.createMeteor();
        }, interval);
    }

    // 创建流星
    createMeteor() {
        if (!this.isRunning) return;

        console.log('🌠 尝试创建流星...');

        // 检查是否超过最大同时存在的流星数
        if (this.activeMeteors.length >= meteorConfig.maxConcurrent) {
            console.log(`⏸️  达到最大流星数 (${meteorConfig.maxConcurrent})，跳过创建`);
            this.scheduleNextMeteor();
            return;
        }

        const meteor = this.generateMeteorElement();
        console.log('✨ 创建流星元素:', {
            size: meteor.className,
            left: meteor.style.left,
            top: meteor.style.top,
            duration: meteor.style.animationDuration
        });

        this.container.appendChild(meteor);
        this.activeMeteors.push(meteor);
        console.log(`🎯 当前活跃流星数: ${this.activeMeteors.length}`);

        // 流星动画完成后清理
        const duration = parseFloat(meteor.style.animationDuration) * 1000;
        setTimeout(() => {
            this.removeMeteor(meteor);
        }, duration);
    }

    // 生成流星元素
    generateMeteorElement() {
        const meteor = document.createElement('div');
        meteor.className = 'meteor';

        // 随机大小
        const size = meteorConfig.sizes[Math.floor(Math.random() * meteorConfig.sizes.length)];
        meteor.classList.add(size);

        // 随机方向
        const direction = meteorConfig.directions[Math.floor(Math.random() * meteorConfig.directions.length)];
        meteor.classList.add(direction);

        // 随机起始位置 (顶部区域)
        const startX = Math.random() * 100; // 0-100vw
        const startY = -10; // 从屏幕上方一点开始

        // 随机速度
        const speed = Math.random() * (meteorConfig.maxSpeed - meteorConfig.minSpeed) + meteorConfig.minSpeed;

        // 随机延时开始
        const delay = Math.random() * 2;

        // 应用样式
        Object.assign(meteor.style, {
            left: startX + 'vw',
            top: startY + 'vh',
            animationDuration: speed + 's',
            animationDelay: delay + 's'
        });

        // 随机添加闪烁效果
        if (Math.random() > 0.7) {
            meteor.classList.add('twinkle');
        }

        return meteor;
    }

    // 移除流星
    removeMeteor(meteor) {
        const index = this.activeMeteors.indexOf(meteor);
        if (index > -1) {
            this.activeMeteors.splice(index, 1);
        }
        if (meteor.parentNode) {
            meteor.parentNode.removeChild(meteor);
        }
        // 安排下一个流星
        this.scheduleNextMeteor();
    }

    // 获取统计信息
    getStats() {
        return {
            activeCount: this.activeMeteors.length,
            isRunning: this.isRunning
        };
    }
}

// 全局流星管理器实例
let meteorManager;

// 初始化流星系统
function initMeteorSystem() {
    console.log('🚀 开始初始化流星系统...');

    const meteorsContainer = document.getElementById('meteorsContainer');
    if (!meteorsContainer) {
        console.error('❌ 流星容器未找到!');
        console.log('📋 当前页面元素:', document.body.innerHTML.substring(0, 500) + '...');
        return;
    }

    console.log('✅ 找到流星容器:', meteorsContainer);
    meteorManager = new MeteorManager(meteorsContainer);
    meteorManager.start();
    console.log('🎉 流星系统初始化完成!');
}



// 页面可见性变化时控制流星系统
document.addEventListener('visibilitychange', function() {
    if (meteorManager) {
        if (document.hidden) {
            meteorManager.stop();
        } else {
            meteorManager.start();
        }
    }
});

// 添加键盘控制 (按 'M' 键切换流星开关)
document.addEventListener('keydown', function(e) {
    if (e.key.toLowerCase() === 'm' && meteorManager) {
        if (meteorManager.isRunning) {
            meteorManager.stop();
        } else {
            meteorManager.start();
        }
    }
});

// 更新调试面板显示流星信息
function updateMeteorStats() {
    if (meteorManager) {
        const stats = meteorManager.getStats();
        const debugInfo = document.getElementById('debugInfo');

        // 添加流星统计信息
        let meteorStatsDiv = debugInfo.querySelector('.meteor-stats');
        if (!meteorStatsDiv) {
            meteorStatsDiv = document.createElement('div');
            meteorStatsDiv.className = 'meteor-stats';
            debugInfo.appendChild(meteorStatsDiv);
        }

        meteorStatsDiv.innerHTML = `
            <div>活跃流星: <span id="activeMeteors">${stats.activeCount}</span></div>
            <div>流星状态: <span id="meteorStatus">${stats.isRunning ? '运行中' : '已停止'}</span></div>
        `;
    }
}

// 每秒更新流星统计信息
setInterval(updateMeteorStats, 1000);

// 初始化流星系统
setTimeout(initMeteorSystem, 1000);
