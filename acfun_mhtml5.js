// ==UserScript==
// @name         acfunhtml5tmver
// @namespace    https://github.com/
// @version      1.0.0
// @description  插件的油猴版本,需要修改flv.js源码;
// @author       zwj
// @supportURL   https://github.com/zwjhuhu/TMUserScripts/issues
// @compatible   chrome
// @license      MIT
// @require      https://raw.githubusercontent.com/zwjhuhu/TMUserScripts/master/acfunhtmlbiliver/dom_gen.js
// @require      https://raw.githubusercontent.com/zwjhuhu/TMUserScripts/master/acfunhtmlbiliver/resizeSensor.js
// @require      https://raw.githubusercontent.com/zwjhuhu/TMUserScripts/master/acfunhtmlbiliver/rc4.js
// @require      https://raw.githubusercontent.com/zwjhuhu/TMUserScripts/master/acfunhtmlbiliver/md5.js
// @require      https://raw.githubusercontent.com/zwjhuhu/TMUserScripts/master/acfunhtmlbiliver/x2js.min.js
// @require      https://raw.githubusercontent.com/zwjhuhu/TMUserScripts/master/acfunhtmlbiliver/flv.min.js
// @require      https://raw.githubusercontent.com/zwjhuhu/TMUserScripts/master/acfunhtmlbiliver/jquery-3.3.1.min.js
// @require      https://raw.githubusercontent.com/zwjhuhu/TMUserScripts/master/acfunhtmlbiliver/google-style-loading.js
// @require      https://raw.githubusercontent.com/zwjhuhu/TMUserScripts/master/acfunhtmlbiliver/CommentCoreLibrary.js
// @require      https://raw.githubusercontent.com/zwjhuhu/TMUserScripts/master/acfunhtmlbiliver/biliplus_shield.js
// @require      https://raw.githubusercontent.com/zwjhuhu/TMUserScripts/master/acfunhtmlbiliver/ABPlayer.js
// @match        http://*.acfun.cn/v/ac*
// @match        http://*.acfun.cn/bangumi/*
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function (){

    //保存原来的fetch,因为有跨域的问题所有fetch转换为GM_xmlhttpRequest
    let orginFetch = window.fetch;
    let fetch = function(url,options){
        if(!url){
            return ;
        }
        let detail = {url:url};
        if(options){
            detail.method = options.method;
            let headers = {'User-Agent':window.navigator.userAgent};
            if(options.cache){
                headers['Cache-Control'] = options.cache;
            }
            if(options.referrer){
                headers['Referer'] = options.referrer;
            }
            if(headers['Referer']&&options.referrerPolicy && options.referrerPolicy ==='no-referrer'){
                delete headers['Referer'];
            }
            if(options.credentials&&options.credentials==='include'){
                detail.anonymous = false;
            }
            if(options.headers){
                Object.assign(headers,options.headers);
            }
            detail.headers = headers;
        }
        return new Promise(function(resolve,reject){
            detail.onload = function(e){
                e.json = function(){
                    return new Promise(function(res,rej){
                        try{
                            res(JSON.parse(e.responseText));
                        }catch(e){
                            rej(e);
                        }
                    });
                }
                resolve(e);
            }
            detail.onerror = function(e){
                reject(e);
            }
            GM_xmlhttpRequest(detail);
        });
    };

    function createPopup(param) {
        if (!param.content)
            return;
        if (document.querySelector('#AHP_Notice') != null)
            document.querySelector('#AHP_Notice').remove();

        let div = _('div', { id: 'AHP_Notice' });
        let childs = [];
        if (param.showConfirm) {
            childs.push(_('input', { value: param.confirmBtn, type: 'button', className: 'confirm', event: { click: param.onConfirm } }));
        }
        childs.push(_('input', {
            value: _t('close'), type: 'button', className: 'close', event: {
                click: function () {
                    div.style.height = 0;
                    setTimeout(function () { div.remove(); }, 500);
                }
            }
        }));
        div.appendChild(_('div', {}, [_('div', {},
                                        param.content.concat([_('hr'), _('div', { style: { textAlign: 'right' } }, childs)])
                                       )]));
        document.body.appendChild(div);
        div.style.height = div.firstChild.offsetHeight + 'px';
    }

    const rc4_key = '8bdc7e1a';
    let pageInfo;
    let knownTypes = {
        'mp4sd': _t('flvhd'),
        'flvhd': _t('flvhd'),
        'mp4hd': _t('mp4hd'),
        'mp4hd2': _t('mp4hd2'),
        'mp4hd2v2': _t('mp4hd2'),
        'mp4hd3': _t('mp4hd3'),
        'mp4hd3v2': _t('mp4hd3')
    };
    let audioLangs = {};
    let srcUrl = {};
    let availableSrc = [];
    window.currentSrc = '';
    window.currentLang = '';
    let firstTime = true;
    let highestType;

    function response2url(json) {
        let data = {};
        let savedLang = localStorage.YHP_PreferedLang || '';
        for (let val of json.stream) {
            if (!data[val.audio_lang])
                data[val.audio_lang] = {};
            if (!val.channel_type)
                data[val.audio_lang][val.stream_type] = val;
            //片尾、片头独立片段暂时丢弃
        }

        audioLangs.length = 0;
        for (let lang in data) {
            audioLangs[lang] = {
                src: {},
                available: []
            };
            audioLangs.length++;
            if (currentLang == '')
                currentLang = lang;
            if (savedLang == lang)
                currentLang = lang;

            if (data[lang].mp4hd3v2)
                delete data[lang].mp4hd3;
            if (data[lang].mp4hd2v2)
                delete data[lang].mp4hd2;
            if (data[lang].mp4sd)
                delete data[lang].flvhd,
                    typeDropMap = {
                    'mp4hd3v2': 'mp4hd2v2',
                    'mp4hd2v2': 'mp4hd',
                    'mp4hd': 'mp4sd'
                };

            for (let type in knownTypes) {
                if (data[lang][type]) {
                    let time = 0;
                    audioLangs[lang].src[type] = {
                        type: 'flv',
                        segments: [],
                        fetchM3U8: false,
                        withCredentials: true
                    };
                    for (let part of data[lang][type].segs) {
                        if (part.key == -1) {
                            audioLangs[lang].src[type].partial = true;
                            continue;
                        }
                        let seg = {
                            filesize: part.size | 0,
                            duration: part.total_milliseconds_video | 0,
                            url: part.url || part.cdn_url,
                            withCredentials: true
                        };
                        if (part.cdn_backup && part.cdn_backup.length) {
                            seg.backup_url = part.cdn_backup;
                        }
                        audioLangs[lang].src[type].segments.push(seg);
                        time += part.total_milliseconds_video | 0;
                    }
                    if ((pageInfo.sourceType == 'youku' || pageInfo.sourceType == 'youku2') && time < json.video.seconds * 1e3 - 30e3) {
                        //差距30s以上，视为限制视频
                        console.log('[AHP] Restricted video, trying hack');
                        pageInfo.sourceType = 'youku_hack';
                        sourceTypeRoute();
                        throw 'break out';
                    }
                    audioLangs[lang].src[type].duration = time;
                    audioLangs[lang].src.duration = time;
                    highestType = type;
                }
            }

            let selected;
            let hitPrefer = false;
            let prefer = localStorage.YHP_PreferedType || '';
            for (let type in knownTypes) {
                if (audioLangs[lang].src[type]) {
                    selected = [type, knownTypes[type]];
                    audioLangs[lang].available.push(selected);
                    if (firstTime && !hitPrefer && currentLang == lang) {
                        currentSrc = type;
                    }
                    if (prefer == type)
                        hitPrefer = true;
                }
            }
            if (firstTime && currentLang == lang && !hitPrefer)
                currentSrc = selected[0];
        }
    }

    function switchLang(lang) {
        Array.from(abpinst.playerUnit.querySelectorAll('.BiliPlus-Scale-Menu .Video-Defination>div')).forEach(function (i) {
            i.remove();
        });

        srcUrl = audioLangs[lang].src;
        availableSrc = audioLangs[lang].available;

        for (let i = 0; i < availableSrc.length; i++) {
            abpinst.playerUnit.querySelector('.BiliPlus-Scale-Menu .Video-Defination').appendChild(_('div', {
                changeto: JSON.stringify(availableSrc[i]),
                name: availableSrc[i][0],
                className: availableSrc[i][0] == currentSrc ? 'on' : ''
            }, [_('text', availableSrc[i][1])]));
        }
        if (audioLangs.length > 1)
            abpinst.removePopup(), abpinst.createPopup(_t('currentLang') + (knownLangs[lang] || lang), 3e3);
    }


    function fetchSrcThen(json) {
        if (json.error) {
            /*
        处理错误
        -2002 需要密码
        -2003 密码错误
        */
            dots.stopTimer();
            let error = json.error;
            createPopup({
                content: [_('p', { style: { fontSize: '16px' } }, [_('text', _t('fetchSourceErr'))]), _('text', JSON.stringify(json.error))],
                showConfirm: false
            });
            return;
        } else {
            response2url(json);
        }
        switchLang(currentLang);
        if (firstTime) {
            console.log('[AHP] Got source url', srcUrl);
            if (pageInfo.album)
                abpinst.title = pageInfo.title + ' - AB' + pageInfo.video.part;
            else if (pageInfo.videoList.length > 1)
                abpinst.title = '[P' + (pageInfo.P + 1) + '] ' + pageInfo.videoList[pageInfo.P].title + ' || ' + pageInfo.title + ' - AC' + pageInfo.id;
            else
                abpinst.title = pageInfo.title + ' - AC' + pageInfo.id;
            abpinst.playerUnit.addEventListener('sendcomment', sendComment);
            abpinst.playerUnit.querySelector('.BiliPlus-Scale-Menu').style.animationName = 'scale-menu-show';
            setTimeout(function () {
                abpinst.playerUnit.querySelector('.BiliPlus-Scale-Menu').style.animationName = '';
            }, 2e3);

            if (user.uid == -1) {
                abpinst.txtText.disabled = true;
                abpinst.txtText.placeholder = _t('noVisitorComment');
                abpinst.txtText.style.textAlign = 'center';
            }
            let contextMenu = abpinst.playerUnit.querySelector('.Context-Menu-Body');
            if (audioLangs.length > 1) {
                let childs = [];
                for (let lang in audioLangs) {
                    childs.push(_('div', { 'data-lang': lang }, [_('text', knownLangs[lang] || lang)]));
                }
                let langChange = _('div', { className: 'dm static' }, [
                    _('div', {}, [_('text', _t('audioLang'))]),
                    _('div', {
                        className: 'dmMenu', event: {
                            click: function (e) {
                                let lang = e.target.getAttribute('data-lang');
                                if (lang == currentLang)
                                    return;
                                while (audioLangs[lang].src[currentSrc] == undefined) {
                                    if (typeDropMap[currentSrc] == undefined) {
                                        abpinst.createPopup('切换错误，没有清晰度', 3e3);
                                        return false;
                                    }
                                    currentSrc = typeDropMap[currentSrc];
                                }
                                switchLang(lang);
                                currentLang = lang;
                                localStorage.YHP_PreferedLang = lang;
                                changeSrc('', currentSrc, true);
                            }
                        }
                    }, childs)
                ]);
                contextMenu.insertBefore(langChange, contextMenu.firstChild);
            }

            if (json.preview)
                abpinst.playerUnit.dispatchEvent(new CustomEvent('previewData', {
                    detail: {
                        code: 0, data: {
                            img_x_len: 10,
                            img_y_len: 10,
                            img_x_size: 128,
                            img_y_size: 72,
                            image: json.preview.thumb,
                            step: json.preview.timespan / 1e3
                        }
                    }
                }));
            /*readStorage('updateNotifyVer', function (item) {
            if (item.updateNotifyVer != '1.3.2') {
                saveStorage({ 'updateNotifyVer': '1.3.2' });
                chrome.runtime.sendMessage('version', function (version) {
                    createPopup({
                        content: [
                            _('p', { style: { fontSize: '16px' } }, [_('text', _t('extUpdated'))]),
                            _('div', { style: { whiteSpace: 'pre-wrap' } }, [
                                _('text', _t('extUpdated_ver') + version + "\n\n" + _t('extUpdated_detail'))
                            ])
                        ],
                        showConfirm: false
                    });
                });
            }
        });*/
        }
        changeSrc('', currentSrc, true);
        firstTime = false;
    }

    window.changeSrc = function (e, t, force) {
        let div = abpinst.playerUnit.querySelector('#info-box');
        if ((abpinst == undefined || (currentSrc == t)) && !force)
            return false;
        if (div.style.opacity == 0) {
            div.style.opacity = 1;
        }
        abpinst.playerUnit.querySelector('.BiliPlus-Scale-Menu .Video-Defination div.on').className = '';
        abpinst.playerUnit.querySelector('.BiliPlus-Scale-Menu .Video-Defination div[name=' + t + ']').className = 'on';
        abpinst.video.pause();
        if (srcUrl[t] != undefined) {
            if (!firstTime) div.childNodes[0].childNodes[0].textContent = ABP.Strings.switching;
            if (!dots.running)
                dots.runTimer();
            if (abpinst.lastTime == undefined)
                abpinst.lastTime = abpinst.video.currentTime;
            if (abpinst.lastSpeed == undefined)
                abpinst.lastSpeed = abpinst.video.playbackRate;
            abpinst.video.dispatchEvent(new CustomEvent('autoplay'));
            if (!force) {
                let setPrefer = t == highestType ? '' : t;
                localStorage.YHP_PreferedType = setPrefer;
            }
            flvparam(t);
        }
    };
    function reloadSegment() {
        let io = this._transmuxer._controller._ioctl;
        clearInterval(this._progressChecker);
        this._progressChecker = null;
        io.pause();
        io.resume();
        this._transmuxer._controller._enableStatisticsReporter();
    }
    let self = window;
    let createPlayer = function (e) {
        if (self.flvplayer != undefined) {
            self.flvplayer.unload();
            self.flvplayer.destroy();
            delete self.flvplayer;
        }
        if (e.detail == null)
            return false;
        self.flvplayer = flvjs.createPlayer(e.detail.src, e.detail.option);
        self.flvplayer.on('error', load_fail);
        self.flvplayer.attachMediaElement(abpinst.video);
        self.flvplayer.load();
        self.flvplayer.reloadSegment = reloadSegment;
    };
    window.addEventListener('beforeunload', function () {
        if (self.flvplayer != undefined) {
            self.flvplayer.unload();
            self.flvplayer.destroy();
            delete self.flvplayer;
        }
    })
    let load_fail = function (type, info, detail) {
        if (['youku', 'youku2'].indexOf(pageInfo.sourceType) != -1 && detail.code == 403) {
            sourceTypeRoute();
            return;
        }
        let div = _('div', {
            style: {
                width: '100%',
                height: '100%',
                textAlign: 'center',
                background: 'rgba(0,0,0,0.8)',
                position: 'absolute',
                color: '#FFF'
            }
        }, [
            _('div', {
                style: {
                    position: 'relative',
                    top: '50%'
                }
            }, [
                _('div', {
                    style: {
                        position: 'relative',
                        fontSize: '16px',
                        lineHeight: '16px',
                        top: '-8px'
                    }
                }, [_('text', _t('loadErr'))])
            ])
        ]);
        abpinst.playerUnit.querySelector('.ABP-Video').insertBefore(div, document.querySelector('.ABP-Video>:first-child'));
        abpinst.playerUnit.querySelector('#info-box').remove();
        createPopup({
            content: [_('p', { style: { fontSize: '16px' } }, [_('text', _t('playErr'))]), _('div', { style: { whiteSpace: 'pre-wrap' } }, [_('text', JSON.stringify({ type, info, detail }, null, '  '))])],
            showConfirm: false
        });
    };
    let flvparam = function (select) {
        currentSrc = select;
        createPlayer({
            detail: {
                src: srcUrl[select],
                option: {
                    seekType: 'range',
                    reuseRedirectedURL: true,
                    fixAudioTimestampGap: false,
                    customLoader:true,
                    tmfunc:GM_xmlhttpRequest,
                    headers:{
                        'Referer':window.location.href,
                        'User-Agent':window.navigator.userAgent
                    }
                }
            }
        });
        if (srcUrl[select].partial) {
            setTimeout(function () { abpinst.createPopup(_t('partialAvailable'), 3e3); }, 4e3);
        }
        if (srcUrl[select].segments) {
            let totalSize = 0;
            srcUrl[select].segments.forEach(function (i) { totalSize += i.filesize; });
            window.overallBitrate = totalSize / srcUrl.duration * 8;
        } else {
            window.overallBitrate = srcUrl[select].filesize / srcUrl.duration * 8;
        }
    };

    let danmuParse = new AcfunFormat.JSONParser;
    function parseComment(data) {
        let list = abpinst.cmManager.timeline;
        let itemParse = function (i) {
            let cmt = danmuParse.parseOne(i);
            list.push(cmt);
        };
        data[1].forEach(itemParse);
        data[2].forEach(itemParse);
        abpinst.cmManager.load(list);
    }
    function loadCommentBySize(data) {
        for (let i = 1, page = Math.ceil((data[1] + data[2]) / 1e3); i <= page && i <= 12; i++) {
            fetch('http://danmu.aixifan.com/V2/' + pageInfo.vid + '?pageSize=1000&pageNo=' + i, {
                method: 'GET',
                credentials: 'include',
                referrer: location.href,
                cache: 'no-cache'
            }).then(function (r) {
                r.json().then(function (data) {
                    parseComment(data);
                });
            });
        }
    }
    function sendComment(e) {
        let cmt = e.detail;
        let obj = {
            "action": 'post',
            "command": JSON.stringify({
                "mode": cmt.mode,
                "color": cmt.color,
                "size": cmt.fontsize,
                "stime": cmt.playTime | 0,
                "user": user.uid,
                "message": cmt.message,
                "time": (Date.now() / 1e3) | 0,
                "islock": '2'
            })
        };
        abpinst.danmu_ws.send(JSON.stringify(obj));
    }

    let dest = null;
    let ABPConfig;
    let currentBangumiUrl = location.href.split('?')[0];
    function chkInit() {
        readStorage('PlayerSettings', function (item) {
            ABPConfig = item.PlayerSettings || {};
            init();
            if (/\/bangumi\/ab/.test(currentBangumiUrl)) {
                let observer = new MutationObserver(bangumiEpisodeChange);
                observer.observe(document.body, { childList: true, subtree: true });
            }
        });
    }
    function bangumiEpisodeChange() {
        let newUrl = location.href.split('?')[0];
        if (newUrl != currentBangumiUrl) {
            location.href = newUrl;
        }
    }
    function init() {
        if (!pageInfo.vid || dest == null)
            return;
        window.cid = pageInfo.vid;
        let container = dest.parentNode;
        if (container == null) {
            dest = document.getElementById('ACFlashPlayer');
            init();
            return;
        }
        dest.remove();
        let blob = new Blob(['<!DOCTYPE HTML><html><head><meta charset="UTF-8"><style>html,body{height:100%;width:100%;margin:0;padding:0}</style></head><body></body></html>'], { type: 'text/html' });
        let bloburl = URL.createObjectURL(blob);
        window.playerIframe = container.appendChild(_('iframe', { className: 'AHP-Player-Container', src: bloburl, allow: 'fullscreen; autoplay' }));
        playerIframe.onload = function () {
            URL.revokeObjectURL(bloburl);
            fetch('https://raw.githubusercontent.com/zwjhuhu/TMUserScripts/master/acfunhtmlbiliver/ABPlayer.css', {
                method: 'GET',
                referrerPolicy: 'no-referrer'
            }).then(function (r) {
                playerIframe.contentDocument.head.appendChild(_('style', {type: 'text/css'},[_('text',r.responseText)]));
            });

            let video = playerIframe.contentDocument.body.appendChild(_('video', { poster: pageInfo.coverImage }));
            window.flvplayer = { unload: function () { }, destroy: function () { } };
            abpinst = ABP.create(video.parentNode, {
                src: {
                    playlist: [{
                        video: video
                    }]
                },
                width: '100%',
                height: '100%',
                config: ABPConfig,
                mobile: isMobile()
            });
            dots.init({
                container: abpinst.playerUnit.querySelector('#dots'),
                width: '100%',
                height: '100%',
                r: 16,
                thick: 4
            });
            dots.runTimer();

            fetch('http://www.acfun.cn/video/getVideo.aspx?id=' + pageInfo.vid, {
                method: 'GET',
                credentials: 'include',
                cache: 'no-cache'
            })
                .then(r => r.json())
                .then(r => {
                if (r.success) return r;
                else if (r.result === '您所在地区限制观看') {
                    // 代理获取，迟早被封？
                    return fetch('https://tx.biliplus.com/acfun_getVideo?id=' + pageInfo.vid, {
                        method: 'GET',
                        cache: 'no-cache'
                    }).then(r => r.json());
                }
                return r;
            })
                .then(function (data) {
                if (data.success) {
                    fetch('http://danmu.aixifan.com/size/' + pageInfo.vid, {
                        method: 'GET',
                        credentials: 'include',
                        referrer: location.href,
                        cache: 'no-cache'
                    })
                        .then(r => r.json())
                        .then(loadCommentBySize);
                    pageInfo.sourceId = data.sourceId;
                    pageInfo.sourceType = data.sourceType;
                    console.log('[AHP] Got sourceType:', data.sourceType, 'vid:', data.sourceId, data);
                    let backupSina;
                    // 提取sourceUrl新浪源
                    if (['zhuzhan', 'sina', 'youku', 'youku2'].indexOf(data.sourceType) == -1 && (backupSina = (data.sourceUrl || '').match(/video\.sina\.com\.cn\/v\/b\/(\d+)-/))) {
                        pageInfo.sourceType = 'sina';
                        pageInfo.sourceId = backupSina[1];
                        console.log('[AHP] Using backup sina vid: ' + pageInfo.sourceId);
                    }
                    sourceTypeRoute(data);
                } else {
                    dots.stopTimer();
                    createPopup({
                        content: [_('p', { style: { fontSize: '16px' } }, [_('text', _t('fetchSourceErr'))]), _('text', data.result)],
                        showConfirm: false
                    });
                }
            }).catch(function (e) {
                dots.stopTimer();
                createPopup({
                    content: [_('p', { style: { fontSize: '16px' } }, [_('text', _t('fetchSourceErr'))]), _('text', e.message)],
                    showConfirm: false
                });
            });
        };
        container.style.position = 'relative';
        resizeSensor(playerIframe.parentNode, function () {
            window.dispatchEvent(new Event('resize'));
            if (!playerIframe.parentNode.classList.contains('small')) {
                playerIframe.parentNode.style.left = '';
            }
        });
        /*readStorage('updateNotifyVer', function (item) {
            let notVer = '1.3.0';
            console.log(item);
            if (item.updateNotifyVer != notVer) {
                saveStorage({ 'updateNotifyVer': notVer });
                createPopup({
                    content: [
                        _('p', { style: { fontSize: '16px' } }, [_('text', 'AHP 最近有更新啦！')]),
                        _('div', { style: { whiteSpace: 'pre-wrap' } }, [
                            _('text', '现在我们的版本是' + notVer + "\n\n更新细节：\n- ac番剧可以跨区观看了（代理吃枣被封？）（代理不记录任何个人信息）\n- 改进音频同步？（我不知道好没好，感觉好像改进了）")
                        ])
                    ],
                    showConfirm: false
                });
            }
        });*/
    }
    function sourceTypeRoute(data) {
        switch (pageInfo.sourceType) {
            case 'sina':
                //新浪
                var time = parseInt((Date.now() / 1e3 | 0).toString(2).slice(0, -6), 2);
                fetch('http://ask.ivideo.sina.com.cn/v_play.php?vid=' + pageInfo.sourceId + '&ran=0&r=ent.sina.com.cn&p=i&k=' + hex_md5(pageInfo.sourceId + 'Z6prk18aWxP278cVAH' + time + '0').substr(0, 16) + time,
                      { method: 'GET', cache: 'no-cache', referrerPolicy: 'no-referrer' })
                    .then(r => r.text())
                    .then(r => (new X2JS({ arrayAccessFormPaths: ["video.durl"] })).xml_str2json(r))
                    .then(data => {
                    if (data.video.result == 'error') {
                        dots.stopTimer();
                        createPopup({
                            content: [_('p', { style: { fontSize: '16px', whiteSpace: 'pre-wrap' } }, [_('text', _t('fetchSourceErr')), _('text', JSON.stringify(data.video, null, '  '))]), _('text', location.href)],
                            showConfirm: false
                        });
                    } else
                        fetchSrcThen({
                            stream: [{
                                audio_lang: 'default',
                                milliseconds_audio: data.video.timelength | 0,
                                milliseconds_video: data.video.timelength | 0,
                                stream_type: 'mp4hd3',
                                segs: data.video.durl.map(function (i) {
                                    return {
                                        url: i.url,
                                        size: i.filesize | 0,
                                        total_milliseconds_audio: i.length | 0,
                                        total_milliseconds_video: i.length | 0
                                    };
                                })
                            }]
                        });
                });
                break;
            case 'letv':
                //乐视云已没救，勿念
                dots.stopTimer();
                createPopup({
                    content: [_('p', { style: { fontSize: '16px', whiteSpace: 'pre-wrap' } }, [_('text', data.sourceType + ' 源大部分视频已经失效，不计划添加支持\ndetail: ' + JSON.stringify({ sourceType: data.sourceType, sourceId: pageInfo.sourceId }, null, '  '))]), _('text', location.href)],
                    showConfirm: false
                });
                break;
            case 'zhuzhan':
                //Ac - 优酷云
                pageInfo.sign = data.encode;
                fetch('http://player.acfun.cn/flash_data?vid=' + pageInfo.sourceId + '&ct=85&ev=3&sign=' + pageInfo.sign + '&time=' + Date.now(), {
                    method: 'GET',
                    credentials: 'include',
                    referrer: location.href,
                    cache: 'no-cache'
                }).then(function (r) {
                    r.json().then(function (data) {
                        if (data.e && data.e.code !== 0) {
                            return fetchSrcThen({ error: data.e });
                        }
                        let decrypted = JSON.parse(rc4(rc4_key, atob(data.data)));
                        fetchSrcThen(decrypted);
                    });
                });
                break;
            case 'youku':
            case 'youku2':
                //优酷版权内容
                //设置&获取cna
                pageInfo.sourceId = pageInfo.sourceId.match(/([a-zA-Z0-9+=]+)/)[1];
                var h = new Headers();
                h.append('Range', 'bytes=0-0');
                fetch('https://player.youku.com/player.php/sid/' + pageInfo.sourceId + '/newPlayer/true/v.swf', {
                    method: 'GET',
                    headers: h,
                    credentials: 'include',
                    referrer: location.href,
                    cache: 'no-cache',
                    redirect: 'follow'
                }).then(function (r) {
                    pageInfo.yk_cna = r.url.match(/cna=([^&]+)/)[1];
                    pageInfo.yk_vext = r.url.match(/vext=([^&]+)/)[1];
                    return fetch('https://api.youku.com/players/custom.json?client_id=0edbfd2e4fc91b72&video_id=' + pageInfo.sourceId + '&refer=http://cdn.aixifan.com/player/cooperation/AcFunXYouku.swf&vext=' + pageInfo.yk_vext + '&embsig=undefined&styleid=undefined&type=flash', {
                        method: 'GET',
                        credentials: 'include',
                        referrer: location.href,
                        cache: 'no-cache'
                    }).then(function (r) { return r.json(); });
                }).then(function (data) {
                    pageInfo.yk_r = data.stealsign;
                    return fetch('https://ups.youku.com/ups/get.json?vid=' + pageInfo.sourceId + '&ccode=0405&client_ip=192.168.1.1&utid=' + pageInfo.yk_cna + '&client_ts=' + Date.now() + '&r=' + pageInfo.yk_r, {
                        method: 'GET',
                        credentials: 'include',
                        referrer: location.href,
                        cache: 'no-cache'
                    }).then(function (r) { return r.json(); });
                }).then(function (data) { fetchSrcThen(data.data); }).catch(e => { });
                break;
            case 'youku_hack':
                getYkStream(pageInfo.sourceId).then(function (data) { fetchSrcThen(data.data); });
                break;
            default:
                dots.stopTimer();
                createPopup({
                    content: [_('p', { style: { fontSize: '16px', whiteSpace: 'pre-wrap' } }, [_('text', '暂不支持的视频源：' + data.sourceType + '\n请于 '), _('a', { target: '_blank', href: 'https://github.com/esterTion/AcFun-HTML5-Player/issues' }, [_('text', 'GitHub')]), _('text', ' 留言')]), _('text', location.href)],
                    showConfirm: false
                });
                return;
        }
    }

    function getYkStream(vid) {
        return new Promise(resolve => {
            window.addEventListener('message', function message(e) {
                try {
                    let data = JSON.parse(e.data);
                    if (data.cmd == 'stream') {
                        this.removeEventListener('message', message);
                        ifr.remove();
                        resolve(data.data);
                    }
                } catch (e) { }
            })
            let ifr = document.body.appendChild(_('iframe', {
                src: '//v.youku.com/v_show/id_' + vid + '.html', style: { height: 0, width: 0, display: 'none' }, muted: 'muted',
                event: {
                    load: function load() {
                        console.log('[AHP] Subpage loaded, requesting stream');
                        this.removeEventListener('load', load);
                        ifr.contentWindow.postMessage('AHP_get_stream', '*');
                    }
                }
            }));
        });
    }

    (function () {
        let noticeWidth = Math.min(500, innerWidth - 40);
        document.head.appendChild(_('style', {}, [_('text', `#AHP_Notice{
position:fixed;left:0;right:0;top:0;height:0;z-index:20000;transition:.5s;cursor:default
}
.AHP_down_banner{
margin:2px;padding:2px;color:#FFFFFF;font-size:13px;font-weight:bold;background-color:green
}
.AHP_down_btn{
margin:2px;padding:4px;color:#1E90FF;font-size:14px;font-weight:bold;border:#1E90FF 2px solid;display:inline-block;border-radius:5px
}
body.ABP-FullScreen{
overflow:hidden
}
@keyframes pop-iframe-in{0%{opacity:0;transform:scale(.7);}100%{opacity:1;transform:scale(1)}}
@keyframes pop-iframe-out{0%{opacity:1;transform:scale(1);}100%{opacity:0;transform:scale(.7)}}
#AHP_Notice>div{
position:absolute;bottom:0;left:0;right:0;font-size:15px
}
#AHP_Notice>div>div{
border:1px #AAA solid;width:${noticeWidth}px;margin:0 auto;padding:20px 10px 5px;background:#EFEFF4;color:#000;border-radius:5px;box-shadow:0 0 5px -2px
}
#AHP_Notice>div>div *{
margin:5px 0;
}
#AHP_Notice input[type=text]{
border: none;border-bottom: 1px solid #AAA;width: 60%;background: transparent
}
#AHP_Notice input[type=text]:active{
border-bottom-color:#4285f4
}
#AHP_Notice input[type=button] {
border-radius: 2px;
border: #adadad 1px solid;
padding: 3px;
margin: 0 5px;
width:50px
}
#AHP_Notice input[type=button]:hover {
background: #FFF;
}
#AHP_Notice input[type=button]:active {
background: #CCC;
}
.noflash-alert{display:none}`)]));
        if ((dest = document.getElementById('ACFlashPlayer')) != null) {
            window.addEventListener('AHP_pageInfo', function pageInfoGrabber(e) {
                window.removeEventListener('AHP_pageInfo', pageInfoGrabber);
                pageInfo = e.detail.pageInfo;
                window.user = {
                    uid: getCookie('auth_key'),
                    uid_ck: getCookie('auth_key_ac_sha1'),
                    uname: getCookie('ac_username')
                };
                if (document.getElementById('pageInfo') != null) {
                    pageInfo.vid = pageInfo.videoId;
                    document.head.appendChild(_('style', {}, [_('text', '.AHP-Player-Container{width:1160px;height:730px}@media screen and (max-width: 1440px){.AHP-Player-Container{width:980px;height:628px}}.small .AHP-Player-Container{width:260px;height:147px;margin-top:26px}')]));
                } else {
                    pageInfo.vid = pageInfo.video.videos[0].danmakuId;
                    pageInfo.coverImage = pageInfo.video.videos[0].image;
                    pageInfo.title = pageInfo.album.title + ' ' + pageInfo.video.videos[0].episodeName;
                    document.head.appendChild(_('style', {}, [_('text', '.AHP-Player-Container{width:1200px;height:715px}@media screen and (max-width: 1440px){.AHP-Player-Container{width:980px;height:592px}}.small .AHP-Player-Container{width:260px;height:147px;margin-top:26px}')]));
                }
                chkInit();
            });
            document.head.appendChild(_('script', {}, [_('text', 'window.dispatchEvent(new CustomEvent("AHP_pageInfo", {detail:{pageInfo}}));f.ready();')])).remove();
            /*
        if (document.getElementById('pageInfo') != null) {
            //普通投稿
            pageInfo = Object.assign({}, (document.getElementById('pageInfo') || { dataset: {} }).dataset);

            init();
        } else {
            //剧集视频
        }*/
        }
    })();
    flvjs.LoggingControl.enableVerbose = false;
    flvjs.LoggingControl.enableInfo = false;
    flvjs.LoggingControl.enableDebug = false;
    window.crc_engine = () => { return ''; };


    let webFullState = false;
    window.addEventListener('message', function (e) {
        if (['AHP_CrossFrame_Fullscreen_Enter', 'AHP_CrossFrame_Fullscreen_Exit'].indexOf(e.data) == -1) return;
        let srcFrame = Array.from(document.querySelectorAll('iframe')).find(function (i) {
            return i.contentWindow == e.source;
        });
        if (srcFrame == undefined) return;
        if (e.data == 'AHP_CrossFrame_Fullscreen_Enter' && !webFullState) {
            webFullState = true;
            let origStat = {
                height: srcFrame.style.height || (srcFrame.offsetHeight + 'px'),
                width: srcFrame.style.width || (srcFrame.offsetWidth + 'px'),
                left: srcFrame.style.left,
                top: srcFrame.style.top,
                position: srcFrame.style.position,
                zIndex: srcFrame.style.zIndex
            };
            srcFrame.style.zIndex = 0xffffffff;
            srcFrame.style.height = '100%';
            srcFrame.style.width = '100%';
            srcFrame.style.position = 'fixed';
            srcFrame.style.left = '0';
            srcFrame.style.top = '0';
            srcFrame.YHP_origStat = origStat;
            let climb = srcFrame.parentNode;
            while (climb != document.body) {
                climb.YHP_origZIndex = climb.style.zIndex;
                climb.style.zIndex = 0xffffffff;
                climb = climb.parentNode;
            }
        } else if (e.data == 'AHP_CrossFrame_Fullscreen_Exit' && webFullState) {
            webFullState = false;
            let origStat = srcFrame.YHP_origStat;
            srcFrame.style.zIndex = origStat.zIndex;
            srcFrame.style.height = origStat.height;
            srcFrame.style.width = origStat.width;
            srcFrame.style.position = origStat.position;
            srcFrame.style.left = origStat.left;
            srcFrame.style.top = origStat.top;
            delete srcFrame.YHP_origStat;
            let climb = srcFrame.parentNode;
            while (climb != document.body) {
                if (climb.YHP_origZIndex != undefined)
                    climb.style.zIndex = climb.YHP_origZIndex;
                climb = climb.parentNode;
            }
        }
        if (parent != window)
            parent.postMessage(e.data, '*');
    });

    let tempEvent, tempEventType;
    function eventPasser() {
        switch (tempEventType) {
            case 'keydown':
                if (tempEvent.initKeyboardEvent) {
                    tempEvent.initKeyboardEvent('keydown', true, true, tempEvent.view, tempEvent.char, tempEvent.key, tempEvent.location, null, tempEvent.repeat);
                }
                break;
        }
        abpinst.playerUnit.dispatchEvent(tempEvent);
        tempEvent = null;
        tempEventType = '';
    }
    window.addEventListener('keydown', function (e) {
        if (typeof abpinst != 'undefined' && ['input', 'textarea'].indexOf(e.target.nodeName.toLowerCase()) == -1 && e.target.getAttribute('contenteditable') != 'true') {
            switch (e.keyCode) {
                case 32:
                case 37:
                case 39:
                case 38:
                case 40:
                    e.preventDefault();
                    e.stopPropagation();
                    tempEvent = e;
                    tempEventType = 'keydown';
                    setTimeout(eventPasser, 0);
                    break;
            }
        }
    });


})();