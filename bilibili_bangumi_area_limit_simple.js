// ==UserScript==
// @name         B站区域限制极简
// @namespace    https://github.com/
// @version      1.0.0
// @description  只播放视频,其他功能完全不用;
// @author       zwj
// @supportURL   https://github.com/zwjhuhu/TMUserScripts/issues
// @compatible   chrome
// @license      MIT
// @require      https://raw.githubusercontent.com/zwjhuhu/bilibili-playurl/simple/dist/biliplayurl.js
// @require      https://cdn.bootcss.com/flv.js/1.4.2/flv.min.js
// @include      *://www.bilibili.com/video/av*
// @include      *://www.bilibili.com/bangumi/play/ep*
// @include      *://www.bilibili.com/bangumi/play/ss*
// @run-at       document-start
// @grant        none
// ==/UserScript==
//
// script from https://github.com/ipcjs/bilibili-helper is good enough but give a very simple version for self use

'use strict';

function scriptSource(invokeBy) {
    'use strict';

    const util_log_impl = (type) => window.console[type].bind(window.console, type + ':');
    const util_log = util_log_impl('log');
    const util_debug = util_log_impl('debug');
    const util_error = util_log_impl('error');
    const log = util_log;

    // 保存原始的localStorage防止被页面上的脚本修改
    const mystorage = window.localStorage;

    // 禁止log-report追踪, 只有在不限制的时候打开
    const navigator_sendBeacon = window.navigator.sendBeacon;
    window.navigator.sendBeacon = function() {};

    const _config = {
        server: {
            S0: 'https://biliplus.ipcjs.win',
            S1: 'https://www.biliplus.com',
            defaultServer: function() {
                return this.S0;
            }
        },
        script: {
            is_dev: false
        }
    };

    const r = _config;

    const util_func_noop = function() {}
    const util_func_catched = function(func, onError) {
        let ret = function() {
            try {
                return func.apply(this, arguments)
            } catch (e) {
                if (onError) return onError(e) // onError可以处理报错时的返回值
                // 否则打印log, 并返回undefined
                util_error('Exception while run %o: %o\n%o', func, e, e.stack)
                return undefined
            }
        }
        // 函数的name属性是不可写+可配置的, 故需要如下代码实现类似这样的效果: ret.name = func.name
        // 在Edge上匿名函数的name的描述符会为undefined, 需要做特殊处理, fuck
        let funcNameDescriptor = Object.getOwnPropertyDescriptor(func, 'name') || {
            value: '',
            writable: false,
            configurable: true,
        }
        Object.defineProperty(ret, 'name', funcNameDescriptor)
        return ret
    }

    const util_init = (function() {
        const RUN_AT = {
            DOM_LOADED: 0,
            DOM_LOADED_AFTER: 1,
            COMPLETE: 2,
        }
        const PRIORITY = {
            FIRST: 1e6,
            HIGH: 1e5,
            BEFORE: 1e3,
            DEFAULT: 0,
            AFTER: -1e3,
            LOW: -1e5,
            LAST: -1e6,
        }
        const callbacks = {
            [RUN_AT.DOM_LOADED]: [],
            [RUN_AT.DOM_LOADED_AFTER]: [],
            [RUN_AT.COMPLETE]: [],
        }
        const util_page_valid = () => true // 是否要运行
        const dclCreator = function(runAt) {
            let dcl = function() {
                util_init.atRun = runAt // 更新运行状态
                const valid = util_page_valid()
                // 优先级从大到小, index从小到大, 排序
                callbacks[runAt].sort((a, b) => b.priority - a.priority || a.index - b.index)
                    .filter(item => valid || item.always)
                    .forEach(item => item.func(valid))
            }
            return dcl
        }

        if (window.document.readyState !== 'loading') {
            throw new Error('unit_init must run at loading, current is ' + document.readyState)
        }

        window.document.addEventListener('DOMContentLoaded', dclCreator(RUN_AT.DOM_LOADED))
        window.addEventListener('DOMContentLoaded', dclCreator(RUN_AT.DOM_LOADED_AFTER))
        window.addEventListener('load', dclCreator(RUN_AT.COMPLETE))

        const util_init = function(func, priority = PRIORITY.DEFAULT, runAt = RUN_AT.DOM_LOADED, always = false) {
            func = util_func_catched(func)
            if (util_init.atRun < runAt) { // 若还没运行到runAt指定的状态, 则放到队列里去
                callbacks[runAt].push({
                    priority,
                    index: callbacks[runAt].length, // 使用callback数组的长度, 作为添加元素的index属性
                    func,
                    always
                })
            } else { // 否则直接运行
                let valid = util_page_valid()
                setTimeout(() => (valid || always) && func(valid), 1)
            }
            return func
        }
        util_init.atRun = -1 // 用来表示当前运行到什么状态
        util_init.RUN_AT = RUN_AT
        util_init.PRIORITY = PRIORITY
        return util_init
    }());

    //使用locaStorage存储,同时给个加密,很难简单就是异或一把
    const util_storage = (function() {

        const xorKey = 'zwj';
        const allKey = 'tmarea';
        const enAllKey = encrypt(allKey);

        function encrypt(val) {
            if (!val) {
                return;
            }
            let str = val;
            while (str.length % xorKey.length) {
                str += ' ';
            }
            let ret = '',
                tmp;
            for (let i = 0, len = str.length, step = xorKey.length; i < len; i += step) {
                for (let j = 0; j < step; j++) {
                    tmp = (str[i + j].codePointAt(0) ^ xorKey[j].codePointAt(0)).toString(16);
                    while (tmp.length != 4) {
                        tmp = '0' + tmp;
                    }
                    ret += tmp;
                }
            }
            return ret;
        }

        function decrypt(val) {
            if (!val) {
                return;
            }
            let str = val;
            let ret = '';
            for (let i = 0, len = str.length, step = xorKey.length, j = 0; i < len; i += 4) {
                ret += String.fromCodePoint(parseInt(str.substring(i, i + 4), 16) ^ xorKey[j++].codePointAt(0));
                if (j == step) {
                    j = 0;
                }
            }
            return ret.trim();
        }

        function getValues() {
            let str = decrypt(mystorage.getItem(enAllKey));
            if (!str) {
                return {};
            }

            return JSON.parse(str);
        }

        function getValue(key) {
            return getValues()[key];
        }

        function setValue(key, value) {
            if (!key) {
                return;
            }
            if (!value) {
                removeValue(key);
            } else {
                let saved = getValues();
                saved[key] = value;
                mystorage.setItem(enAllKey, encrypt(JSON.stringify(saved)));
            }

        }

        function removeValue(key) {
            let saved = getValues();
            if (saved[key]) {
                delete saved[key];
                mystorage.setItem(enAllKey, encrypt(JSON.stringify(saved)));
            }
        }

        function removeAll() {
            mystorage.removeItem(enAllKey);
        }

        return new Proxy({ set: setValue, get: getValue, all: getValues, remove: removeValue, clear: removeAll }, {
            get: function(target, prop) {
                if (prop in target) return target[prop];
                return getValue(prop);
            },
            set: function(target, prop, value) {
                setValue(prop, value);
                return true;
            }
        })
    }());

    const balh_config = (function() {
        let saved = util_storage.balh_config;
        if(!saved) {
            saved = {
                server: r.server.defaultServer(),
                blocked_vip: false,
                enable_in_av: true
            };
            util_storage.balh_config = saved;
        }
        return saved;
    }());


    const Promise = window.Promise // 在某些情况下, 页面中会修改window.Promise... 故我们要备份一下原始的Promise
    const util_promise_plus = (function() {
        /**
         * 模仿RxJava中的compose操作符
         * @param transformer 转换函数, 传入Promise, 返回Promise; 若为空, 则啥也不做
         */
        Promise.prototype.compose = function(transformer) {
            return transformer ? transformer(this) : this
        }
    }());

    const util_promise_timeout = function(timeout) {
        return new Promise((resolve, reject) => {
            setTimeout(resolve, timeout);
        })
    };

    // 直到满足condition()为止, 才执行promiseCreator(), 创建Promise
    // https://stackoverflow.com/questions/40328932/javascript-es6-promise-for-loop
    const util_promise_condition = function(condition, promiseCreator, retryCount = Number.MAX_VALUE, interval = 1) {
        const loop = (time) => {
            if (!condition()) {
                if (time < retryCount) {
                    return util_promise_timeout(interval).then(loop.bind(null, time + 1))
                } else {
                    return Promise.reject(`util_promise_condition timeout, condition: ${condition.toString()}`)
                }
            } else {
                return promiseCreator()
            }
        }
        return loop(0)
    };

    let originalAjax = null;
    const util_ajax = function(options) {
        let ajaxFunc = originalAjax;
        if (!ajaxFunc) {
            ajaxFunc = $.ajax;
        }
        const creator = () => new Promise(function(resolve, reject) {
            typeof options !== 'object' && (options = { url: options });

            options.async === undefined && (options.async = true);
            options.xhrFields === undefined && (options.xhrFields = { withCredentials: false });
            options.success = function(data) {
                resolve(data);
            };
            options.error = function(err) {
                reject(err);
            };
            util_debug('ajax:', options.url)
            ajaxFunc(options);
        });
        return util_promise_condition(() => window.$, creator, 100, 100) // 重试 100 * 100 = 10s
    };
    /**
     * @param promiseCeator  创建Promise的函数
     * @param resultTranformer 用于变换result的函数, 返回新的result或Promise
     * @param errorTranformer  用于变换error的函数, 返回新的error或Promise, 返回的Promise可以做状态恢复...
     */
    const util_async_wrapper = function(promiseCeator, resultTranformer, errorTranformer) {
        return function(...args) {
            return new Promise((resolve, reject) => {
                // log(promiseCeator, ...args)
                promiseCeator(...args)
                    .then(r => resultTranformer ? resultTranformer(r) : r)
                    .then(r => resolve(r))
                    .catch(e => {
                    e = errorTranformer ? errorTranformer(e) : e
                    if (!(e instanceof Promise)) {
                        // 若返回值不是Promise, 则表示是一个error
                        e = Promise.reject(e)
                    }
                    e.then(r => resolve(r)).catch(e => reject(e))
                })
            })
        }
    };
    /**
     * 创建元素的快捷方法:
     * 1. type, props, children
     * 2. type, props, innerHTML
     * 3. 'text', text
     * @param type string, 标签名; 特殊的, 若为text, 则表示创建文字, 对应的t为文字的内容
     * @param props object, 属性; 特殊的属性名有: className, 类名; style, 样式, 值为(样式名, 值)形式的object; event, 值为(事件名, 监听函数)形式的object;
     * @param children array, 子元素; 也可以直接是html文本;
     */
    const util_ui_element_creator = (type, props, children) => {
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
            if (typeof children === 'string') {
                elem.innerHTML = children;
            } else {
                for (let i = 0; i < children.length; i++) {
                    if (children[i] != null)
                        elem.appendChild(children[i]);
                }
            }
        }
        return elem;
    }
    const _ = util_ui_element_creator;


    const util_jsonp = function(url, callback) {
        return new Promise((resolve, reject) => {
            document.head.appendChild(_('script', {
                src: url,
                event: {
                    load: function() {
                        resolve()
                    },
                    error: function() {
                        reject()
                    }
                }
            }));
        })
    }

    const util_xml2obj = (xml) => {
        try {
            var obj = {},
                text;
            var children = xml.children;
            if (children.length > 0) {
                for (var i = 0; i < children.length; i++) {
                    var item = children.item(i);
                    var nodeName = item.nodeName;

                    if (typeof(obj[nodeName]) == "undefined") { // 若是新的属性, 则往obj中添加
                        obj[nodeName] = util_xml2obj(item);
                    } else {
                        if (typeof(obj[nodeName].push) == "undefined") { // 若老的属性没有push方法, 则把属性改成Array
                            var old = obj[nodeName];

                            obj[nodeName] = [];
                            obj[nodeName].push(old);
                        }
                        obj[nodeName].push(util_xml2obj(item));
                    }
                }
            } else {
                text = xml.textContent;
                if (/^\d+(\.\d+)?$/.test(text)) {
                    obj = Number(text);
                } else if (text === 'true' || text === 'false') {
                    obj = Boolean(text);
                } else {
                    obj = text;
                }
            }
            return obj;
        } catch (e) {
            util_error(e);
        }
    }

    const util_ui_alert = function(message, resolve, reject) {
        setTimeout(() => {
            if (resolve) {
                if (window.confirm(message)) {
                    resolve()
                } else {
                    if (reject) {
                        reject()
                    }
                }
            } else {
                alert(message)
            }
        }, 500)
    }

    /**
     * - param.content: 内容元素数组/HTML
     * - param.showConfirm: 是否显示确定按钮
     * - param.confirmBtn: 确定按钮的文字
     * - param.onConfirm: 确定回调
     * - param.onClose: 关闭回调
     */
    const util_ui_pop = function(param) {
        if (typeof param.content === 'string') {
            let template = _('template');
            template.innerHTML = param.content.trim()
            param.content = Array.from(template.content.childNodes)
        } else if (!(param.content instanceof Array)) {
            util_log(`param.content(${param.content}) 不是数组`)
            return;
        }

        if (document.getElementById('AHP_Notice_style') == null) {
            let noticeWidth = Math.min(500, innerWidth - 40);
            document.head.appendChild(_('style', { id: 'AHP_Notice_style' }, [_('text', `#AHP_Notice{ line-height:normal;position:fixed;left:0;right:0;top:0;height:0;z-index:20000;transition:.5s;cursor:default } .AHP_down_banner{ margin:2px;padding:2px;color:#FFFFFF;font-size:13px;font-weight:bold;background-color:green } .AHP_down_btn{ margin:2px;padding:4px;color:#1E90FF;font-size:14px;font-weight:bold;border:#1E90FF 2px solid;display:inline-block;border-radius:5px } body.ABP-FullScreen{ overflow:hidden } @keyframes pop-iframe-in{0%{opacity:0;transform:scale(.7);}100%{opacity:1;transform:scale(1)}} @keyframes pop-iframe-out{0%{opacity:1;transform:scale(1);}100%{opacity:0;transform:scale(.7)}} #AHP_Notice>div{ position:absolute;bottom:0;left:0;right:0;font-size:15px } #AHP_Notice>div>div{ border:1px #AAA solid;width:${noticeWidth}px;margin:0 auto;padding:20px 10px 5px;background:#EFEFF4;color:#000;border-radius:5px;box-shadow:0 0 5px -2px } #AHP_Notice>div>div *{ margin:5px 0; } #AHP_Notice input[type=text]{ border: none;border-bottom: 1px solid #AAA;width: 60%;background: transparent } #AHP_Notice input[type=text]:active{ border-bottom-color:#4285f4 } #AHP_Notice input[type=button] { border-radius: 2px; border: #adadad 1px solid; padding: 3px; margin: 0 5px; min-width:50px } #AHP_Notice input[type=button]:hover { background: #FFF; } #AHP_Notice input[type=button]:active { background: #CCC; } .noflash-alert{display:none}`)]));
        }

        if (document.querySelector('#AHP_Notice') != null)
            document.querySelector('#AHP_Notice').remove();

        let div = _('div', { id: 'AHP_Notice' });
        let childs = [];
        if (param.showConfirm || param.confirmBtn || param.onConfirm) {
            childs.push(_('input', { value: param.confirmBtn || _t('ok'), type: 'button', className: 'confirm', event: { click: param.onConfirm } }));
        }
        childs.push(_('input', {
            value: _t('close'),
            type: 'button',
            className: 'close',
            event: {
                click: function() {
                    param.onClose && param.onClose();
                    div.style.height = 0;
                    setTimeout(function() { div.remove(); }, 500);
                }
            }
        }));
        div.appendChild(_('div', {}, [_('div', {},
                                        param.content.concat([_('hr'), _('div', { style: { textAlign: 'right' } }, childs)])
                                       )]));
        document.body.appendChild(div);
        div.style.height = div.firstChild.offsetHeight + 'px';
    };

    const util_url_param = function(url, key) {
        return (url.match(new RegExp('[?|&]' + key + '=(\\w+)')) || ['', ''])[1];
    };

    const util_page = {
        av: () => location.href.includes('www.bilibili.com/video/av'),
        bangumi: () => location.href.match(new RegExp('^https?://bangumi\\.bilibili\\.com/anime/\\d+/?$')),
        // movie页面使用window.aid, 保存当前页面av号
        movie: () => location.href.includes('bangumi.bilibili.com/movie/'),
        // anime页面使用window.season_id, 保存当前页面season号
        anime: () => location.href.match(new RegExp('^https?://bangumi\\.bilibili\\.com/anime/\\d+/play.*')),
        anime_ep: () => location.href.includes('www.bilibili.com/bangumi/play/ep'),
        anime_ss: () => location.href.includes('www.bilibili.com/bangumi/play/ss')
    };

    const balh_api_plus_view = function(aid, update = true) {
        return util_ajax(`${balh_config.server}/api/view?id=${aid}&update=${update}`)
    };
    const balh_api_plus_season = function(season_id) {
        return util_ajax(`${balh_config.server}/api/bangumi?season=${season_id}`)
    };
    // https://www.biliplus.com/BPplayurl.php?otype=json&cid=30188339&module=bangumi&qn=16&src=vupload&vid=vupload_30188339
    // qn = 16, 能看
    const balh_api_plus_playurl = function(cid, qn = 16, bangumi = true) {
        return util_ajax(`${balh_config.server}/BPplayurl.php?otype=json&cid=${cid}${bangumi ? '&module=bangumi' : ''}&qn=${qn}&src=vupload&vid=vupload_${cid}`)
    };
    // https://www.biliplus.com/api/h5play.php?tid=33&cid=31166258&type=vupload&vid=vupload_31166258&bangumi=1
    const balh_api_plus_playurl_for_mp4 = (cid, bangumi = true) => util_ajax(`${balh_config.server}/api/h5play.php?tid=33&cid=${cid}&type=vupload&vid=vupload_${cid}&bangumi=${bangumi ? 1 : 0}`)
    .then(text => (text.match(/srcUrl=\{"mp4":"(https?.*)"\};/) || ['', ''])[1]); // 提取mp4的url

    const balh_feature_area_limit = (function() {
        function injectXHR() {
            util_debug('XMLHttpRequest的描述符:', Object.getOwnPropertyDescriptor(window, 'XMLHttpRequest'))
            let firstCreateXHR = true
            window.XMLHttpRequest = new Proxy(window.XMLHttpRequest, {
                construct: function(target, args) {
                    // 第一次创建XHR时, 打上断点...
                    if (firstCreateXHR && r.script.is_dev) {
                        firstCreateXHR = false
                        // debugger
                    }
                    let container = {} // 用来替换responseText等变量
                    return new Proxy(new target(...args), {
                        set: function(target, prop, value, receiver) {
                            if (prop === 'onreadystatechange') {
                                container.__onreadystatechange = value
                                let cb = value
                                value = function(event) {
                                    if (target.readyState === 4) {
                                        if (target.responseURL.includes('bangumi.bilibili.com/view/web_api/season/user/status')) {
                                            log('/season/user/status:', target.responseText)
                                            let json = JSON.parse(target.responseText)
                                            let rewriteResult = false
                                            if (json.code === 0 && json.result) {
                                                areaLimit(json.result.area_limit !== 0)
                                                if (json.result.area_limit !== 0) {
                                                    json.result.area_limit = 0 // 取消区域限制
                                                    //rewriteResult = true
                                                }
                                                if (balh_config.blocked_vip) {
                                                    json.result.pay = 1
                                                    //rewriteResult = true
                                                }
                                                if (rewriteResult) {
                                                    container.responseText = JSON.stringify(json)
                                                }
                                            }
                                        } else if (target.responseURL.includes('bangumi.bilibili.com/web_api/season_area')) {
                                            log('/season_area', target.responseText)
                                            let json = JSON.parse(target.responseText)
                                            if (json.code === 0 && json.result) {
                                                areaLimit(json.result.play === 0)
                                                if (json.result.play === 0) {
                                                    json.result.play = 1
                                                    container.responseText = JSON.stringify(json)
                                                }
                                            }
                                        } else if (target.responseURL.includes('api.bilibili.com/x/web-interface/nav')) {
                                            let json = JSON.parse(target.responseText)
                                            log('/x/web-interface/nav', (json.data && json.data.isLogin) ? { uname: json.data.uname, isLogin: json.data.isLogin, level: json.data.level_info.current_level, vipType: json.data.vipType, vipStatus: json.data.vipStatus } :
                                                target.responseText)
                                            /*if (json.code === 0 && json.data && balh_config.blocked_vip) {
                                                json.data.vipType = 2; // 类型, 年度大会员
                                                json.data.vipStatus = 1; // 状态, 启用
                                                container.responseText = JSON.stringify(json)
                                            }*/
                                        } else if (target.responseURL.includes('api.bilibili.com/x/player/playurl')) {
                                            util_log('/x/player/playurl', 'origin', `block: ${container.__block_response}`, target.response)
                                            // todo      : 当前只实现了r.const.mode.REPLACE, 需要支持其他模式
                                            // 2018-10-14: 等B站全面启用新版再说(;¬_¬)

                                        }
                                        if (container.__block_response) {
                                            // 屏蔽并保存response
                                            container.__response = target.response
                                            return
                                        }
                                    }
                                    // 这里的this是原始的xhr, 在container.responseText设置了值时需要替换成代理对象
                                    cb.apply(container.responseText ? receiver : this, arguments)
                                }
                            }
                            target[prop] = value
                            return true
                        },
                        get: function(target, prop, receiver) {
                            if (prop in container) return container[prop]
                            let value = target[prop]
                            if (typeof value === 'function') {
                                let func = value
                                // open等方法, 必须在原始的xhr对象上才能调用...
                                value = function() {
                                    if (prop === 'open') {
                                        container.__method = arguments[0]
                                        container.__url = arguments[1]
                                    } else if (prop === 'send') {
                                        let dispatchResultTransformerCreator = () => {
                                            container.__block_response = true
                                            let event = {} // 伪装的event
                                            debugger
                                            return p => p
                                                .then(r => {
                                                container.readyState = 4
                                                container.response = r
                                                container.__onreadystatechange(evnet) // 直接调用会不会存在this指向错误的问题? => 目前没看到, 先这样(;¬_¬)
                                            })
                                                .catch(e => {
                                                // 失败时, 让原始的response可以交付
                                                container.__block_response = false
                                                if (container.__response != null) {
                                                    container.readyState = 4
                                                    container.response = container.__response
                                                    container.__onreadystatechange(event) // 同上
                                                }
                                            })
                                        }
                                        if (container.__url.includes('api.bilibili.com/x/player/playurl') && balh_config.enable_in_av) {
                                            log('/x/player/playurl')
                                            // debugger
                                            /*bilibiliApis._playurl.asyncAjax(container.__url)
                                                .then(data => {
                                                    if (!data.code) {
                                                        data = {
                                                            code: 0,
                                                            data: data,
                                                            message: "0",
                                                            ttl: 1
                                                        }
                                                    }
                                                    util_log('/x/player/playurl', 'proxy', data)
                                                    return data
                                                })
                                                .compose(dispatchResultTransformerCreator())*/
                                        } else if ((container.__url.includes('data.bilibili.com') ||
                                                    container.__url.includes('dataflow.biliapi.com')
                                                   ) &&
                                                   isAreaLimitSeason()) {
                                            // 禁止log-report追踪
                                            return;
                                        }
                                    }
                                    return func.apply(target, arguments)
                                }
                            }
                            return value
                        }
                    })
                }
            })
        }

        function injectAjax() {
            originalAjax = $.ajax;
            $.ajax = function(arg0, arg1) {
                let param;
                if (arg1 === undefined) {
                    param = arg0;
                } else {
                    arg0 && (arg1.url = arg0);
                    param = arg1;
                }
                let oriSuccess = param.success;
                let oriError = param.error;
                let mySuccess, myError;
                // 投递结果的transformer, 结果通过oriSuccess/Error投递
                let dispatchResultTransformer = p => p
                .then(r => oriSuccess(r))
                .catch(e => oriError(e))
                // 转换原始请求的结果的transformer
                let oriResultTransformer
                let one_api;
                // log(param)
                if (param.url.match('/web_api/get_source')) {
                    one_api = bilibiliApis._get_source;
                    oriResultTransformer = p => p
                        .then(json => {
                        log(json);
                        if (json.code === -40301 // 区域限制
                            ||
                            json.result.payment && json.result.payment.price != 0 && balh_config.blocked_vip) { // 需要付费的视频, 此时B站返回的cid是错了, 故需要使用代理服务器的接口
                            areaLimit(true);
                            return one_api.asyncAjax(param.url)
                                .catch(e => json) // 新的请求报错, 也应该返回原来的数据
                        } else {
                            areaLimit(false);
                            if ((balh_config.blocked_vip || balh_config.remove_pre_ad) && json.code === 0 && json.result.pre_ad) {
                                json.result.pre_ad = 0; // 去除前置广告
                            }
                            return json;
                        }
                    })
                } else if (param.url.match('/player/web_api/playurl') // 老的番剧页面playurl接口
                           ||
                           param.url.match('/player/web_api/v2/playurl') // 新的番剧页面playurl接口
                           ||
                           (balh_config.enable_in_av && param.url.match('//interface.bilibili.com/v2/playurl')) // 普通的av页面playurl接口
                          ) {
                    one_api = bilibiliApis._playurl;
                    oriResultTransformer = p => p
                        .then(json => {
                        log(json)
                        if (balh_config.blocked_vip || json.code || isAreaLimitForPlayUrl(json)) {
                            areaLimit(true)
                            return one_api.asyncAjax(param.url)
                                .catch(e => json)
                        } else {
                            areaLimit(false)
                            return json
                        }
                    })
                    const oriDispatchResultTransformer = dispatchResultTransformer
                    dispatchResultTransformer = p => p
                        .then(r => {
                        if (!r.from && !r.result && !r.accept_description) {
                            util_log('playurl的result缺少必要的字段:', r)
                            r.from = 'local'
                            r.result = 'suee'
                            r.accept_description = ['未知 3P']
                            // r.timelength = r.durl.map(it => it.length).reduce((a, b) => a + b, 0)
                            if (r.durl && r.durl[0] && r.durl[0].url.includes('biliplus-vid.win')) {
                                const aid = window.__INITIAL_STATE__ && window.__INITIAL_STATE__.aid || 'fuck'
                                util_ui_pop({
                                    content: `原视频已被删除, 当前播放的是<a href="https://bg.biliplus-vid.win/">转存服务器</a>中的视频, 速度较慢<br>被删的原因可能是:<br>1. 视频违规<br>2. 视频被归类到番剧页面 => 试下<a href="https://search.bilibili.com/bangumi?keyword=${aid}">搜索av${aid}</a>`
                                })
                            }
                        }
                        return r
                    })
                        .compose(oriDispatchResultTransformer)
                } else if (param.url.match('//interface.bilibili.com/player?')) {
                    /*if (balh_config.blocked_vip) {
                        mySuccess = function(data) {
                            try {
                                let xml = new window.DOMParser().parseFromString(`<userstatus>${data.replace(/\&/g, '&amp;')}</userstatus>`, 'text/xml');
                                let vipTag = xml.querySelector('vip');
                                if (vipTag) {
                                    let vip = JSON.parse(vipTag.innerHTML);
                                    vip.vipType = 2; // 类型, 年度大会员
                                    vip.vipStatus = 1; // 状态, 启用
                                    vipTag.innerHTML = JSON.stringify(vip);
                                    data = xml.documentElement.innerHTML;
                                }
                            } catch (e) {
                                log('parse xml error: ', e);
                            }
                            oriSuccess(data);
                        };
                    }*/
                } else if (param.url.match('//api.bilibili.com/x/ad/video?')) {
                    /*if (balh_config.remove_pre_ad) {
                        mySuccess = function(data) {
                            log('/ad/video', data)
                            if (data && data.code === 0 && data.data) {
                                data.data = [] // 移除广告接口返回的数据
                            }
                            oriSuccess(data)
                        }
                    }*/
                }

                if (one_api && oriResultTransformer) {
                    if (isAreaLimitSeason()) {
                        // 清除原始请求的回调
                        mySuccess = util_func_noop
                        myError = util_func_noop
                        // 通过proxy, 执行请求
                        one_api.asyncAjax(param.url)
                            .compose(dispatchResultTransformer)
                    } else {
                        // 请求结果通过mySuccess/Error获取, 将其包装成Promise, 方便处理
                        new Promise((resolve, reject) => {
                            mySuccess = resolve
                            myError = reject
                        }).compose(oriResultTransformer)
                            .compose(dispatchResultTransformer)
                    }
                }

                // 若外部使用param.success处理结果, 则替换param.success
                if (oriSuccess && mySuccess) {
                    param.success = mySuccess;
                }
                // 处理替换error
                if (oriError && myError) {
                    param.error = myError;
                }
                // default
                let xhr = originalAjax.apply(this, [param]);

                // 若外部使用xhr.done()处理结果, 则替换xhr.done()
                if (!oriSuccess && mySuccess) {
                    xhr.done(mySuccess);
                    xhr.done = function(success) {
                        oriSuccess = success; // 保存外部设置的success函数
                        return xhr;
                    };
                }
                // 处理替换error
                if (!oriError && myError) {
                    xhr.fail(myError);
                    xhr.fail = function(error) {
                        oriError = error;
                        return xhr;
                    }
                }
                return xhr;
            };
        }

        function isAreaLimitSeason() {
            return util_storage['balh_season_' + getSeasonId()];
        }

        function areaLimit(limit) {
            setAreaLimitSeason(limit);
        }

        function setAreaLimitSeason(limit) {
            var season_id = getSeasonId();
            util_storage.set('balh_season_' + season_id, limit ? '1' : undefined, '');
            log('setAreaLimitSeason', season_id, limit);
            if (!limit) {
                //非限制时才打开log-report
                window.navigator.sendBeacon = navigator_sendBeacon;
            }
        }

        function getSeasonId() {
            var seasonId;
            // 取anime页面的seasonId
            try {
                // 若w, 是其frame的window, 则有可能没有权限, 而抛异常
                seasonId = window.season_id || window.top.season_id;
            } catch (e) {
                log(e);
            }
            if (!seasonId) {
                try {
                    seasonId = (window.top.location.pathname.match(/\/anime\/(\d+)/) || ['', ''])[1];
                } catch (e) {
                    log(e);
                }
            }

            // 若没取到, 则取movie页面的seasonId, 以m开头
            if (!seasonId) {
                try {
                    seasonId = (window.top.location.pathname.match(/\/movie\/(\d+)/) || ['', ''])[1];
                    if (seasonId) {
                        seasonId = 'm' + seasonId;
                    }
                } catch (e) {
                    log(e);
                }
            }

            // 若没取到, 则去新的番剧播放页面的ep或ss
            if (!seasonId) {
                try {
                    seasonId = (window.top.location.pathname.match(/\/bangumi\/play\/((ep|ss)\d+)/) || ['', ''])[1];
                } catch (e) {
                    log(e);
                }
            }
            // 若没取到, 则去取av页面的av号
            if (!seasonId) {
                try {
                    seasonId = (window.top.location.pathname.match(/\/video\/(av\d+)/) || ['', ''])[1]
                } catch (e) {
                    log(e);
                }
            }
            // 最后, 若没取到, 则试图取出当前页面url中的aid
            if (!seasonId) {
                seasonId = util_url_param(window.location.href, 'aid');
                if (seasonId) {
                    seasonId = 'aid' + seasonId;
                }
            }
            return seasonId || '000';
        }

        function isAreaLimitForPlayUrl(json) {
            return json.durl && json.durl.length === 1 && json.durl[0].length === 15126 && json.durl[0].size === 124627;
        }

        const bilibiliApis = (function() {
            function AjaxException(message, code = 0 /*用0表示未知错误*/ ) {
                this.name = 'AjaxException'
                this.message = message
                this.code = code
            }
            AjaxException.prototype.toString = function() {
                return `${this.name}: ${this.message}(${this.code})`
            }

            function BilibiliApi(props) {
                Object.assign(this, props);
            }

            BilibiliApi.prototype.asyncAjaxByProxy = function(originUrl, success, error) {
                var one_api = this;
                $.ajax({
                    url: one_api.transToProxyUrl(originUrl),
                    async: true,
                    xhrFields: { withCredentials: true },
                    success: function(result) {
                        log('==>', result);
                        success(one_api.processProxySuccess(result));
                        // log('success', arguments, this);
                    },
                    error: function(e) {
                        log('error', arguments, this);
                        error(e);
                    }
                });
            };
            BilibiliApi.prototype.asyncAjax = function(originUrl) {
                return util_ajax(this.transToProxyUrl(originUrl))
                    .then(r => this.processProxySuccess(r))
                    .compose(util_ui_msg.showOnNetErrorInPromise()) // 出错时, 提示服务器连不上
            }
            var get_source_by_aid = new BilibiliApi({
                transToProxyUrl: function(url) {
                    return balh_config.server + '/api/view?id=' + window.aid + '&update=true';
                },
                processProxySuccess: function(data) {
                    if (data && data.list && data.list[0] && data.movie) {
                        return {
                            code: 0,
                            message: 'success',
                            result: {
                                cid: data.list[0].cid,
                                formal_aid: data.aid,
                                movie_status: balh_config.blocked_vip ? 2 : data.movie.movie_status, // 2, 大概是免费的意思?
                                pay_begin_time: 1507708800,
                                pay_timestamp: 0,
                                pay_user_status: data.movie.pay_user.status, // 一般都是0
                                player: data.list[0].type, // 一般为movie
                                vid: data.list[0].vid,
                                vip: { // 2+1, 表示年度大会员; 0+0, 表示普通会员
                                    vipType: balh_config.blocked_vip ? 2 : 0,
                                    vipStatus: balh_config.blocked_vip ? 1 : 0,
                                }
                            }
                        };
                    } else {
                        return {
                            code: -404,
                            message: '不存在该剧集'
                        };
                    }
                }
            });
            var get_source_by_season_id = new BilibiliApi({
                transToProxyUrl: function(url) {
                    return balh_config.server + '/api/bangumi?season=' + window.season_id;
                },
                processProxySuccess: function(data) {
                    var found = null;
                    if (!data.code) {
                        for (var i = 0; i < data.result.episodes.length; i++) {
                            if (data.result.episodes[i].episode_id == window.episode_id) {
                                found = data.result.episodes[i];
                            }
                        }
                    } else {
                        util_ui_alert('代理服务器错误:' + JSON.stringify(data) + '\n点击刷新界面.', window.location.reload.bind(window.location));
                    }
                    var returnVal = found !== null ? {
                        "code": 0,
                        "message": "success",
                        "result": {
                            "aid": found.av_id,
                            "cid": found.danmaku,
                            "episode_status": balh_config.blocked_vip ? 2 : found.episode_status,
                            "payment": { "price": "9876547210.33" },
                            "pay_user": {
                                "status": balh_config.blocked_vip ? 1 : 0 // 是否已经支付过
                            },
                            "player": "vupload",
                            "pre_ad": 0,
                            "season_status": balh_config.blocked_vip ? 2 : data.result.season_status
                        }
                    } : { code: -404, message: '不存在该剧集' };
                    return returnVal;
                }
            });

            var playurl_by_proxy = new BilibiliApi({
                _asyncAjax: function(originUrl, bangumi) {
                    return util_ajax(this.transToProxyUrl(originUrl, bangumi))
                        .then(r => this.processProxySuccess(r, false))
                },
                transToProxyUrl: function(url, bangumi) {
                    if (bangumi === undefined) {
                        bangumi = true;
                        // season_type, 1 为动画, 5 为电视剧; 为5/3时, 不是番剧视频
                        let season_type_param = util_url_param(url, 'season_type')
                        if (season_type_param === '5' || season_type_param === '3') {
                            bangumi = false
                        }
                    }
                    var params = url.split('?')[1];
                    if (!bangumi) {
                        params = params.replace(/&?module=(\w+)/, '') // 移除可能存在的module参数
                    }
                    return `${balh_config.server}/BPplayurl.php?${params}`;
                },
                processProxySuccess: function(data, alertWhenError = true) {
                    // data有可能为null
                    if (data && data.code === -403) {
                        util_ui_alert(`突破黑洞失败\n当前代理服务器（${balh_config.server}）依然有区域限制\n\n可以考虑进行如下尝试:\n1. 进行“帐号授权”\n2. 换个代理服务器\n\n点击确定, 打开设置页面`);
                    } else if (data === null || data.code) {
                        util_error(data);
                        if (alertWhenError) {
                            util_ui_alert(`突破黑洞失败\n${JSON.stringify(data)}\n点击确定刷新界面`, window.location.reload.bind(window.location));
                        } else {
                            return Promise.reject(new AjaxException(`服务器错误: ${JSON.stringify(data)}`, data ? data.code : 0))
                        }
                    } else if (isAreaLimitForPlayUrl(data)) {
                        util_error('>>area limit');
                        return Promise.reject(new AjaxException(`服务器dummy数据,可能是没有登陆: ${JSON.stringify(data)}`, data ? data.code : 0))

                    }
                    return data;
                }
            })
            const playurl = new BilibiliApi({
                asyncAjax: function(originUrl) {
                    util_log('从代理服务器拉取视频地址中...');
                    return playurl_by_proxy._asyncAjax(originUrl) // 优先从代理服务器获取
                        .catch(e => {
                        if (e instanceof AjaxException && e.code === 1) { // code: 1 表示非番剧视频, 不能使用番剧视频参数
                            util_error(e);
                            util_log('尝试使用非番剧视频接口拉取视频地址...')
                            return playurl_by_proxy._asyncAjax(originUrl, false)
                                .catch(e2 => Promise.reject(e)) // 忽略e2, 返回原始错误e
                        } else {
                            return Promise.reject(e)
                        }
                    })
                        .catch(e => {
                        util_error(e);
                        /*util_log('尝试换用B站接口拉取视频地址(清晰度低)...')
                            // 失败时, 转而从B站获取
                            return playurl_by_bilibili._asyncAjax(originUrl)
                                .catch(e2 => {
                                    util_error(e2) // 打印错误日志
                                    // 直接忽略playurl_by_bilibili的错误, 改成返回playurl_by_proxy的错误...
                                    return Promise.reject(e2);
                                })*/
                        return Promise.reject(e);
                    })
                        .catch(e => {
                        util_ui_alert(`拉取视频地址失败\n${util_stringify(e)}\n\n可以考虑进行如下尝试:\n1. 多刷新几下页面\n` +
                                      `2. 进入设置页面更换代理服务器\n3. 耐心等待代理服务器端修复问题\n\n点击确定按钮, 刷新页面`, window.location.reload.bind(window.location));
                        return Promise.reject(e);
                    })
                }
            })
            return {
                _get_source: util_page.movie() ? get_source_by_aid : get_source_by_season_id,
                _playurl: playurl,
            };
        })();

        injectXHR();

        function checkAreaLimitInfo() {
            let checkLimitTimer = null;
            let checkTime = 0,
                maxCount = 3;

            //检查信息数据,
            checkLimitTimer = window.setInterval(function() {
                let done = false;
                if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.epInfo) {
                    let cid = window.__INITIAL_STATE__.epInfo.cid;
                    if (cid && isAreaLimitSeason()) {
                        let season_id = getSeasonId();
                        util_storage.set('balh_season_' + season_id, cid);
                        biliplayurl(cid, { season_type: 1, quality: 80 }).then(function(url) {
                            // 这里是故意转向injectAjax
                            $.ajax({
                                url: url,
                                success: createFlvplayerWithUrls,
                                error: util_func_noop
                            });
                        });
                        done = true;
                    }
                }
                checkTime++;
                if (done || checkTime === maxCount) {
                    window.clearInterval(checkLimitTimer);
                    checkLimitTimer = null;
                }
            }, 1000);
        }

        if (!window.jQuery) { // 若还未加载jQuery, 则监听
            let jQuery;

            Object.defineProperty(window, 'jQuery', {
                configurable: true,
                enumerable: true,
                set: function(v) {
                    jQuery = v;
                    injectAjax(); // 设置jQuery后, 立即注入
                    checkAreaLimitInfo();

                },
                get: function() {
                    return jQuery;
                }
            });
        } else {
            injectAjax();
            checkAreaLimitInfo();
        }


        let mediaSourceInfos = null;
        let mediaDataSource = null;
        let videoElement = null;

        function parseFlvplayerSources(json) {
            if (json.code) {
                util_log('fetch play url code error', json);
                return null;
            } else {
                if (!json.durl || !json.durl.length) {
                    util_log('no play url found', json);
                    return null;
                }
            }
            let ret = {};
            ret.accept_format = json.accept_format;
            ret.accept_quality = json.accept_quality;
            ret.accept_description = json.accept_description;
            ret.durl = json.durl;
            let mds = {};
            mds.url = json.durl[0].url;
            mds.duration = json.durl[0].length;
            mds.filesize = json.durl[0].size;
            mds.type = 'flv';
            mediaDataSource = mds;
            return ret;
        }

        function swtichUrl(url) {
            if (mediaDataSource.url == url) {
                return;
            }
            mediaDataSource.url = url;
            let player = window.flvplayer;
            if (player) {
                flv_destroy();
            }
            let lastTime = videoElement.currentTime;
            player = flvjs.createPlayer(mediaDataSource, {
                enableWorker: false,
                lazyLoadMaxDuration: 3 * 60,
                seekType: 'range',
                fixAudioTimestampGap: false
            });
            player.attachMediaElement(videoElement);
            player.load();
            if (lastTime > 0) {
                player.pause();
                videoElement.currentTime = lastTime;
            }
            player.play();
            window.flvplayer = player;

        }

        function createMediaInfoSel(durls) {
            let len = durls.length;
            if (len < 1) {
                return null;
            }
            let allSubs = [];
            let span = _('span', { style: { display: 'inline-block' } }, '质量:');
            allSubs.push(span);
            let subElems = durls.reduce(function(subElems, durl, index) {
                let quqlOptions = subElems.quqlOptions;
                let backSels = subElems.backSels;
                quqlOptions.push(_('option', { value: durl.url, title: durl.url }, '大小: ' + (durl.size / 1e6).toFixed(2) + 'MB'));
                if (durl.backup_url) {

                    let backops = durl.backup_url.reduce(function(sub, backUrl, ids) {
                        sub.push(_('option', { value: backUrl, title: backUrl }, '备用' + (i + 1)));
                        return sub;
                    }, []);
                    let backSel = _('select', {
                        style: { display: 'none', width: '500px' },
                        name: 'backurl_' + index,
                        event: { change: function(e) { swtichUrl(e.target.value); } }
                    }, backops);
                    backSels[index] = backSel;
                }

                return subElems;
            }, { quqlOptions: [], backSels: {} });
            let qualSel = _('select', {
                style: { display: 'inline-block', width: '200px' },
                event: {
                    change: function(e) {
                        swtichUrl(e.target.value);
                    }
                }
            }, subElems.quqlOptions);
            allSubs.push(qualSel);
            span = _('span', { style: { display: 'inline-block' } }, '备用:');
            allSubs.push(span);
            for (let k in subElems.backSels) {
                allSubs.push(subElems.backSels[k]);
            }
            return allSubs;
        }

        const createFlvplayerWithUrls = function(json) {
            mediaSourceInfos = parseFlvplayerSources(json);
            if (!mediaSourceInfos || !mediaDataSource) {
                return;
            }
            videoElement = _('video', { style: { width: '100%' }, controls: true });
            //for(let i=0;i<)
            let mediaInfoContainer = _('div', { style: { width: '100%', height: '50px' } }, createMediaInfoSel(mediaSourceInfos.durl));
            let container = $('#bofqi').css('display','block');
            container.parent().find('.player-limit-wrap').remove();
            $('.bangumi-player').css('background', 'inherit');

            container.append(videoElement);
            container.append(mediaInfoContainer);
            let player = window.flvplayer;
            if (player) {
                flv_destroy();
            }
            player = flvjs.createPlayer(mediaDataSource, {
                enableWorker: false,
                lazyLoadMaxDuration: 3 * 60,
                seekType: 'range',
                fixAudioTimestampGap: false
            });
            player.attachMediaElement(videoElement);
            player.load();
            window.flvplayer = player;
        };

        function flv_destroy() {
            let player = window.flvplayer;
            player.pause();
            player.unload();
            player.detachMediaElement();
            player.destroy();
            window.player = null;
        }

    }());

    const balh_feature_runPing = function() {

        let xhr = new XMLHttpRequest(),
            testUrl = [r.const.server.S0, r.const.server.S1],
            testUrlIndex = 0,
            isReused = false,
            prevNow, outputArr = [];

        xhr.open('GET', '', true);
        xhr.onreadystatechange = function() {
            this.readyState == 4 && pingResult();
        };
        var pingLoop = function() {
            prevNow = performance.now();
            xhr.open('GET', testUrl[testUrlIndex] + '/api/bangumi', true);
            xhr.send();
        };
        var pingResult = function() {
            var duration = (performance.now() - prevNow) | 0;
            if (isReused)
                outputArr.push('\t复用连接：' + duration + 'ms'), isReused = false, testUrlIndex++;
            else
                outputArr.push(testUrl[testUrlIndex] + ':'), outputArr.push('\t初次连接：' + duration + 'ms'), isReused = true;
            pingOutput.textContent = outputArr.join('\n');
            if (testUrlIndex < testUrl.length) {
                pingLoop();
            }
        };
        pingLoop();
    };

    const balh_feature_RedirectToBangumi = (function() {
        // 重定向到Bangumi页面
        function tryRedirectToBangumi() {
            let $errorPanel;
            if (!($errorPanel = document.querySelector('.error-container > .error-panel'))) {
                return;
            }
            let msg = document.createElement('a');
            $errorPanel.insertBefore(msg, $errorPanel.firstChild);
            msg.innerText = '获取番剧页Url中...';
            let aid = location.pathname.replace(/.*av(\d+).*/, '$1'),
                page = (location.pathname.match(/\/index_(\d+).html/) || ['', '1'])[1],
                cid,
                season_id,
                episode_id;
            let avData;
            balh_api_plus_view(aid)
                .then(function(data) {
                avData = data;
                if (data.code) {
                    return Promise.reject(JSON.stringify(data));
                }
                // 计算当前页面的cid
                for (let i = 0; i < data.list.length; i++) {
                    if (data.list[i].page == page) {
                        cid = data.list[i].cid;
                        break;
                    }
                }
                if (!data.bangumi) {
                    generatePlayer(data, aid, page, cid)
                    // return Promise.reject('该AV号不属于任何番剧页');//No bangumi in api response
                } else {
                    // 当前av属于番剧页面, 继续处理
                    season_id = data.bangumi.season_id;
                    return balh_api_plus_season(season_id);
                }
            })
                .then(function(result) {
                if (result === undefined) return // 上一个then不返回内容时, 不需要处理
                if (result.code === 10) { // av属于番剧页面, 通过接口却未能找到番剧信息
                    let ep_id_newest = avData && avData.bangumi && avData.bangumi.newest_ep_id
                    if (ep_id_newest) {
                        episode_id = ep_id_newest // 此时, 若avData中有最新的ep_id, 则直接使用它
                    } else {
                        return Promise.reject(`av${aid}属于番剧${season_id}, 但却不能找到番剧页的信息, 试图直接创建播放器`);
                    }
                } else if (result.code) {
                    return Promise.reject(JSON.stringify(result))
                } else {
                    let ep_id_by_cid, ep_id_by_aid_page, ep_id_by_aid,
                        episodes = result.result.episodes,
                        ep
                    // 为何要用三种不同方式匹配, 详见: https://greasyfork.org/zh-CN/forum/discussion/22379/x#Comment_34127
                    for (let i = 0; i < episodes.length; i++) {
                        ep = episodes[i]
                        if (ep.danmaku == cid) {
                            ep_id_by_cid = ep.episode_id
                        }
                        if (ep.av_id == aid && ep.page == page) {
                            ep_id_by_aid_page = ep.episode_id
                        }
                        if (ep.av_id == aid) {
                            ep_id_by_aid = ep.episode_id
                        }
                    }
                    episode_id = ep_id_by_cid || ep_id_by_aid_page || ep_id_by_aid
                }
                if (episode_id) {
                    let bangumi_url = `//www.bilibili.com/bangumi/play/ep${episode_id}`;
                    log('Redirect', 'aid:', aid, 'page:', page, 'cid:', cid, '==>', bangumi_url, 'season_id:', season_id, 'ep_id:', episode_id)
                    msg.innerText = '即将跳转到：' + bangumi_url
                    location.href = bangumi_url
                } else {
                    return Promise.reject('查询episode_id失败')
                }
            })
                .catch(function(e) {
                log('error:', arguments);
                msg.innerText = 'error:' + e;
            });
        }

        util_init(() => {
            if (util_page.av()) {
                tryRedirectToBangumi();
            }
        }, util_init.PRIORITY.DEFAULT, util_init.RUN_AT.COMPLETE);
        return true // 随便返回一个值...
    }());

    // 暴露接口
    window.bangumi_area_limit_hack = {
        setStorage: util_storage.set,
        getStorage: util_storage.get,
        clearStorage: util_storage.clear,
        serverPing: balh_feature_runPing
    }


}

scriptSource(GM_info.scriptHandler);