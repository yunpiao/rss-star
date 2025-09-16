// 工具提示框边界检测修复脚本
// 在页面加载后执行这个脚本来修复弹出框边界问题

function fixTooltipBoundaries() {
    // 重写原始的点击事件处理函数
    document.removeEventListener('click', originalClickHandler);
    
    document.addEventListener('click', function(e) {
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
            tooltip.style.background = 'rgba(0,0,0,0.9)';
            tooltip.style.color = 'white';
            tooltip.style.padding = '12px 16px';
            tooltip.style.borderRadius = '12px';
            tooltip.style.fontSize = '14px';
            tooltip.style.zIndex = '1000';
            tooltip.style.pointerEvents = 'auto';
            tooltip.style.border = '1px solid rgba(255,255,255,0.3)';
            tooltip.style.animation = 'fadeIn 0.3s ease';
            tooltip.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
            tooltip.style.minWidth = '160px';
            tooltip.style.maxWidth = '280px';

            let tooltipContent = '';
            if (blogName) {
                const shortDesc = description ? (description.length > 50 ? description.slice(0, 50) + '...' : description) : '';
                const blogUrl = targetStar.dataset.blogUrl;
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
                tooltipContent = `
                    <div style="font-weight: bold; margin-bottom: 6px; color: #FFD700;">⭐ ${userName}</div>
                    <div style="font-size: 13px; opacity: 0.9; margin-bottom: 4px;">等级: ${level}</div>
                    <div style="font-size: 12px; opacity: 0.7;">大小: ${size}px</div>
                `;
            }

            tooltip.innerHTML = tooltipContent;
            
            // 临时添加以计算尺寸
            tooltip.style.visibility = 'hidden';
            tooltip.style.left = '0px';
            tooltip.style.top = '0px';
            document.body.appendChild(tooltip);
            
            // 边界检测和位置调整
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            const tooltipRect = tooltip.getBoundingClientRect();
            const tooltipWidth = tooltipRect.width;
            const tooltipHeight = tooltipRect.height;
            
            let left = rect.left;
            let top = rect.top - tooltipHeight - 10;
            
            // 右边界检测
            if (left + tooltipWidth > screenWidth - 10) {
                left = screenWidth - tooltipWidth - 10;
            }
            // 左边界检测
            if (left < 10) {
                left = 10;
            }
            
            // 上边界检测
            if (top < 10) {
                top = rect.bottom + 10;
            }
            // 下边界检测
            if (top + tooltipHeight > screenHeight - 10) {
                top = rect.top;
                left = rect.right + 10;
                
                if (left + tooltipWidth > screenWidth - 10) {
                    left = rect.left - tooltipWidth - 10;
                }
                if (left < 10) {
                    left = 10;
                }
                top = Math.max(10, Math.min(top, screenHeight - tooltipHeight - 10));
            }
            
            // 应用最终位置
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
            tooltip.style.visibility = 'visible';

            // 添加按钮事件
            const visitBtn = tooltip.querySelector('.visit-btn');
            const previewBtn = tooltip.querySelector('.preview-btn');

            if (visitBtn) {
                visitBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.open(e.target.dataset.url, '_blank');
                    removeTooltip(tooltip);
                });
            }

            if (previewBtn) {
                previewBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showIframePopup(e.target.dataset.url, e.target.dataset.blog);
                    removeTooltip(tooltip);
                });
            }

            // 3秒后自动消失
            setTimeout(() => removeTooltip(tooltip), 3000);

            // 点击反馈效果
            const currentScale = parseFloat(targetStar.style.transform.match(/scale\(([\d.]+)/)?.[1] || 1);
            targetStar.style.animation = 'none';
            targetStar.style.transform = targetStar.style.transform.replace(/scale\([^)]*\)/, `scale(${currentScale * 1.2})`);
            setTimeout(() => {
                targetStar.style.transform = targetStar.style.transform.replace(/scale\([^)]*\)/, `scale(${currentScale})`);
            }, 300);
        }
    });
}

function removeTooltip(tooltip) {
    if (tooltip && tooltip.parentNode) {
        tooltip.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        }, 300);
    }
}

// 页面加载完成后应用修复
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixTooltipBoundaries);
} else {
    fixTooltipBoundaries();
}