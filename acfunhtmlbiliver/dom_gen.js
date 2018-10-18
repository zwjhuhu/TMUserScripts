let _ = function(type, props, children) {
    let elem = null;
    if (type === "text") {
        return document.createTextNode(props);
    } else {
        elem = document.createElement(type);
    }
    for (let n in props) {
        if (n === "style") {
            for (let x in props.style) {
                elem.style[x] = props.style[x];
            }
        } else if (n === "className") {
            elem.className = props[n];
        } else if (n === "event") {
            for (let x in props.event) {
                elem.addEventListener(x, props.event[x]);
            }
        } else {
            elem.setAttribute(n, props[n]);
        }
    }
    if (children) {
        if (typeof children == 'string') {
            elem.innerHTML = children;
        } else if (Array.isArray(children)) {
            for (let i = 0; i < children.length; i++) {
                if (children[i] != null)
                    elem.appendChild(children[i]);
            }
        }
    }
    return elem;
};

let isChrome = /chrome/i.test(navigator.userAgent);

let firefoxVer = 0;
if (!isChrome) {
    firefoxVer = (navigator.userAgent.match(/Firefox\/(\d+)/) || [, 0])[1];
}

const PLAYER_STORAGE_KEY = 'acfun_html5';

function readStorage(name, cb) {
    let str = localStorage.getItem(PLAYER_STORAGE_KEY);
    let item = {};
    if(str&&str.length){
        item = JSON.parse(str);
    }
    if (typeof cb === 'function') {
        cb(item);
    }
    return item[name];
}

function saveStorage(save) {
    let str = localStorage.getItem(PLAYER_STORAGE_KEY);
    if(str&&str.length){
        let lastSaved = JSON.parse(str);
        Object.assign(lastSaved,save);
        save = lastSaved;
    }
    localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(save));
    
}

function getCookie(name) {
    let cookies = {};
    document.cookie.split('; ').forEach(function(i) {
        let [key, ...val] = i.split('=');
        cookies[key] = val.join('=');
    });
    return cookies[name] || '';
}

