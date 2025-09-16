document.addEventListener('DOMContentLoaded', async function() {
    const container = document.getElementById('starskyContainer');
    const meteorContainer = document.getElementById('meteorContainer');
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // 加载RSS订阅数据
    let rssSubscriptions = [];
    let starConfig = {};
    
    try {
        const response = await fetch('./rss_subscriptions.json');
        const rssData = await response.json();
        rssSubscriptions = rssData.subscriptions;
        
        // 基于RSS数据构建星星配置
        starConfig = {
            levels: [
                { name: '微星', scale: 0.2,  count: rssData.metadata.level_distribution['微星'], minDistance: 20, hueRotate: 0,   saturate: 0.5, specialClass: null },
                { name: '小星', scale: 0.35, count: rssData.metadata.level_distribution['小星'], minDistance: 25, hueRotate: 200, saturate: 1.2, specialClass: null },
                { name: '中星', scale: 0.5,  count: rssData.metadata.level_distribution['中星'], minDistance: 35, hueRotate: 30,  saturate: 1.3, specialClass: null },
                { name: '亮星', scale: 0.7,  count: rssData.metadata.level_distribution['亮星'], minDistance: 40, hueRotate: 50,  saturate: 1.5, specialClass: 'star-bright' },
                { name: '超星', scale: 1.0,  count: rssData.metadata.level_distribution['超星'], minDistance: 45, hueRotate: 45,  saturate: 2,   specialClass: 'star-super' }
            ],
            baseSize: 18,
            margin: 40,
            maxAttempts: 2000,
            relaxedDistance: 20
        };
        
        console.log('✅ RSS订阅数据加载成功:', rssData.metadata);
        console.log('📊 星星分布:', rssData.metadata.level_distribution);
        
    } catch (error) {
        console.error('❌ 加载RSS订阅数据失败:', error);
        // 回退到默认配置
        starConfig = {
            levels: [
                { name: '微星', scale: 0.2,  count: 10, minDistance: 20, hueRotate: 0,   saturate: 0.5, specialClass: null },
                { name: '小星', scale: 0.35, count: 7,  minDistance: 25, hueRotate: 200, saturate: 1.2, specialClass: null },
                { name: '中星', scale: 0.5,  count: 6,  minDistance: 35, hueRotate: 30,  saturate: 1.3, specialClass: null },
                { name: '亮星', scale: 0.7,  count: 6,  minDistance: 40, hueRotate: 50,  saturate: 1.5, specialClass: 'star-bright' },
                { name: '超星', scale: 1.0,  count: 4,  minDistance: 45, hueRotate: 45,  saturate: 2,   specialClass: 'star-super' }
            ],
            baseSize: 18,
            margin: 40,
            maxAttempts: 2000,
            relaxedDistance: 20
        };
        rssSubscriptions = []; // 空数组，回退到随机头像
    }

    // 存储已生成星星的位置信息
    const stars = [];

    // ==============================================
    // 柏林噪声算法实现 - 自然分布生成器
    // ==============================================
    
    // 简化版柏林噪声类
    class SimplexNoise {
        constructor(seed = Math.random()) {
            this.seed = seed;
            this.p = this.buildPermutationTable();
        }
        
        // 构建置换表
        buildPermutationTable() {
            const p = [];
            for (let i = 0; i < 256; i++) {
                p[i] = i;
            }
            
            // 使用种子进行随机打乱
            let random = this.seedRandom(this.seed);
            for (let i = 255; i > 0; i--) {
                const j = Math.floor(random() * (i + 1));
                [p[i], p[j]] = [p[j], p[i]];
            }
            
            // 复制数组以避免边界检查
            for (let i = 0; i < 256; i++) {
                p[256 + i] = p[i];
            }
            
            return p;
        }
        
        // 种子随机数生成器
        seedRandom(seed) {
            return function() {
                const x = Math.sin(seed++) * 10000;
                return x - Math.floor(x);
            };
        }
        
        // 线性插值
        lerp(a, b, t) {
            return a + t * (b - a);
        }
        
        // 渐变函数
        fade(t) {
            return t * t * t * (t * (t * 6 - 15) + 10);
        }
        
        // 梯度函数
        grad(hash, x, y) {
            const h = hash & 15;
            const u = h < 8 ? x : y;
            const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
            return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
        }
        
        // 2D柏林噪声
        noise(x, y) {
            const X = Math.floor(x) & 255;
            const Y = Math.floor(y) & 255;
            
            x -= Math.floor(x);
            y -= Math.floor(y);
            
            const u = this.fade(x);
            const v = this.fade(y);
            
            const a = this.p[X] + Y;
            const aa = this.p[a];
            const ab = this.p[a + 1];
            const b = this.p[X + 1] + Y;
            const ba = this.p[b];
            const bb = this.p[b + 1];
            
            return this.lerp(
                this.lerp(this.grad(this.p[aa], x, y), this.grad(this.p[ba], x - 1, y), u),
                this.lerp(this.grad(this.p[ab], x, y - 1), this.grad(this.p[bb], x - 1, y - 1), u),
                v
            );
        }
        
        // 分形噪声 - 多个八度的叠加
        fractalNoise(x, y, octaves = 4, persistence = 0.5, scale = 0.01) {
            let value = 0;
            let amplitude = 1;
            let frequency = scale;
            let maxValue = 0;
            
            for (let i = 0; i < octaves; i++) {
                value += this.noise(x * frequency, y * frequency) * amplitude;
                maxValue += amplitude;
                amplitude *= persistence;
                frequency *= 2;
            }
            
            return value / maxValue;
        }
    }

    // 创建噪声生成器实例
    const noiseGenerator = new SimplexNoise(Date.now() * Math.random());
    
    // 分布配置
    const distributionConfig = {
        // 噪声参数
        scale: 0.0025,          // 噪声缩放（值越小，变化越缓慢，形成更大的区域）
        octaves: 5,             // 噪声层数（增加细节层次）
        persistence: 0.55,      // 持续度（控制各层强度衰减）
        
        // 密度控制
        densityThreshold: -0.1, // 密度阈值（低于此值的区域稀疏）
        maxDensity: 2.2,        // 最大密度倍数（密集区域更密）
        minDensity: 0.05,       // 最小密度倍数（稀疏区域更稀）
        
        // 区域特性
        clusterStrength: 0.9,   // 聚集强度（更强的聚集效果）
        sparseness: 0.2,        // 稀疏度（稀疏区域更稀疏）
        
        // 渐变过渡
        transitionSmoothness: 1.5, // 过渡平滑度
    };

    // 基于柏林噪声生成位置
    function generateNoiseBasedPosition() {
        let attempts = 0;
        const maxAttempts = 100;
        
        while (attempts < maxAttempts) {
            // 生成候选位置
            const x = Math.random() * (screenW - 2 * starConfig.margin) + starConfig.margin;
            const y = Math.random() * (screenH - 2 * starConfig.margin) + starConfig.margin;
            
            // 计算该位置的噪声值
            const noiseValue = noiseGenerator.fractalNoise(
                x, y, 
                distributionConfig.octaves,
                distributionConfig.persistence,
                distributionConfig.scale
            );
            
            // 将噪声值映射到密度概率 [-1, 1] -> [0, 1]
            const normalizedNoise = (noiseValue + 1) / 2;
            
            // 计算该位置被选择的概率（增强对比度）
            let probability;
            if (noiseValue > distributionConfig.densityThreshold) {
                // 密集区域：使用幂函数增强高密度区域
                const enhancedNoise = Math.pow(normalizedNoise, 1 / distributionConfig.transitionSmoothness);
                probability = Math.pow(enhancedNoise, 1 - distributionConfig.clusterStrength);
                probability *= distributionConfig.maxDensity;
                
                // 超高密度区域额外加权
                if (noiseValue > 0.3) {
                    probability *= 1.5;
                }
            } else {
                // 稀疏区域：极低概率，使用指数衰减
                const sparseFactor = Math.exp(noiseValue * 2); // 指数映射，负值会显著减小
                probability = normalizedNoise * distributionConfig.minDensity * distributionConfig.sparseness * sparseFactor;
                
                // 极稀疏区域进一步降低概率
                if (noiseValue < -0.4) {
                    probability *= 0.3;
                }
            }
            
            // 概率判断：是否在此位置生成星星
            if (Math.random() < probability) {
                return { x, y, noiseValue, probability };
            }
            
            attempts++;
        }
        
        // 如果多次尝试失败，返回随机位置作为fallback
        return {
            x: Math.random() * (screenW - 2 * starConfig.margin) + starConfig.margin,
            y: Math.random() * (screenH - 2 * starConfig.margin) + starConfig.margin,
            noiseValue: 0,
            probability: 0.5
        };
    }

    // 统一的距离检查函数
    function isTooClose(x, y, scale, minDistance = 40) {
        const starSize = starConfig.baseSize * scale;
        const effectiveDistance = minDistance + starSize * 0.5;

        return stars.some(star => {
            const distance = Math.sqrt(Math.pow(x - star.x, 2) + Math.pow(y - star.y, 2));
            return distance < effectiveDistance;
        });
    }

    // 按等级分组的RSS订阅数据
    let rssSubscriptionsByLevel = {};
    let levelSubscriptionIndex = {};  // 记录每个等级当前使用到的订阅索引
    
    // 组织RSS数据
    if (rssSubscriptions.length > 0) {
        rssSubscriptions.forEach(subscription => {
            const level = subscription.level;
            if (!rssSubscriptionsByLevel[level]) {
                rssSubscriptionsByLevel[level] = [];
                levelSubscriptionIndex[level] = 0;
            }
            rssSubscriptionsByLevel[level].push(subscription);
        });
        
        console.log('📂 RSS订阅按等级分组:', Object.keys(rssSubscriptionsByLevel).map(level => 
            `${level}: ${rssSubscriptionsByLevel[level].length}个`).join(', '));
    }

    // 生成基于RSS订阅的头像内容
    function generateRSSAvatarContent(level) {
        const levelSubs = rssSubscriptionsByLevel[level];
        if (!levelSubs || levelSubs.length === 0) {
            // 如果没有对应等级的RSS订阅，回退到随机头像
            return generateRandomAvatarContent();
        }
        
        // 按顺序获取下一个RSS订阅
        const currentIndex = levelSubscriptionIndex[level];
        const subscription = levelSubs[currentIndex];
        
        // 更新索引，循环使用
        levelSubscriptionIndex[level] = (currentIndex + 1) % levelSubs.length;
        
        return {
            type: 'rss',
            content: subscription.favorite_icon,
            blogName: subscription.blog_name,
            description: subscription.description,
            rssUrl: subscription.rss_url,
            blogUrl: subscription.blog_url, // 添加博客URL
            tags: subscription.tags,
            level: subscription.level
        };
    }

    // 生成头像内容的函数（保留原有的随机生成作为备用）
    function generateRandomAvatarContent() {
        // 示例用户名数组 - 实际使用时可以从后端获取
        const sampleNames = [
            '张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十',
            '小明', '小红', '小刚', '小丽', '小华', '小强', '小美', '小芳',
            'Alex', 'Bob', 'Charlie', 'Diana', 'Eva', 'Frank', 'Grace', 'Henry'
        ];
        
        // 随机选择一个用户名
        const userName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
        
        // 70%概率使用文字头像，30%概率使用图片头像（这里用占位符）
        if (Math.random() > 0.3) {
            // 文字头像 - 取用户名的第一个字符
            const firstChar = userName.charAt(0);
            return {
                type: 'text',
                content: firstChar,
                userName: userName
            };
        } else {
            // 图片头像 - 使用占位符服务或默认头像
            const avatarId = Math.floor(Math.random() * 100); // 随机头像ID
            return {
                type: 'image',
                content: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarId}`,
                userName: userName
            };
        }
    }

    // 创建头像元素的函数
    function createAvatarElement(avatarData) {
        const avatar = document.createElement('div');
        avatar.className = 'star-avatar';
        
        if (avatarData.type === 'text') {
            avatar.classList.add('text-avatar');
            avatar.textContent = avatarData.content;
        } else if (avatarData.type === 'rss') {
            // RSS订阅的favicon头像
            const img = document.createElement('img');
            img.src = avatarData.content;
            img.alt = avatarData.blogName;
            img.onerror = function() {
                // 如果favicon加载失败，回退到博客名称的首字母
                avatar.classList.add('text-avatar');
                const firstChar = avatarData.blogName.charAt(0);
                avatar.innerHTML = firstChar;
            };
            avatar.appendChild(img);
        } else {
            // 普通图片头像
            const img = document.createElement('img');
            img.src = avatarData.content;
            img.alt = avatarData.userName;
            img.onerror = function() {
                // 如果图片加载失败，回退到文字头像
                avatar.classList.add('text-avatar');
                avatar.innerHTML = avatarData.userName.charAt(0);
            };
            avatar.appendChild(img);
        }
        
        // 存储相关信息到数据属性
        if (avatarData.type === 'rss') {
            avatar.dataset.blogName = avatarData.blogName;
            avatar.dataset.rssUrl = avatarData.rssUrl;
            avatar.dataset.description = avatarData.description;
            avatar.dataset.tags = JSON.stringify(avatarData.tags);
        } else {
            avatar.dataset.userName = avatarData.userName;
        }
        
        return avatar;
    }

    // 创建星星元素的统一函数
    function createStar(x, y, level) {
        const star = document.createElement('span');
        star.className = 'star';
        star.dataset.level = level.name;
        star.dataset.size = Math.round(starConfig.baseSize * level.scale);

        // 每个星星独特的动画时间和延迟
        const animationDuration = (3 + Math.random() * 4) + 's';  // 3-7秒随机持续时间
        const animationDelay = Math.random() * 10 + 's';          // 0-10秒随机延迟

        // 基础样式
        Object.assign(star.style, {
            left: x + 'px',
            top: y + 'px',
            transform: `scale(${level.scale})`,
            animationDuration: animationDuration,
            animationDelay: animationDelay,
            opacity: 0.3 + level.scale * 0.7  // 改善亮度差异：微星0.44，小星0.545，中星0.65，亮星0.79，超星1.0
        });

        // 特殊效果样式
        if (level.specialClass) star.classList.add(level.specialClass);

        // CSS变量设置
        star.style.setProperty('--center-hue-rotate', `${level.hueRotate}deg`);
        star.style.setProperty('--center-saturate', level.saturate);
        star.style.setProperty('--center-glow-intensity', level.scale);
        star.style.setProperty('--center-glow-size', `${Math.max(16, level.scale * 20)}px`);

        // 创建并添加头像 - 优先使用RSS订阅数据
        const avatarData = generateRSSAvatarContent(level.name);
        const avatar = createAvatarElement(avatarData);
        star.appendChild(avatar);
        
        // 存储信息到星星数据属性
        if (avatarData.type === 'rss') {
            star.dataset.blogName = avatarData.blogName;
            star.dataset.rssUrl = avatarData.rssUrl;
            star.dataset.blogUrl = avatarData.blogUrl; // 添加博客URL
            star.dataset.description = avatarData.description;

            // 调试信息
            console.log(`🌟 创建RSS星星: ${avatarData.blogName} (${level.name}) - ${avatarData.description.slice(0, 30)}...`);
        } else {
            star.dataset.userName = avatarData.userName;
            
            // 调试信息  
            console.log(`👤 创建头像: ${avatarData.userName} (${avatarData.type}) - ${level.name}`);
        }

        return star;
    }

    // 生成指定数量的星星 - 改进版本，使用逐步放宽间距的策略
    function generateStars(count, level, useRelaxedDistance = false) {
        const generated = [];
        const originalMinDistance = level.minDistance;
        const relaxedMinDistance = starConfig.relaxedDistance;
        
        // 对于重要星星，使用更大的尝试次数
        const isImportantStar = level.name === '超星' || level.name === '亮星';
        const maxAttempts = isImportantStar ? 5000 : 2000;
        
        // 逐步放宽间距的策略
        const distanceSteps = isImportantStar ? [
            originalMinDistance,
            originalMinDistance * 0.8,
            originalMinDistance * 0.6,
            Math.max(relaxedMinDistance, originalMinDistance * 0.4)
        ] : [
            useRelaxedDistance ? relaxedMinDistance : originalMinDistance
        ];
        
        let currentStepIndex = 0;
        let currentDistance = distanceSteps[currentStepIndex];
        let attemptsForCurrentStep = 0;
        const attemptsPerStep = Math.floor(maxAttempts / distanceSteps.length);

        console.log(`🎯 开始生成 ${level.name}，目标数量: ${count}`);
        console.log(`📏 间距策略: ${distanceSteps.join('px → ')}px`);

        for (let i = 0; i < maxAttempts && generated.length < count; i++) {
            const positionData = generateNoiseBasedPosition();
            const { x, y, noiseValue, probability } = positionData;

            if (!isTooClose(x, y, level.scale, currentDistance)) {
                const star = createStar(x, y, level);
                container.appendChild(star);
                stars.push({ x, y, scale: level.scale, level: level.name, noiseValue, probability });
                generated.push(star);
                console.log(`✅ 成功生成 ${level.name}: ${generated.length}/${count} (间距: ${currentDistance}px, 噪声: ${noiseValue.toFixed(3)}, 概率: ${probability.toFixed(3)})`);
                attemptsForCurrentStep = 0; // 重置当前间距的尝试次数
            } else {
                attemptsForCurrentStep++;
                
                // 如果当前间距尝试了很多次还不成功，则放宽间距
                if (attemptsForCurrentStep >= attemptsPerStep && currentStepIndex < distanceSteps.length - 1) {
                    currentStepIndex++;
                    currentDistance = distanceSteps[currentStepIndex];
                    attemptsForCurrentStep = 0;
                    console.log(`📐 放宽间距至 ${currentDistance}px (${level.name})`);
                }
                
                if (i % 500 === 0 && i > 0) {
                    console.log(`⏳ ${level.name} 生成尝试 ${i}/${maxAttempts}, 已生成 ${generated.length}/${count}, 当前间距: ${currentDistance}px`);
                }
            }
        }
        
        if (generated.length < count) {
            console.warn(`⚠️  ${level.name} 生成不足: ${generated.length}/${count} (尝试了${maxAttempts}次)`);
        } else {
            console.log(`🎉 ${level.name} 生成完成: ${generated.length}/${count}`);
        }

        return generated;
    }

    // 强制生成星星 - 使用指定的最小间距
    function generateStarsWithForcedDistance(count, level, forcedDistance) {
        const generated = [];
        const maxAttempts = 3000;

        console.log(`💪 强制生成 ${level.name}，使用间距: ${forcedDistance}px`);

        for (let i = 0; i < maxAttempts && generated.length < count; i++) {
            const positionData = generateNoiseBasedPosition();
            const { x, y, noiseValue, probability } = positionData;

            if (!isTooClose(x, y, level.scale, forcedDistance)) {
                const star = createStar(x, y, level);
                container.appendChild(star);
                stars.push({ x, y, scale: level.scale, level: level.name, noiseValue, probability });
                generated.push(star);
                console.log(`💥 强制生成成功 ${level.name}: ${generated.length}/${count} (间距: ${forcedDistance}px, 噪声: ${noiseValue.toFixed(3)})`);
            }
            
            if (i % 500 === 0 && i > 0) {
                console.log(`⚡ 强制生成尝试 ${i}/${maxAttempts}, 已生成 ${generated.length}/${count}`);
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
        const generated = generateStars(level.count, level);
        results[level.name] = generated.length;
        totalAttempts += level.count * 2; // 估算尝试次数
    });

    console.log(`第一遍生成完成，总共 ${stars.length} 个星星`);

    // 检查缺失的重要星星并强制生成
    const missingLevels = starConfig.levels.filter(level =>
        results[level.name] < level.count &&
        (level.name === '亮星' || level.name === '超星')
    );

    if (missingLevels.length > 0) {
        console.log('🔄 开始强制生成缺失的重要星星...');
        missingLevels.forEach(level => {
            const missingCount = level.count - results[level.name];
            console.log(`🎯 强制生成 ${missingCount} 个 ${level.name}`);
            
            // 使用更激进的生成策略
            let regenerated = [];
            let attempts = 0;
            const maxRounds = 3;
            
            while (regenerated.length < missingCount && attempts < maxRounds) {
                attempts++;
                console.log(`🔄 第 ${attempts} 轮强制生成 ${level.name}...`);
                
                // 临时减小已有星星的有效距离，为新星星腾出空间
                const tempDistance = Math.max(15, level.minDistance * (0.3 - attempts * 0.1));
                const newStars = generateStarsWithForcedDistance(
                    missingCount - regenerated.length, 
                    level, 
                    tempDistance
                );
                
                regenerated.push(...newStars);
                results[level.name] += newStars.length;
                
                if (regenerated.length >= missingCount) {
                    console.log(`🎉 强制生成完成！${level.name}: ${regenerated.length}/${missingCount}`);
                    break;
                }
            }
            
            if (regenerated.length < missingCount) {
                console.warn(`⚠️  强制生成仍不足: ${level.name} ${regenerated.length}/${missingCount}`);
            }
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

        // 噪声分布统计
        const noiseStats = analyzeNoiseDistribution();
        
        // 控制台统计信息
        console.log(`🎉 生成完成！总共 ${stars.length} 个星星`);
        console.log(`🌌 噪声分布分析:`, noiseStats);
        console.table(starConfig.levels.map(level => ({
            等级: level.name,
            实际数量: levelCounts[level.name] || 0,
            预期数量: level.count,
            缩放: level.scale + 'x',
            最小间距: level.minDistance + 'px'
        })));
    }
    
    // 分析噪声分布特征
    function analyzeNoiseDistribution() {
        const starsWithNoise = stars.filter(star => star.noiseValue !== undefined);
        
        if (starsWithNoise.length === 0) {
            return { message: "没有噪声数据" };
        }
        
        const noiseValues = starsWithNoise.map(star => star.noiseValue);
        const probabilities = starsWithNoise.map(star => star.probability);
        
        // 基础统计
        const noiseMin = Math.min(...noiseValues);
        const noiseMax = Math.max(...noiseValues);
        const noiseMean = noiseValues.reduce((a, b) => a + b, 0) / noiseValues.length;
        const probMean = probabilities.reduce((a, b) => a + b, 0) / probabilities.length;
        
        // 密集度分析
        const denseStars = starsWithNoise.filter(star => star.noiseValue > distributionConfig.densityThreshold);
        const sparseStars = starsWithNoise.filter(star => star.noiseValue <= distributionConfig.densityThreshold);
        
        return {
            总数: starsWithNoise.length,
            噪声范围: `${noiseMin.toFixed(3)} ~ ${noiseMax.toFixed(3)}`,
            平均噪声: noiseMean.toFixed(3),
            平均概率: probMean.toFixed(3),
            密集区域: `${denseStars.length}个 (${(denseStars.length/starsWithNoise.length*100).toFixed(1)}%)`,
            稀疏区域: `${sparseStars.length}个 (${(sparseStars.length/starsWithNoise.length*100).toFixed(1)}%)`,
            密集度对比: `${(denseStars.length/Math.max(sparseStars.length,1)).toFixed(2)}:1`
        };
    }

    updateStats();

    // 检查头像生成情况
    setTimeout(() => {
        const allStars = document.querySelectorAll('.star');
        const allAvatars = document.querySelectorAll('.star-avatar');
        console.log(`🔍 页面检查: ${allStars.length} 个星星, ${allAvatars.length} 个头像`);
        
        // 检查每个星星是否都有头像
        allStars.forEach((star, index) => {
            const avatar = star.querySelector('.star-avatar');
            if (!avatar) {
                console.error(`❌ 星星 ${index} 缺少头像:`, star);
            }
        });
        
        if (allAvatars.length === 0) {
            console.error('❌ 没有找到任何头像元素！');
        } else {
            console.log('✅ 头像生成正常');
        }
    }, 1000);

    // 筛选功能初始化
    initFilterSystem(starConfig);

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

    // iframe弹窗功能
function showIframePopup(url, blogName) {
    // 创建弹窗容器
    const popup = document.createElement('div');
    popup.id = 'iframe-popup';
    popup.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;

    // 创建弹窗内容
    popup.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            width: 90%;
            max-width: 1200px;
            height: 80%;
            max-height: 800px;
            position: relative;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            overflow: hidden;
        ">
            <!-- 标题栏 -->
            <div style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 20px;
                font-weight: bold;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <span>🌐 ${blogName} - 预览</span>
                <button id="close-popup" style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">✕ 关闭</button>
            </div>

            <!-- iframe容器 -->
            <div style="
                width: 100%;
                height: calc(100% - 60px);
                position: relative;
            ">
                <iframe
                    src="${url}"
                    style="
                        width: 100%;
                        height: 100%;
                        border: none;
                        border-radius: 0 0 12px 12px;
                    "
                    sandbox="allow-same-origin allow-scripts allow-forms"
                ></iframe>
                <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #666;
                    font-size: 16px;
                    display: none;
                " id="loading-indicator">
                    正在加载 ${blogName}...
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // 绑定关闭事件
    const closeBtn = popup.querySelector('#close-popup');
    closeBtn.addEventListener('click', () => {
        popup.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (popup.parentNode) {
                popup.parentNode.removeChild(popup);
            }
        }, 300);
    });

    // 点击遮罩层关闭
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            popup.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                if (popup.parentNode) {
                    popup.parentNode.removeChild(popup);
                }
            }, 300);
        }
    });

    // ESC键关闭
    document.addEventListener('keydown', function closeOnEscape(e) {
        if (e.key === 'Escape') {
            popup.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                if (popup.parentNode) {
                    popup.parentNode.removeChild(popup);
                }
            }, 300);
            document.removeEventListener('keydown', closeOnEscape);
        }
    });
}

// 页面加载时检查之前的状态
const isPanelHidden = localStorage.getItem('infoPanelHidden') === 'true';
if (isPanelHidden) {
    hideInfoPanel();
}

    // 点击星星显示信息
    document.addEventListener('click', function(e) {
        // 检查是否点击了星星或星星内的头像
        let targetStar = null;
        if (e.target.classList.contains('star')) {
            targetStar = e.target;
        } else if (e.target.closest('.star')) {
            targetStar = e.target.closest('.star');
        }

        if (targetStar) {
            const level = targetStar.dataset.level;
            const size = targetStar.dataset.size;
            const blogName = targetStar.dataset.blogName;
            const userName = targetStar.dataset.userName;
            const description = targetStar.dataset.description;
            const rssUrl = targetStar.dataset.rssUrl;
            const rect = targetStar.getBoundingClientRect();

            // 创建提示框
            const tooltip = document.createElement('div');
            tooltip.style.position = 'fixed';
            tooltip.style.left = rect.left + 'px';
            tooltip.style.top = (rect.top - 100) + 'px';
            tooltip.style.background = 'rgba(0,0,0,0.9)';
            tooltip.style.color = 'white';
            tooltip.style.padding = '12px 16px';
            tooltip.style.borderRadius = '12px';
            tooltip.style.fontSize = '14px';
            tooltip.style.zIndex = '1000';
            tooltip.style.pointerEvents = 'auto'; // 支持按钮交互
            tooltip.style.border = '1px solid rgba(255,255,255,0.3)';
            tooltip.style.animation = 'fadeIn 0.3s ease';
            tooltip.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
            tooltip.style.minWidth = '160px';
            tooltip.style.maxWidth = '280px';

            let tooltipContent = '';
            if (blogName) {
                // RSS订阅星星的信息 - 添加超链接按钮
                const shortDesc = description ? (description.length > 50 ? description.slice(0, 50) + '...' : description) : '';
                const blogUrl = targetStar.dataset.blogUrl; // 从RSS订阅数据中获取blog_url
                tooltipContent = `
                    <div style="font-weight: bold; margin-bottom: 6px; color: #FFD700;">⭐ ${blogName}</div>
                    <div style="font-size: 13px; opacity: 0.9; margin-bottom: 6px;">等级: ${level}</div>
                    <div style="font-size: 12px; opacity: 0.7; margin-bottom: 8px;">${shortDesc}</div>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <button class="tooltip-btn visit-btn" data-url="${blogUrl}" style="background: #4CAF50; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">访问博客</button>
                        <button class="tooltip-btn preview-btn" data-url="${blogUrl}" data-blog="${blogName}" style="background: #2196F3; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">预览</button>
                    </div>
                    <div style="font-size: 10px; opacity: 0.5; margin-top: 4px;">大小: ${size}px | RSS订阅源</div>
                `;
            } else {
                // 普通头像星星的信息
                tooltipContent = `
                    <div style="font-weight: bold; margin-bottom: 6px; color: #FFD700;">⭐ ${userName}</div>
                    <div style="font-size: 13px; opacity: 0.9; margin-bottom: 4px;">等级: ${level}</div>
                    <div style="font-size: 12px; opacity: 0.7;">大小: ${size}px</div>
                `;
            }

            tooltip.innerHTML = tooltipContent;
            
            // 临时添加到body以计算实际尺寸
            tooltip.style.visibility = 'hidden';
            tooltip.style.left = '0px';
            tooltip.style.top = '0px';
            document.body.appendChild(tooltip);
            
            // 获取屏幕和弹出框尺寸
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            const tooltipRect = tooltip.getBoundingClientRect();
            const tooltipWidth = tooltipRect.width;
            const tooltipHeight = tooltipRect.height;
            
            // 计算初始位置（星星上方）
            let left = rect.left;
            let top = rect.top - tooltipHeight - 10; // 10px间距
            
            // 水平边界检测
            if (left + tooltipWidth > screenWidth - 10) {
                // 右侧超出，向左调整
                left = screenWidth - tooltipWidth - 10;
            }
            if (left < 10) {
                // 左侧超出，设置最小边距
                left = 10;
            }
            
            // 垂直边界检测
            if (top < 10) {
                // 上方超出，显示在星星下方
                top = rect.bottom + 10;
            }
            if (top + tooltipHeight > screenHeight - 10) {
                // 下方也超出，显示在星星右侧
                top = rect.top;
                left = rect.right + 10;
                
                // 如果右侧也超出，显示在左侧
                if (left + tooltipWidth > screenWidth - 10) {
                    left = rect.left - tooltipWidth - 10;
                }
                
                // 确保不超出左边界
                if (left < 10) {
                    left = 10;
                }
                
                // 垂直居中对齐星星
                top = Math.max(10, Math.min(top, screenHeight - tooltipHeight - 10));
            }
            
            // 应用最终位置并显示
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
            tooltip.style.visibility = 'visible';

            // 为tooltip按钮添加事件监听器
            const visitBtn = tooltip.querySelector('.visit-btn');
            const previewBtn = tooltip.querySelector('.preview-btn');

            if (visitBtn) {
                visitBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const url = e.target.dataset.url;
                    window.open(url, '_blank');
                    // 关闭tooltip
                    tooltip.style.animation = 'fadeOut 0.3s ease';
                    setTimeout(() => {
                        if (tooltip.parentNode) {
                            tooltip.parentNode.removeChild(tooltip);
                        }
                    }, 300);
                });
            }

            if (previewBtn) {
                previewBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const url = e.target.dataset.url;
                    const blogName = e.target.dataset.blog;
                    showIframePopup(url, blogName);
                    // 关闭tooltip
                    tooltip.style.animation = 'fadeOut 0.3s ease';
                    setTimeout(() => {
                        if (tooltip.parentNode) {
                            tooltip.parentNode.removeChild(tooltip);
                        }
                    }, 300);
                });
            }

            // 3秒后自动消失
            setTimeout(() => {
                if (tooltip.parentNode) {
                    tooltip.style.animation = 'fadeOut 0.3s ease';
                    setTimeout(() => {
                        if (tooltip.parentNode) {
                            tooltip.parentNode.removeChild(tooltip);
                        }
                    }, 300);
                }
            }, 3000);

            // 添加点击反馈效果
            targetStar.style.animation = 'none';
            targetStar.style.transform = `scale(${targetStar.style.transform.match(/scale\(([\d.]+)/)[1] * 1.2})`;
            setTimeout(() => {
                targetStar.style.transform = targetStar.style.transform.replace(/scale\(([\d.]+)/, `scale(${parseFloat(targetStar.style.transform.match(/scale\(([\d.]+)/)[1]) / 1.2})`);
            }, 300);
        }
    });
});

// 筛选功能初始化函数
function initFilterSystem(starConfig) {
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

    // 检查DOM元素是否存在
    if (!filterToggle || !filterPanel || !filterOptions || !selectAllBtn || !selectNoneBtn || !applyFilterBtn) {
        console.error('筛选系统DOM元素未找到，跳过筛选功能初始化');
        return;
    }

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
    // 流星系统配置 - 动态视觉特效
    // ==============================================
    const meteorConfig = {
        // 生成频率：30%概率每次检查时生成流星
        spawnRate: 0.3,

        // 时间间隔：2-8秒随机延迟
        minDelay: 2000,
        maxDelay: 8000,

        // 流星类型配置（权重总和：100）
        types: [
            // 普通类型（高频出现）
            { name: 'small', weight: 50, duration: 1500, tailLength: 60, speed: 'fast' },
            { name: 'medium', weight: 30, duration: 2000, tailLength: 80, speed: 'medium' },
            { name: 'large', weight: 12, duration: 2500, tailLength: 100, speed: 'variable' },

            // 特效类型（低频珍贵）
            { name: 'burst', weight: 5, duration: 2200, tailLength: 90, speed: 'burst' },
            { name: 'golden', weight: 2.5, duration: 2800, tailLength: 120, speed: 'burst' },    // 金色特效
            { name: 'blue', weight: 0.5, duration: 3000, tailLength: 110, speed: 'variable' }    // 蓝色珍稀
        ]
    };

    // ==============================================
    // 创建流星 - 动态视觉特效生成器
    // ==============================================
    function createMeteor() {
        // 创建流星DOM元素
        const meteor = document.createElement('div');
        meteor.className = 'meteor';
        
        // 获取当前屏幕尺寸
        const currentScreenW = window.innerWidth;
        const currentScreenH = window.innerHeight;
        
        // 随机选择流星类型
        const randomValue = Math.random() * 100;
        let cumulativeWeight = 0;
        let selectedType = meteorConfig.types[0];
        
        for (const type of meteorConfig.types) {
            cumulativeWeight += type.weight;
            if (randomValue <= cumulativeWeight) {
                selectedType = type;
                break;
            }
        }
        
        meteor.classList.add(`meteor-${selectedType.name}`);
        
        // 随机起始位置 (屏幕左上角区域)
        const startX = Math.random() * currentScreenW * 0.3 - 100;
        const startY = Math.random() * currentScreenH * 0.3 - 100;
        
        // 计算落点 (确保流星能穿过屏幕)
        const angle = 45 * (Math.PI / 180); // 45度角
        const distance = Math.sqrt(currentScreenW * currentScreenW + currentScreenH * currentScreenH) + 200;
        const endX = startX + distance * Math.cos(angle);
        const endY = startY + distance * Math.sin(angle);
        
        meteor.style.left = startX + 'px';
        meteor.style.top = startY + 'px';
        
        // 设置动画持续时间
        meteor.style.animationDuration = selectedType.duration + 'ms';
        meteor.style.setProperty('--end-x', (endX - startX) + 'px');
        meteor.style.setProperty('--end-y', (endY - startY) + 'px');
        
        // 动态设置尾迹长度
        meteor.style.setProperty('--tail-length', selectedType.tailLength + 'px');
        
        // 根据速度类型调整尾迹透明度变化
        if (selectedType.speed === 'fast') {
            meteor.style.setProperty('--tail-opacity-start', '0.2');
            meteor.style.setProperty('--tail-opacity-end', '0.9');
        } else if (selectedType.speed === 'variable') {
            meteor.style.setProperty('--tail-opacity-start', '0.1');
            meteor.style.setProperty('--tail-opacity-end', '1.0');
        } else if (selectedType.speed === 'burst') {
            meteor.style.setProperty('--tail-opacity-start', '0.3');
            meteor.style.setProperty('--tail-opacity-end', '1.2');
        } else {
            meteor.style.setProperty('--tail-opacity-start', '0.15');
            meteor.style.setProperty('--tail-opacity-end', '0.8');
        }
        
        // 添加到容器
        meteorContainer.appendChild(meteor);
        
        // 动画结束后移除
        setTimeout(() => {
            if (meteor.parentNode) {
                meteor.parentNode.removeChild(meteor);
            }
        }, selectedType.duration);
        
        console.log(`🌠 创建${selectedType.name}流星 (${selectedType.duration}ms, 尾长:${selectedType.tailLength}px)`);
    }
    
    // ==============================================
    // 流星生成调度系统 - 随机间隔生成
    // ==============================================
    function scheduleMeteor() {
        // 基于spawnRate概率决定是否生成流星
        if (Math.random() < meteorConfig.spawnRate) {
            createMeteor();
        }

        // 计算下次生成的时间间隔 (2-8秒随机)
        const nextDelay = Math.random() * (meteorConfig.maxDelay - meteorConfig.minDelay) + meteorConfig.minDelay;
        setTimeout(scheduleMeteor, nextDelay);
    }

    // ==============================================
    // 启动流星生成系统
    // ==============================================
    // 延迟3秒启动，避免页面刚加载时过于突兀
    setTimeout(() => {
        console.log('🌠 流星生成系统已启动');
        scheduleMeteor();
    }, 3000);
}
