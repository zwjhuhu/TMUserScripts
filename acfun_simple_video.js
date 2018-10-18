// ==UserScript==
// @name         AcFun替换pc端网页flash
// @namespace    https://github.com/
// @version      1.0.0
// @description  把flash播放器的位置去掉，直接用video标签播放，无弹幕，只能看分段视频
// @author       zwj
// @supportURL   https://github.com/zwjhuhu/TMUserScripts/issues
// @compatible   chrome
// @license      MIT
// @match        http://*.acfun.cn/v/ac*
// @match        http://*.acfun.cn/bangumi/*
// @run-at       document-end
// ==/UserScript==

(function() {

    'use strict';

    var pageInfo = unsafeWindow.pageInfo;
    if(!pageInfo){
        return ;
    }

    //替换的容器
    var dest = document.getElementById('ACFlashPlayer');
    if(!dest){
        return ;
    }

    window.onload = function(){
        document.querySelector('.noflash-alert').remove();
    }

    // flash解密密钥
    var flash_key = '8bdc7e1a';
    // js解密密钥
    var js_key = 'm1uN9G6cKz0mooZM';
    //acfunc 视频地址解密函数
    function rc4(key, str) {
        var s = [], j = 0, x, res = '';
        for (var i = 0; i < 256; i++) {
            s[i] = i;
        }
        for (i = 0; i < 256; i++) {
            j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
            x = s[i];
            s[i] = s[j];
            s[j] = x;
        }
        i = 0;
        j = 0;
        for (var y = 0; y < str.length; y++) {
            i = (i + 1) % 256;
            j = (j + s[i]) % 256;
            x = s[i];
            s[i] = s[j];
            s[j] = x;
            res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
        }
        return res;
    }

    function formatTime(miliSec){
        let sec = Math.floor(miliSec/1000);
        let miliPart = miliSec%1000;
        let min = Math.floor(sec/60);
        sec = sec - 60*min;
        return min+':'+sec + (miliPart?('.'+miliPart):'');
    }

    var knownTypes = {
        'mp4sd': 'flvhd',
        'flvhd': 'flvhd',
        'mp4hd': 'mp4hd',
        'mp4hd2': 'mp4hd2',
        'mp4hd2v2':'mp4hd2',
        'mp4hd3': 'mp4hd3',
        'mp4hd3v2': 'mp4hd3'
    };

    if (document.getElementById('pageInfo') != null) {
        pageInfo.vid = pageInfo.videoId;
    } else {
        pageInfo.vid = pageInfo.video.videos[0].danmakuId;
        pageInfo.coverImage = pageInfo.video.videos[0].image;
        pageInfo.title = pageInfo.album.title + ' ' + pageInfo.video.videos[0].episodeName;
    }

    //获取和视频有关的sourceId和sourceType
    fetch('http://www.acfun.cn/video/getVideo.aspx?id=' + pageInfo.vid, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-cache'
    }).then(function (r) {
        r.json().then(function (data) {
            if (data.success) {
                pageInfo.sourceId = data.sourceId;
                pageInfo.sourceType = data.sourceType;
                //console.log('Got sourceType:', data.sourceType, 'vid:', data.sourceId, data);
                let backupSina;
                // 提取sourceUrl新浪源
                if (['zhuzhan', 'sina', 'youku', 'youku2'].indexOf(data.sourceType) == -1 && (backupSina = (data.sourceUrl || '').match(/video\.sina\.com\.cn\/v\/b\/(\d+)-/))) {
                    pageInfo.sourceType = 'sina';
                    pageInfo.sourceId = backupSina[1];
                    console.log('Using backup sina vid: ' + pageInfo.sourceId);
                }
                sourceTypeRoute(data);
            } else {
                console.log('err response: ',data)
            }
        });
    }).catch(function (e) {
        console.log('request video info err: ',e)
    });


    //使用的视频地址接口类型 js falsh 请求参数和解密的key不同
    var apiType = 'flash';

    function fetchVideoInfos(){
        //http://player.acfun.cn/js_data?vid=5a2a73b80cf2bc924c15f92f&ct=86&ev=4&cid=908a519d032263f8&sign=2_1538544640_7a0b5e05c7a66902674b4987ddfdce93&callback=jsonp_callback_45832&cb=jsonp_callback_45832
        let jsonFuncName = 'jsonp_callback_'+Math.round(Math.random()*100000);
        unsafeWindow[jsonFuncName] = fetchSrcInfos;
        let st = document.createElement('script');
        st.type='text/javascript';
        let partParam = apiType === 'js'?'&ct=86&ev=4':'&ct=85&ev=3';
        st.src = 'http://player.acfun.cn/' +apiType+ '_data?vid=' + pageInfo.sourceId + partParam+'&sign=' + pageInfo.sign + '&time=' + Date.now()+'&callback='+jsonFuncName+'&cb='+jsonFuncName;
        document.body.appendChild(st);
    }

    function sourceTypeRoute(data) {
        switch (pageInfo.sourceType) {
            case 'zhuzhan':
                //Ac - 优酷云
                pageInfo.sign = data.encode;
                fetchVideoInfos();
                break;
            default:
                console.log('not surpport sourceType:',pageInfo.sourceType);
                return;
        }
    }

    function fetchSrcInfos(data) {
        if (data.e && data.e.code !== 0) {
            return fetchSrcThen({ error: data.e });
        }
        let decrypted = data.data;
        if(data.encrypt==='1'){
            decrypted = JSON.parse(rc4(apiType==='flash'?flash_key:js_key, atob(data.data)));
        }
        console.log(apiType+':---',decrypted);
        fetchSrcThen(decrypted);
    }

    function fetchSrcThen(json) {

        if (json.error) {
            /*
        处理错误
        -2002 需要密码
        -2003 密码错误
        */
            let error = json.error;
            console.log(error);
            return;
        } else {
            response2url(json);
        }
        switchLang(currentLang);
        changeSrc('',currentSrc,true);
    }

    var audioLangs = [];
    var currentSrc = 'mp4hd2';
    var currentLang = '';
    var currentSegIndex = null;

    function response2url(json) {
        let data = {};

        for (let val of json.stream) {
            if (!data[val.audio_lang]){
                data[val.audio_lang] = {};
            }

            if (!val.channel_type){
                data[val.audio_lang][val.stream_type] = val;
            }

            //片尾、片头独立片段暂时丢弃
        }

        audioLangs.length = 0;
        for (let lang in data) {
            audioLangs[lang] = {
                src: {},
                available: []
            };
            audioLangs.length++;
            if (currentLang == ''){
                currentLang = lang;
            }

            if (data[lang].mp4hd3v2){
                delete data[lang].mp4hd3;
            }
            if (data[lang].mp4hd2v2){
                delete data[lang].mp4hd2;
            }
            if (data[lang].mp4sd){
                delete data[lang].flvhd;
            }

            for (let type in knownTypes) {
                if (data[lang][type]) {
                    let time = 0;
                    let size = 0;
                    let lastms = 0;
                    audioLangs[lang].src[type] = {
                        type: 'flv',
                        segments: [],
                        fetchM3U8: false,
                        withCredentials: true,
                        width:data[lang][type].width,
                        height:data[lang][type].height
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
                            withCredentials: true,
                            lastms:time
                        };
                        if (part.cdn_backup && part.cdn_backup.length) {
                            seg.backup_url = part.cdn_backup;
                        }
                        audioLangs[lang].src[type].segments.push(seg);
                        time += part.total_milliseconds_video | 0;
                        size += part.size | 0;
                    }
                    audioLangs[lang].src[type].duration = time;
                    audioLangs[lang].src[type].size = size;
                    audioLangs[lang].src.duration = time;
                }
            }

            let selected;

            for (let type in knownTypes) {
                if (audioLangs[lang].src[type]) {
                    selected = [type, knownTypes[type]];
                    audioLangs[lang].available.push(selected);
                    if(!audioLangs[lang].src[currentSrc]){
                        currentSrc = type;
                    }
                }
            }

        }
    }

    var srcUrl;
    var availableSrc;
    var selPartElem = null;
    var flvplayer;
    var videoElem = null;
    var quaSelElem = null;
    var segSelElem = null;
    var partCurTime = 0;//毫秒
    var currrentSegIdx = 0;

    function switchLang(lang) {
        srcUrl = audioLangs[lang].src;
        availableSrc = audioLangs[lang].available;

        if(!selPartElem){
            selPartElem = document.createElement('div');
            selPartElem.style.width='100%';
            selPartElem.style.border='0px';
            selPartElem.style.padding='0px 20px';
            selPartElem.style.height='30px';
            dest.appendChild(selPartElem);
        }
        if(!quaSelElem){
            quaSelElem = document.createElement('select');
            quaSelElem.id='testqua';
            quaSelElem.style.display='inline-block';
            quaSelElem.style.width='300px';
            quaSelElem.onchange = function(e){
                let val = e.target.value;
                typeChange(val);
            };
            selPartElem.appendChild(quaSelElem);

        }else{
            quaSelElem.innerHTML = '';
        }

        let quaSelText = '';
        let type,typeText;
        for (let i = 0; i < availableSrc.length; i++) {
            type = availableSrc[i][0];
            typeText = type+' ( '+srcUrl[type].width+'x'+srcUrl[type].height+' ) '+Math.round(srcUrl[type].size/1000000)+'m';
            quaSelText+='<option value="'+type+'"'+(type===currentSrc?'selected':'')+'>'+typeText+'</option>';
        }
        quaSelElem.innerHTML = quaSelText;
        if(segSelElem){
            segSelElem.innerHTML = '';
        }
    }

    function typeChange(val){
        changeSrc('',val);
    }


    function changeSrc(e, t, force) {

        if (currentSrc == t&& !force){
            return;
        }
        if(!srcUrl[t]){
            return;
        }

        let lastSegs = srcUrl[currentSrc].segments;
        currentSrc = t;
        partCurTime = videoElem?Math.floor(videoElem.currentTime*1000):0;

        if(!segSelElem){
            segSelElem = document.createElement('select');
            segSelElem.id='testseg';
            segSelElem.style.display='inline-block';
            segSelElem.style.width='300px';
            selPartElem.appendChild(segSelElem);
            segSelElem.onchange = function(e){
                let index = e.target.value;
                partCurTime = 0;
                changeSeg(srcUrl[t].segments,index);
            };
        }else{
            segSelElem.innerHTML = '';
        }

        let segSelText = '',segs = srcUrl[t].segments;
        let segText = null;
        let lastms = lastSegs[currrentSegIdx].lastms;
        let playedTime = lastms + partCurTime;

        for(let i=0;i<segs.length;i++){
            if(playedTime-segs[i].lastms<segs[i].duration){
                partCurTime = playedTime-segs[i].lastms;
                currrentSegIdx = i;
                break;
            }
        }

        for (let i = 0; i < segs.length; i++) {
            segText = formatTime(segs[i].lastms)+' - '+formatTime(segs[i].lastms+segs[i].duration);
            segSelText+='<option value="'+i+'"'+(i===currrentSegIdx?'selected':'')+'>'+segText+'</option>';
        }
        segSelElem.innerHTML = segSelText;
        changeSeg(segs,currrentSegIdx);

    };

    function changeSeg(segs,index){
        let seg = segs[index];
        if(!seg||!seg.url){
            return;
        }
        if(!videoElem){
            videoElem = document.createElement('video');
            videoElem.id='myvideo';
            videoElem.poster = pageInfo.coverImage;
            videoElem.controls = true;
            videoElem.style.width='100%';
            videoElem.style.height='720px';
            videoElem.style.border='0px';
            dest.prepend(videoElem);
            dest.style.height='770px';
            dest.parentNode.style.height='770px';
            videoElem.src = seg.url;
            videoElem.onended = function(){
                if(currrentSegIdx<segs.length){
                    segSelElem.value = currrentSegIdx+1;
                    partCurTime = 0;
                    changeSeg(segs,currrentSegIdx+1);
                }
            }
        }else{
            videoElem.pause();
            videoElem.src = seg.url;
            videoElem.currentTime = partCurTime/1000;
            videoElem.play();
        }
        currrentSegIdx = index;
    }

    function load_fail(type, info, detail) {
        console.log(JSON.stringify({ type, info, detail }));
    }

    function reloadSegment() {
        let io = this._transmuxer._controller._ioctl;
        clearInterval(this._progressChecker);
        this._progressChecker = null;
        io.pause();
        io.resume();
        this._transmuxer._controller._enableStatisticsReporter();
    }

})();