let _t = function(s) {
    let msgs = {
        "statsPlayer": {
            "message": "播放器尺寸："
        },
        "statsVideo": {
            "message": "视频分辨率："
        },
        "statsBuffer": {
            "message": "可用缓冲："
        },
        "statsBufferClip": {
            "message": "缓冲片段："
        },
        "statsPresent": {
            "message": "期望帧率："
        },
        "statsDrop": {
            "message": "丢弃帧率："
        },
        "statsMimetype": {
            "message": "文件格式："
        },
        "statsVideoBitrate": {
            "message": "本段视频码率："
        },
        "statsAudioBitrate": {
            "message": "本段音频码率："
        },
        "statsCurrentBitrate": {
            "message": "本段码率："
        },
        "statsRealtimeBitrate": {
            "message": "实时码率："
        },
        "overallBitrate": {
            "message": "总体码率："
        },
        "reload": {
            "message": "重新加载"
        },
        "statsDownloadSpeed": {
            "message": "下载速度："
        },
        "sendSmall": {
            "message": "小字号"
        },
        "sendMid": {
            "message": "中字号"
        },
        "sendSize": {
            "message": "弹幕字号"
        },
        "sendMode": {
            "message": "弹幕模式"
        },
        "sendTop": {
            "message": "顶端渐隐"
        },
        "sendScroll": {
            "message": "滚动字幕"
        },
        "sendBottom": {
            "message": "底端渐隐"
        },
        "send": {
            "message": "发送"
        },
        "sendStyle": {
            "message": "弹幕样式"
        },
        "sendColor": {
            "message": "弹幕颜色"
        },
        "commentSpeed": {
            "message": "弹幕速度"
        },
        "commentScale": {
            "message": "弹幕比例"
        },
        "commentDensity": {
            "message": "弹幕密度"
        },
        "commentOpacity": {
            "message": "弹幕不透明度"
        },
        "commentBlock": {
            "message": "弹幕屏蔽设定"
        },
        "playSpeed": {
            "message": "播放速度"
        },
        "playSpeedReset": {
            "message": "还原正常速度"
        },
        "displayScaleD": {
            "message": "默认"
        },
        "displayScaleF": {
            "message": "铺满"
        },
        "shieldTypeText": {
            "message": "文字"
        },
        "shieldTypeUser": {
            "message": "用户"
        },
        "shieldTypeColor": {
            "message": "颜色"
        },
        "shieldTypeSetting": {
            "message": "设置"
        },
        "shieldAdd": {
            "message": "添加屏蔽……"
        },
        "shieldUseRegex": {
            "message": "启用正则"
        },
        "shieldBlockTop": {
            "message": "屏蔽顶端弹幕"
        },
        "shieldBlockBottom": {
            "message": "屏蔽底端弹幕"
        },
        "shieldBlockVisitor": {
            "message": "屏蔽游客弹幕"
        },
        "shieldRepeat": {
            "message": "去除刷屏弹幕"
        },
        "viewers": {
            "message": " 观众"
        },
        "comments": {
            "message": " 弹幕"
        },
        "commentTime": {
            "message": "时间"
        },
        "commentContent": {
            "message": "评论"
        },
        "commentDate": {
            "message": "发送日期"
        },
        "showStats": {
            "message": "显示统计信息"
        },
        "loadingMeta": {
            "message": "正在加载视频信息"
        },
        "switching": {
            "message": "正在切换"
        },
        "fetchURL": {
            "message": "正在获取视频地址"
        },
        "buffering": {
            "message": "正在缓冲"
        },
        "play": {
            "message": "播放"
        },
        "pause": {
            "message": "暂停"
        },
        "mute": {
            "message": "静音"
        },
        "unmute": {
            "message": "取消静音"
        },
        "muteNotSupported": {
            "message": "不支持静音"
        },
        "fullScreen": {
            "message": "浏览器全屏"
        },
        "exitFullScreen": {
            "message": "退出全屏"
        },
        "webFull": {
            "message": "网页全屏"
        },
        "exitWebFull": {
            "message": "退出网页全屏"
        },
        "cmtListShow": {
            "message": "显示弹幕列表"
        },
        "cmtListHide": {
            "message": "隐藏弹幕列表"
        },
        "sendTooltip": {
            "message": "毁灭地喷射白光!da!"
        },
        "showComment": {
            "message": "显示弹幕"
        },
        "hideComment": {
            "message": "隐藏弹幕"
        },
        "loopOn": {
            "message": "洗脑循环 on"
        },
        "loopOff": {
            "message": "洗脑循环 off"
        },
        "usingCanvas": {
            "message": "正在使用Canvas"
        },
        "usingCSS": {
            "message": "正在使用CSS"
        },
        "useCSS": {
            "message": "使用CSS绘制弹幕"
        },
        "autoOpacityOn": {
            "message": "关闭自动不透明度"
        },
        "autoOpacityOff": {
            "message": "开启自动不透明度"
        },
        "copyComment": {
            "message": "复制弹幕"
        },
        "findComment": {
            "message": "定位弹幕"
        },
        "blockContent": {
            "message": "屏蔽内容“"
        },
        "blockUser": {
            "message": "屏蔽发送者"
        },
        "blockColor": {
            "message": "屏蔽颜色"
        },
        "blockColorWhite": {
            "message": "不能屏蔽白色"
        },
        "copyFail": {
            "message": "复制失败，浏览器不支持"
        },
        "blockUserEmpty": {
            "message": "没有屏蔽用户"
        },
        "blockColorEmpty": {
            "message": "没有屏蔽颜色"
        },
        "repeatPcs": {
            "message": "条"
        },
        "repeatUnlimited": {
            "message": "不限制"
        },
        "dragControlLowInc": {
            "message": "低速快进"
        },
        "dragControlLowDec": {
            "message": "低速快退"
        },
        "dragControlMedInc": {
            "message": "中速快进"
        },
        "dragControlMedDec": {
            "message": "中速快退"
        },
        "dragControlHighInc": {
            "message": "高速快进"
        },
        "dragControlHighDec": {
            "message": "高速快退"
        },
        "dragControlCancel": {
            "message": "取消跳转"
        },
        "extName": {
            "message": "AcFun HTML5 Player"
        },
        "extDesc": {
            "message": "一个装B播放器，送给缺B乐的各位（\n\n开源仓库：https://github.com/esterTion/AcFun-HTML5-Player"
        },
        "iconPending": {
            "message": "个视频等待播放"
        },
        "iconPlaying": {
            "message": "个视频正在播放"
        },
        "iconIdle": {
            "message": "没有可替换的播放器"
        },
        "close": {
            "message": "关闭"
        },
        "flvhd": {
            "message": "标清"
        },
        "mp4hd": {
            "message": "高清"
        },
        "mp4hd2": {
            "message": "超清"
        },
        "mp4hd3": {
            "message": "原画"
        },
        "emptyPW": {
            "message": "空密码"
        },
        "currentLang": {
            "message": "当前音频语言："
        },
        "needPW": {
            "message": "视频需要密码访问，请输入密码："
        },
        "enterPW": {
            "message": "输入视频密码"
        },
        "rememberPW": {
            "message": "记住密码"
        },
        "submit": {
            "message": "提交"
        },
        "wrongPW": {
            "message": "视频访问密码错误，请重新输入密码："
        },
        "fetchSourceErr": {
            "message": "获取视频地址出错，详细错误："
        },
        "audioLang": {
            "message": "音频语言"
        },
        "toYouku": {
            "message": "前往主站播放"
        },
        "fetchCommentErr": {
            "message": "弹幕获取失败"
        },
        "loadErr": {
            "message": "加载视频失败，无法播放该视频"
        },
        "playErr": {
            "message": "播放错误"
        },
        "playErrPop": {
            "message": " 播放出错，降级至 "
        },
        "switchErr": {
            "message": "切换失败，该语言/清晰度暂时不能播放"
        },
        "partialAvailable": {
            "message": "本视频仅可播放部分片段，请确认付费状态"
        },
        "restoreFlash": {
            "message": "还原flash播放器"
        },
        "fetchInfoErr": {
            "message": "获取视频信息出错，详细错误："
        },
        "uploader": {
            "message": "上传者："
        },
        "outputUrl": {
            "message": "输出视频地址"
        },
        "noVisitorComment": {
            "message": "游客无法发送弹幕"
        },
        "postCommentFail": {
            "message": "弹幕发送失败"
        },
        "replaceEmbed": {
            "message": "替换外链播放器"
        },
        "autoSwitch": {
            "message": "自动切换剧集"
        },
        "mayBlocked": {
            "message": "您可能开启了广告屏蔽并屏蔽了必要内容，请尝试临时禁用并刷新\n正常出现播放器后可以重新启用\n\n如果这不是您第一次看见这个提示，请确认网络状态"
        },
        "officialHtml5": {
            "message": "使用官方html5播放器"
        },
        "settings": {
            "message": "设置"
        },
        "settComment": {
            "message": "弹幕偏好设置"
        },
        "recordPlaySpeed": {
            "message": "将当前速度设为默认"
        },
        "settPlayer": {
            "message": "播放器偏好设置"
        },
        "autoPlay": {
            "message": "自动开始播放"
        },
        "defaultFull": {
            "message": "自动进入全屏模式"
        },
        "settExtension": {
            "message": "扩展偏好设置"
        },
        "statsSourceHost": {
            "message": "视频源域名："
        },
        "statsRedirection": {
            "message": "重定向："
        },
        "statsRedirectionNone": {
            "message": "否"
        },
        "extUpdated": {
            "message": "YAPfY 最近有更新啦！"
        },
        "extUpdated_ver": {
            "message": "现在我们的版本是"
        },
        "extUpdated_detail": {
            "message": "一些更新细节：\n1、项目已经更名为【Yet Another Player for Youku - 更好用的优酷播放器】\n2、播放出错时尝试播放较低清晰度"
        },
        "playerTheme": {
            "message": "播放器主题"
        },
        "cmStyle": {
            "message": "弹幕样式："
        },
        "cmStyle_st": {
            "message": "描边"
        },
        "cmStyle_sh": {
            "message": "阴影"
        },
        "cmStyle_stsh": {
            "message": "描边 + 阴影"
        },
        "next": {
            "message": "下一个视频："
        },
        "storylinePoints": {
            "message": "视频亮点"
        },
        "skipHead": {
            "message": "跳过片头片尾"
        },
        "volumeChange": {
            "message": "音量改变至 "
        },
        "rateChange": {
            "message": "速度改变至 "
        },
        "copySegUrl": {
            "message": "复制地址"
        },
        "copied": {
            "message": "已复制"
        }
    };

    return msgs[s].message;

};