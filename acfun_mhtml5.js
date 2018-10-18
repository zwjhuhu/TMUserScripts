// ==UserScript==
// @name         AcFun HTML5播放器
// @namespace    https://github.com/
// @version      1.0.0
// @description  使用acfun移动端的页面播放
// @author       zwj
// @supportURL   https://github.com/zwjhuhu/TMUserScripts/issues
// @compatible   chrome
// @license      MIT
// @match        http://www.acfun.cn/*
// @match        http://m.acfun.cn/ykplayer*
// @run-at       document-end
// ==/UserScript==

(function() {

    'use strict';

    var get_url = function(){
        var page_info = document.getElementById('pageInfo');
        var vid, pic;
        var jsPageInfo = unsafeWindow.pageInfo;
        if(jsPageInfo&&page_info===null){
            vid = jsPageInfo.video.videos[0].videoId;
            pic = jsPageInfo.album.coverImageV;
        }else{
            if(page_info===null){
                vid = document.getElementsByClassName('btn active')[0].getAttribute('data-vid');
            }else{
                pic = page_info.getAttribute('data-pic');
                vid = page_info.getAttribute('data-vid');
            }
        }

        var url = 'http://m.acfun.cn/ykplayer?date='+new Date().getTime()+'#vid='+ vid;
        if(pic!==undefined)
            url += ';cover=' + pic;
        return url;
    };

    var replace_player = function(player_div, min_height){
        var url = get_url();

        //console.log(url)
        var ifr = document.createElement('iframe');
        ifr.src = url;
        ifr.id = 'm_ifr';
        ifr.style.width = '100%';
        ifr.style.minHeight = min_height;
        ifr.style.overflow = 'hidden';
        ifr.setAttribute('allowFullScreen', 'true');
        ifr.scrolling = 'no';
        ifr.setAttribute('seamless', 'seamless');

        player_div.appendChild(ifr);
    };


    // 设置这个值来解决跨域不能加载脚本的问题。HTML5 播放器页面是 m.acfun.cn，PC是 www.acfun.cn
    document.domain = 'acfun.cn';

    var path_name = window.location.pathname;
    if(window.location.hostname==='m.acfun.cn'){
        //hack
        unsafeWindow.weblog=function(){};
    }
    else if(path_name.startsWith('/v/ac')||path_name.startsWith('/bangumi')){


        window.onload = function(){

            var player_div, min_height;
            if(path_name.startsWith('/bangumi')||path_name[4]=='c'){
                // url 是 www.acfun.cn/v/acXXXXXXX 番剧是/bangumi/abXXXXXXX
                player_div = document.getElementById('player');
                min_height = $('#player').height() + 'px';
                //player_div.getElementsByTagName('object')[0].remove();
            }else if(path_name[4]=='b'){
                // url 是 www.acfun.cn/v/abXXXXXXX 时
                player_div = document.getElementsByClassName('inner ui-draggable')[0];
                min_height = $('#area-player').height() + 'px';
                //document.getElementById('ACFlashPlayer-re').remove();
            }
            player_div.innerHTML='';

            replace_player(player_div, min_height);

            var m_ifr = document.getElementById('m_ifr');
            m_ifr.onload = function(){
                var full_btn = m_ifr.contentDocument.getElementsByClassName('controller-btn-fullscreen');
                $(full_btn).on('click', function(){
                    if($(full_btn).children().attr('class')==="controller-icon-fullscreen"){
                        if (m_ifr.requestFullscreen) {
                            m_ifr.requestFullscreen();
                        } else if (m_ifr.mozRequestFullScreen) {
                            m_ifr.mozRequestFullScreen();
                        } else if (m_ifr.webkitRequestFullscreen) {
                            m_ifr.webkitRequestFullscreen();
                        }
                        $(full_btn).children().attr('class', 'controller-icon-fullscreen-close');
                    }else{
                        if (document.cancelFullScreen) {
                            document.cancelFullscreen();
                        } else if (document.mozCancelFullScreen) {
                            document.mozCancelFullScreen();
                        } else if (document.webkitCancelFullScreen) {
                            document.webkitCancelFullScreen();
                        }
                        $(full_btn).children().attr('class', 'controller-icon-fullscreen');
                    }
                });
            };

        };
    }
})();