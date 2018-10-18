// ==UserScript==
// @name         himado.in 站点精简
// @namespace    https://github.com/
// @version      1.0.0
// @description  直接替换播放器，只有视频显示
// @author       zwj
// @supportURL   https://github.com/zwjhuhu/TMUserScripts/issues
// @compatible   chrome
// @license      MIT
// @match        http://himado.in/*
// @run-at       document-end
// ==/UserScript==

(function() {

    'use strict';
    if(!window.location.href.match(/.*[0-9]+/)){
        return;
    }


    if(unsafeWindow.ary_spare_sources.spare.length){
        let srcs = unsafeWindow.ary_spare_sources.spare;
        let selStr = srcs.reduce(function(ret,val,idx){
            ret += '<option value="'+idx +'">'+ val.src +'</option>';
            return ret;
        },'');

        let lastTime = null;
        const changeSrc = function(e){
            let i = e.target.value;
            if(videoElem.buffered.length){
                lastTime = videoElem.currentTime;
            }
            videoElem.src = srcs[i].src;
        }

        let selElem = document.createElement('select');
        selElem.innerHTML = selStr;
        selElem.onchange = changeSrc;
        selElem.style.display = 'inline-block';
        selElem.style.width = '1280px';
        selElem.style.height = '30px';


        let parent = document.body;
        let container = document.createElement('div');

        container.style.textAlign = 'center';
        container.style.width = '100%';
        container.style.height = '100%';

        let videoElem = document.createElement('video');
        videoElem.style.width = '1280px';
        videoElem.style.height = '720px';
        videoElem.controls = true;
        videoElem.oncanplay = function(){
            if(lastTime){
                videoElem.currentTime = lastTime;
                lastTime = null;
            }
        }
        container.appendChild(selElem);
        container.appendChild(videoElem);

        parent.innerHTML = '';
        parent.appendChild(container);
    }


})();