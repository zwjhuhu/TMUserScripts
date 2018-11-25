/*!
 *
 * Comment Core Library CommentManager
 * @license MIT
 * @author Jim Chen
 *
 * Copyright (c) 2014 Jim Chen
 *
 * XMLParsr
 * == Licensed Under the MIT License : /LICENSING
 * Copyright (c) 2012 Jim Chen ( CQZ, Jabbany )
 */
/**
 * Binary Search Stubs for JS Arrays
 * @license MIT
 * @author Jim Chen
 */
var BinArray = (function(){
	var BinArray = {};
	BinArray.bsearch = function(arr, what, how){
		if(arr.length === 0) {
			return 0;
		}
		if(how(what,arr[0]) < 0) {
			return 0;
		}
		if(how(what,arr[arr.length - 1]) >=0) {
			return arr.length;
		}
		var low =0;
		var i = 0;
		var count = 0;
		var high = arr.length - 1;
		while(low<=high){
			i = Math.floor((high + low + 1)/2);
			count++;
			if(how(what,arr[i-1])>=0 && how(what,arr[i])<0){
				return i;
			}
			if(how(what,arr[i-1])<0){
				high = i-1;
			}else if(how(what,arr[i])>=0){
				low = i;
			}else {
				console.error('Program Error');
			}
			if(count > 1500) { console.error('Too many run cycles.'); }
		}
		return -1; // Never actually run
	};
	BinArray.binsert = function(arr, what, how){
		var index = BinArray.bsearch(arr,what,how);
		arr.splice(index,0,what);
		return index;
	};
	return BinArray;
})();

var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var CommentSpaceAllocator = (function () {
    function CommentSpaceAllocator(width, height) {
        if (width === void 0) { width = 0; }
        if (height === void 0) { height = 0; }
        this._pools = [
            []
        ];
        this.avoid = 1;
        this._width = width;
		this._height = height;
		this.length = 0;
    }
    CommentSpaceAllocator.prototype.willCollide = function (existing, check) {
        return existing.stime + existing.ttl >= check.stime + check.ttl / 2;
    };
    CommentSpaceAllocator.prototype.pathCheck = function (y, comment, pool) {
        var bottom = y + comment.height;
        var right = comment.right;
        for (var i = 0; i < pool.length; i++) {
            if (pool[i].y > bottom || pool[i].bottom < y) {
                continue;
            }
            else if (pool[i].right < comment.x || pool[i].x > right) {
                if (this.willCollide(pool[i], comment)) {
                    return false;
                }
                else {
                    continue;
                }
            }
            else {
                return false;
            }
        }
        return true;
    };
    CommentSpaceAllocator.prototype.assign = function (comment, cindex) {
        while (this._pools.length <= cindex) {
            this._pools.push([]);
        }
        var pool = this._pools[cindex];
        if (pool.length === 0) {
            comment.cindex = cindex;
            return 0;
        }
        else if (this.pathCheck(0, comment, pool)) {
            comment.cindex = cindex;
            return 0;
        }
        var y = 0;
        for (var k = 0; k < pool.length; k++) {
            y = pool[k].bottom + this.avoid;
            if (y + comment.height > this._height) {
                break;
            }
            if (this.pathCheck(y, comment, pool)) {
                comment.cindex = cindex;
                return y;
            }
        }
        return this.assign(comment, cindex + 1);
    };
    CommentSpaceAllocator.prototype.add = function (comment) {
		this.length++;
        if (comment.height > this._height) {
            comment.cindex = -2;
            comment.y = 0;
        }
        else {
            comment.y = this.assign(comment, 0);
            BinArray.binsert(this._pools[comment.cindex], comment, function (a, b) {
                if (a.bottom < b.bottom) {
                    return -1;
                }
                else if (a.bottom > b.bottom) {
                    return 1;
                }
                else {
                    return 0;
                }
            });
        }
    };
    CommentSpaceAllocator.prototype.remove = function (comment) {
        if (comment.cindex < 0) {
            return;
        }
        if (comment.cindex >= this._pools.length) {
            console.log(comment.cindex,comment);
            throw new Error("cindex out of bounds");
        }
        var index = this._pools[comment.cindex].indexOf(comment);
        if (index < 0)
            return;
		this._pools[comment.cindex].splice(index, 1);
		this.length--;
    };
    CommentSpaceAllocator.prototype.setBounds = function (width, height) {
        this._width = width;
        this._height = height;
    };
    return CommentSpaceAllocator;
}());
var AnchorCommentSpaceAllocator = (function (_super) {
    __extends(AnchorCommentSpaceAllocator, _super);
    function AnchorCommentSpaceAllocator() {
        _super.apply(this, arguments);
    }
    AnchorCommentSpaceAllocator.prototype.add = function (comment) {
        _super.prototype.add.call(this, comment);
        comment.x = (this._width - comment.width) / 2;
    };
    AnchorCommentSpaceAllocator.prototype.willCollide = function (a, b) {
        return true;
    };
    AnchorCommentSpaceAllocator.prototype.pathCheck = function (y, comment, pool) {
        var bottom = y + comment.height;
        for (var i = 0; i < pool.length; i++) {
            if (pool[i].y > bottom || pool[i].bottom < y) {
                continue;
            }
            else {
                return false;
            }
        }
        return true;
    };
    return AnchorCommentSpaceAllocator;
}(CommentSpaceAllocator));

var CoreComment = (function () {
    function CoreComment(parent, init) {
        if (init === void 0) { init = {}; }
        this.mode = 1;
        this.stime = 0;
        this.text = "";
        this.ttl = 4000;
        this.dur = 4000;
        this.cindex = -1;
        this.motion = [];
        this.movable = true;
        this._alphaMotion = null;
        this.absolute = true;
        this.align = 0;
        this._alpha = 1;
        this._size = 25;
        this._color = 0xffffff;
        this._border = false;
        this._shadow = true;
        this._font = "";
        if (!parent) {
            throw new Error("Comment not bound to comment manager.");
        }
        else {
            this.parent = parent;
        }
        if (init.hasOwnProperty("stime")) {
            this.stime = init["stime"];
        }
        if (init.hasOwnProperty("mode")) {
            this.mode = init["mode"];
        }
        else {
            this.mode = 1;
        }
        if (init.hasOwnProperty("dur")) {
            this.dur = init["dur"];
            this.ttl = this.dur;
        }
        this.dur *= this.parent.options.global.scale;
        this.ttl *= this.parent.options.global.scale;
        if( this.mode === 4 || this.mode === 5 ){
        	this.dur *= .6;
        	this.ttl *= .6;
        }
        if (init.hasOwnProperty("text")) {
            this.text = init["text"];
        }
        if (init.hasOwnProperty("motion")) {
            this._motionStart = [];
            this._motionEnd = [];
            this.motion = init["motion"];
            var head = 0;
            for (var i = 0; i < init["motion"].length; i++) {
                this._motionStart.push(head);
                var maxDur = 0;
                for (var k in init["motion"][i]) {
                    var m = init["motion"][i][k];
                    maxDur = Math.max(m.dur, maxDur);
                    if (m.easing === null || m.easing === undefined) {
                        init["motion"][i][k]["easing"] = CoreComment.LINEAR;
                    }
                }
                head += maxDur;
                this._motionEnd.push(head);
            }
            this._curMotion = 0;
        }
        if (init.hasOwnProperty("color")) {
            this._color = init["color"];
        }
        if (init.hasOwnProperty("size")) {
            this._size = init["size"];
        }
        if (init.hasOwnProperty("border")) {
            this._border = init["border"];
        }
        if (init.hasOwnProperty("opacity")) {
            this._alpha = init["opacity"];
        }
        if (init.hasOwnProperty("alpha")) {
            this._alphaMotion = init["alpha"];
        }
        if (init.hasOwnProperty("font")) {
            this._font = init["font"];
        }
        if (init.hasOwnProperty("x")) {
            this._x = init["x"];
        }
        if (init.hasOwnProperty("y")) {
            this._y = init["y"];
        }
        if (init.hasOwnProperty("shadow")) {
            this._shadow = init["shadow"];
        }
        if (init.hasOwnProperty("position")) {
            if (init["position"] === "relative") {
                this.absolute = false;
                if (this.mode < 7) {
                    console.warn("Using relative position for CSA comment.");
                }
            }
        }
    }
    CoreComment.prototype.init = function (recycle) {
        if (recycle === void 0) { recycle = null; }
        if (recycle !== null) {
            this.dom = recycle.dom;
        }else if (!this.dom){
            this.dom = document.createElement("div");
        }else{
            this.dom.className = '';
            this.dom.textContent = '';
            this.dom.innerText = '';
            this.dom.style.cssText = '';
        }
		this.dom.className = this.parent.options.global.className;
		this.parent.options.global.outline && this.dom.classList.add('outline');
		this.parent.options.global.shadow && this.dom.classList.add('shadow');
        this.dom.appendChild(document.createTextNode(this.text));
        this.dom.textContent = this.text;
        this.dom.innerText = this.text;
        this.size = this._size;
        if (this._color != 0xffffff) {
            this.color = this._color;
        }
        this.shadow = this._shadow;
        if (this._border) {
            this.border = this._border;
        }
        if (this._font !== "") {
            this.font = this._font;
        }
        if (this._x !== undefined) {
            this.x = this._x;
        }
        if (this._y !== undefined) {
            this.y = this._y;
        }
        if (this._alpha !== 1 || this.parent.options.global.opacity < 1) {
            this.alpha = this._alpha;
        }
        if (this.motion.length > 0) {
            this.animate();
        }
    };
    Object.defineProperty(CoreComment.prototype, "x", {
        get: function () {
            if (this._x === null || this._x === undefined) {
                if (this.align % 2 === 0) {
                    this._x = this.dom.offsetLeft;
                }
                else {
                    this._x = this.parent.width - this.dom.offsetLeft - this.width;
                }
            }
            if (!this.absolute) {
                return this._x / this.parent.width;
            }
            return this._x;
        },
        set: function (x) {
            this._x = x;
            if (!this.absolute) {
                this._x *= this.parent.width;
            }
            if (this.align % 2 === 0) {
                this.dom.style.left = this._x + "px";
            }
            else {
                this.dom.style.right = this._x + "px";
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CoreComment.prototype, "y", {
        get: function () {
            if (this._y === null || this._y === undefined) {
                if (this.align < 2) {
                    this._y = this.dom.offsetTop;
                }
                else {
                    this._y = this.parent.height - this.dom.offsetTop - this.height;
                }
            }
            if (!this.absolute) {
                return this._y / this.parent.height;
            }
            return this._y;
        },
        set: function (y) {
            this._y = y;
            if (!this.absolute) {
                this._y *= this.parent.height;
            }
            if (this.align < 2) {
                this.dom.style.top = this._y + "px";
            }
            else {
                this.dom.style.bottom = this._y + "px";
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CoreComment.prototype, "bottom", {
        get: function () {
            return this.y + this.height;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CoreComment.prototype, "right", {
        get: function () {
            return this.x + this.width;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CoreComment.prototype, "width", {
        get: function () {
            if (this._width === null || this._width === undefined) {
                this._width = this.dom.offsetWidth;
            }
            return this._width;
        },
        set: function (w) {
            this._width = w;
            this.dom.style.width = this._width + "px";
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CoreComment.prototype, "height", {
        get: function () {
            if (this._height === null || this._height === undefined) {
                this._height = this.dom.offsetHeight;
            }
            return this._height;
        },
        set: function (h) {
            this._height = h;
            this.dom.style.height = this._height + "px";
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CoreComment.prototype, "size", {
        get: function () {
            return this._size;
        },
        set: function (s) {
            this._size = s;
            this.dom.style.fontSize = this._size + "px";
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CoreComment.prototype, "color", {
        get: function () {
            return this._color;
        },
        set: function (c) {
            this._color = c;
            var color = c.toString(16);
            color = color.length >= 6 ? color : new Array(6 - color.length + 1).join("0") + color;
            this.dom.style.color = "#" + color;
            if (this._color === 0) {
                this.dom.classList.add("rshadow");
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CoreComment.prototype, "alpha", {
        get: function () {
            return this._alpha;
        },
        set: function (a) {
            this._alpha = a;
            this.dom.style.opacity = Math.min(this._alpha, this.parent.options.global.opacity) + "";
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CoreComment.prototype, "border", {
        get: function () {
            return this._border;
        },
        set: function (b) {
            this._border = b;
            if (this._border) {
                this.dom.style.border = "1px solid #00ffff";
            }
            else {
                this.dom.style.border = "none";
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CoreComment.prototype, "shadow", {
        get: function () {
            return this._shadow;
        },
        set: function (s) {
            this._shadow = s;
            if (!this._shadow) {
                this.dom.className = this.parent.options.global.className + " noshadow";
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CoreComment.prototype, "textData", {
        get: function () {
            if(!this._cache) {
                this._cache = this.parent._caches.length ? this.parent._caches.shift() : null;
            }
            return this._cache;
        },
        set: function (cache) {
            if(!cache) {
                if(this._cache && this._cache.nodeName.toUpperCase()==='CANVAS') {
                    this.parent._caches.push(this._cache);
                }
                this._cache = null;
            } else {
                this._cache = cache;
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CoreComment.prototype, "dom", {
        get: function () {
            if(!this._dom) {
                this._dom = this.parent._doms.length ? this.parent._doms.shift() : null;
            }
            return this._dom;
        },
        set: function (dom) {
            if(!dom) {
                if(this._dom && this._dom.nodeType) {
                    this.parent._doms.push(this._dom);
                }
                this._dom = null;
            } else {
                this._dom = dom;
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CoreComment.prototype, "font", {
        get: function () {
            return this._font;
        },
        set: function (f) {
            this._font = f;
            if (this._font.length > 0) {
                this.dom.style.fontFamily = this._font;
            }
            else {
                this.dom.style.fontFamily = "";
            }
        },
        enumerable: true,
        configurable: true
    });
    CoreComment.prototype.time = function (time) {
        this.ttl -= time;
        if (this.ttl < 0) {
            this.ttl = 0;
        }
        if (this.movable) {
            this.update();
        }
        if (this.ttl <= 0) {
            this.finish();
        }
    };
    CoreComment.prototype.update = function () {
        this.animate();
    };
    CoreComment.prototype.invalidate = function () {
        this._x = null;
        this._y = null;
        this._width = null;
        this._height = null;
    };
    CoreComment.prototype._execMotion = function (currentMotion, time) {
        for (var prop in currentMotion) {
            if (currentMotion.hasOwnProperty(prop)) {
                var m = currentMotion[prop];
                this[prop] = m.easing(Math.min(Math.max(time - m.delay, 0), m.dur), m.from, m.to - m.from, m.dur);
            }
        }
    };
    CoreComment.prototype.animate = function () {
        if (this._alphaMotion) {
            this.alpha = (this.dur - this.ttl) * (this._alphaMotion["to"] - this._alphaMotion["from"]) / this.dur + this._alphaMotion["from"];
        }
        if (this.motion.length === 0) {
            return;
        }
        var ttl = Math.max(this.ttl, 0);
        var time = (this.dur - ttl) - this._motionStart[this._curMotion];
        this._execMotion(this.motion[this._curMotion], time);
        if (this.dur - ttl > this._motionEnd[this._curMotion]) {
            this._curMotion++;
            if (this._curMotion >= this.motion.length) {
                this._curMotion = this.motion.length - 1;
            }
            return;
        }
    };
    CoreComment.prototype.stop = function () {
    };
    CoreComment.prototype.finish = function () {
        this.parent.finish(this);
    };
    CoreComment.prototype.toString = function () {
        return ["[", this.stime, "|", this.ttl, "/", this.dur, "]", "(", this.mode, ")", this.text].join("");
    };
    CoreComment.LINEAR = function (t, b, c, d) {
        return t * c / d + b;
    };
    return CoreComment;
}());
var ScrollComment = (function (_super) {
    __extends(ScrollComment, _super);
    function ScrollComment(parent, data) {
        _super.call(this, parent, data);
        this.dur *= this.parent.options.scroll.scale;
        this.ttl *= this.parent.options.scroll.scale;
    }
    Object.defineProperty(ScrollComment.prototype, "alpha", {
        set: function (a) {
            this._alpha = a;
            this.dom.style.opacity = Math.min(Math.min(this._alpha, this.parent.options.global.opacity), this.parent.options.scroll.opacity) + "";
        },
        enumerable: true,
        configurable: true
    });
    ScrollComment.prototype.init = function (recycle) {
        if (recycle === void 0) { recycle = null; }
        _super.prototype.init.call(this, recycle);
        this.x = this.parent.width;
        if (this.parent.options.scroll.opacity < 1) {
            this.alpha = this._alpha;
        }
        this.absolute = true;
    };
    ScrollComment.prototype.update = function () {
        this.x = (this.ttl / this.dur) * (this.parent.width + this.width) - this.width;
    };
    return ScrollComment;
}(CoreComment));
var CSSCompatLayer = (function () {
    function CSSCompatLayer() {
    }
    CSSCompatLayer.transform = function (dom, trans) {
        dom.style.transform = trans;
        dom.style["webkitTransform"] = trans;
        dom.style["msTransform"] = trans;
        dom.style["oTransform"] = trans;
    };
    return CSSCompatLayer;
}());
var CSSScrollComment = (function (_super) {
    __extends(CSSScrollComment, _super);
    function CSSScrollComment() {
        _super.apply(this, arguments);
        this._dirtyCSS = true;
    }
    Object.defineProperty(CSSScrollComment.prototype, "x", {
        get: function () {
            return (this.ttl / this.dur) * (this.parent.width + this.width) - this.width;
        },
        set: function (x) {
            if (typeof this._x === "number") {
                var dx = x - this._x;
                this._x = x;
                CSSCompatLayer.transform(this.dom, "translateX(" + dx + "px)");
            }
            else {
                this._x = x;
                if (!this.absolute) {
                    this._x *= this.parent.width;
                }
                if (this.align % 2 === 0) {
                    this.dom.style.left = this._x + "px";
                }
                else {
                    this.dom.style.right = this._x + "px";
                }
            }
        },
        enumerable: true,
        configurable: true
    });
    CSSScrollComment.prototype.update = function () {
        if (this._dirtyCSS) {
            this.dom.style.transition = "transform " + this.ttl + "ms linear";
            this.x = -this.width;
            this._dirtyCSS = false;
        }
    };
    CSSScrollComment.prototype.invalidate = function () {
        _super.prototype.invalidate.call(this);
        this._dirtyCSS = true;
    };
    CSSScrollComment.prototype.stop = function () {
        this.dom.style.transition = "";
        this.x = this._x;
        this._x = null;
        this.x = (this.ttl / this.dur) * (this.parent.width + this.width) - this.width;
        this._dirtyCSS = true;
    };
    return CSSScrollComment;
}(ScrollComment));

/**
 * Comment Filters Module Simplified (only supports modifiers & types)
 * @license MIT
 * @author Jim Chen
 */
function CommentFilter(){
	this.modifiers = [];
	this.runtime = null;
	this.allowTypes = {
		"1":true,
		"4":true,
		"5":true,
		"6":true,
		"7":true,
		"8":true,
		"17":true
	};
	this.doModify = function(cmt){
		for(var k=0;k<this.modifiers.length;k++){
			cmt = this.modifiers[k](cmt);
		}
		return cmt;
	};
	this.beforeSend = function(cmt){
		return cmt;
	}
	this.doValidate = function(cmtData){
		if(!this.allowTypes[cmtData.mode])
			return false;
		return true;
	};
	this.addRule = function(rule){

	};
	this.addModifier = function(f){
		this.modifiers.push(f);
	};
	this.runtimeFilter = function(cmt){
		if(this.runtime == null)
			return cmt;
		return this.runtime(cmt);
	};
	this.setRuntimeFilter = function(f){
		this.runtime = f;
	}
}

var CommentManager = (function() {
	var getRotMatrix = function(yrot, zrot) {
		// Courtesy of @StarBrilliant, re-adapted to look better
		var DEG2RAD = Math.PI/180;
		var yr = yrot * DEG2RAD;
		var zr = zrot * DEG2RAD;
		var COS = Math.cos;
		var SIN = Math.sin;
		var matrix = [
			COS(yr) * COS(zr)    , COS(yr) * SIN(zr)     , SIN(yr)  , 0,
			(-SIN(zr))           , COS(zr)               , 0        , 0,
			(-SIN(yr) * COS(zr)) , (-SIN(yr) * SIN(zr))  , COS(yr)  , 0,
			0                    , 0                     , 0        , 1
		];
		// CSS does not recognize scientific notation (e.g. 1e-6), truncating it.
		for(var i = 0; i < matrix.length;i++){
			if(Math.abs(matrix[i]) < 0.000001){
				matrix[i] = 0;
			}
		}
		return "matrix3d(" + matrix.join(",") + ")";
	};
	var autoOpacityFromComment = function(count){
		return -Math.tanh((count-50)/25)/Math.PI*.8+.718;
	};
	var font = "-apple-system,Arial,'PingFang SC','STHeiti Light','Hiragino Kaku Gothic ProN','Microsoft YaHei'";

	function CommentManager(stageObject){
		var __timer = 0;
		var self = this;

		this._listeners = {};
		this._lastPosition = 0;

		this.stage = stageObject;
		this.paused = true;
		this.pausedTime = 0;
		this.canvas = document.createElement('canvas');
        this._ctx = this.canvas.getContext('2d');
        this._caches = [];
        this._doms = [];
		this.canvasFPS = 0;
		self.canvas.style.width = '100%';
		self.canvas.style.height = '100%';
		self.stage.appendChild(self.canvas);
		this.options = {
			global:{
				opacity:1,
				scale:1,
				className:"cmt",
				useCSS:false,
				autoOpacity:false,
				autoOpacityVal:1,
				density: 0,
				outline: false,
				shadow: true
			},
			scroll:{
				opacity:1,
				scale:1
			},
			limit: 0
		};
		this.timeline = [];
		this.runline = [];
		this.position = 0;
		this.limiter = 0;
		this.filter = null;
		this.csa = {
			scroll: new CommentSpaceAllocator(0,0),
			top:new AnchorCommentSpaceAllocator(0,0),
			bottom:new AnchorCommentSpaceAllocator(0,0),
			reverse:new CommentSpaceAllocator(0,0),
			scrollbtm:new CommentSpaceAllocator(0,0)
		};

		/** Precompute the offset width **/
		this.width = this.stage.offsetWidth;
		this.height = this.stage.offsetHeight;
		var pauseTime = 0;
		this.startTimer = function(){
			if(__timer > 0)
				return;
			var lastTPos = new Date().getTime();
			var cmMgr = this;
			__timer = window.setInterval(function(){
				var elapsed = new Date().getTime() - lastTPos;
				lastTPos = new Date().getTime();
				cmMgr.onTimerEvent(elapsed,cmMgr);
				cmMgr.sendQueueLoader();
			},1e3/60);
			this.paused = false;
			this.pausedTime = Date.now() - pauseTime;
		};
		this.stopTimer = function(){
			window.clearInterval(__timer);
			__timer = 0;
			this.paused = true;
			pauseTime = Date.now();
		};
		var prevOpacity = this.options.global.opacity,
		ticking=false,
		canvasFPS=0,
		onScreenCommentCount=0,
		autoOpacity = function(){
			if(self.options.global.autoOpacity){
				if(self.options.global.useCSS){
					self.stage.style.opacity = autoOpacityFromComment(onScreenCommentCount);
				}else{
					self.options.global.autoOpacityVal = self.options.global.opacity * autoOpacityFromComment(onScreenCommentCount);
				}
			}
		};
		setInterval(function(){
			self.canvasFPS = canvasFPS;
			canvasFPS = 0;
		},1e3);
		this.addEventListener('enterComment',function(){
			onScreenCommentCount++;
			autoOpacity();
		});
		this.addEventListener('exitComment',function(){
			onScreenCommentCount--;
			autoOpacity();
		});
		this.canvasDrawerWrapper = function(now){
			if(ticking)return;
			if(!now)now=performance.now();
			ticking=true;
			canvasFPS++;
			self.canvasDrawer(now|0);
			ticking=false;
		};
		this.ttlRecalcAll=function(){
			this.runline.forEach(ttlRecalc);
		};
		var sendQueue=[];
		this.send = function(data){
			sendQueue.push(data);
		}
		this.sendQueueLoader = function(){
			var start = performance.now(),passed;
			sendQueue.length && self.sendAsync(sendQueue.shift());
			/*while(sendQueue.length > 0){
				self.sendAsync(sendQueue.shift());
				passed = performance.now()-start;
				if(passed > 5)
					return;
			}*/
		}
		this.addEventListener('clear',function(){
			sendQueue=[];
		});

		requestAnimationFrame(this.canvasDrawerWrapper);
		(function(){
			var prevRatio = window.devicePixelRatio;
			window.addEventListener('resize',function(){
				var ratio = window.devicePixelRatio;
				if(prevRatio != ratio){
					self.runline.forEach(function(i){
						if(i.textData)
						commentCanvasDrawer(i, self.options.global.outline, self.options.global.shadow)
					})
					prevRatio = ratio;
				}
				self.ttlRecalcAll();
			})
		})()
	}

	/** Public **/
	CommentManager.prototype.stop = function(){
		this.stopTimer();
        for(var i = 0; i < this.runline.length; i++){
            if(typeof this.runline[i].stop !== "undefined"){
                this.runline[i].stop();
            }
        }
	};

	CommentManager.prototype.start = function(){
		this.startTimer();
	};

	CommentManager.prototype.seek = function(time){
		this.position = BinArray.bsearch(this.timeline, time, function(a,b){
			if(a < b.stime) return -1
			else if(a > b.stime) return 1;
			else return 0;
		});
	};

	CommentManager.prototype.validate = function(cmt){
		if(cmt == null)
			return false;
		return this.filter.doValidate(cmt);
	};

	CommentManager.prototype.load = function(a){
		this.timeline = a;
		this.timeline.sort(function(a,b){
			if(a.stime > b.stime) return 2;
			else if(a.stime < b.stime) return -2;
			else{
				if(a.date > b.date) return 1;
				else if(a.date < b.date) return -1;
				else if(a.dbid != null && b.dbid != null){
					if(a.dbid > b.dbid) return 1;
					else if(a.dbid < b.dbid) return -1;
					return 0;
				}else
					return 0;
			}
		});
		this.dispatchEvent("load");
	};

	CommentManager.prototype.insert = function(c){
		var index = BinArray.binsert(this.timeline, c, function(a,b){
			if(a.stime > b.stime) return 2;
			else if(a.stime < b.stime) return -2;
			else{
				if(a.date > b.date) return 1;
				else if(a.date < b.date) return -1;
				else if(a.dbid != null && b.dbid != null){
					if(a.dbid > b.dbid) return 1;
					else if(a.dbid < b.dbid) return -1;
					return 0;
				}else
					return 0;
			}
		});
		if(index <= this.position){
			this.position++;
		}
		this.dispatchEvent("insert");
	};

	CommentManager.prototype.clear = function(){
		while(this.runline.length > 0){
			this.runline[0].finish();
		}
		this.dispatchEvent("clear");
		this._ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
        this._doms = [];
        this._caches = [];
	};

	CommentManager.prototype.setBounds = function(){
		this.width = this.stage.offsetWidth;
		this.height= this.stage.offsetHeight;
		this.dispatchEvent("resize");
		for(var comAlloc in this.csa){
			this.csa[comAlloc].setBounds(this.width,this.height);
		}
		// Update 3d perspective
		this.stage.style.perspective = this.width * Math.tan(40 * Math.PI/180) / 2 + "px";
		this.stage.style.webkitPerspective = this.width * Math.tan(40 * Math.PI/180) / 2 + "px";
		this.canvasResize();
	};
	CommentManager.prototype.init = function(){
		this.setBounds();
		if(this.filter == null) {
			this.filter = new CommentFilter(); //Only create a filter if none exist
		}
	};
	CommentManager.prototype.time = function(time){
		time = time - 1;
		if(this.position >= this.timeline.length || Math.abs(this._lastPosition - time) >= 2000){
			this.seek(time);
			this._lastPosition = time;
			if(this.timeline.length <= this.position) {
				return;
			}
		}else{
			this._lastPosition = time;
		}
		for(;this.position < this.timeline.length;this.position++){
			if(this.timeline[this.position]['stime']<=time){
				if(this.options.limit > 0 && this.runline.length > this.limiter) {
					continue; // Skip comments but still move the position pointer
				} else if(this.validate(this.timeline[this.position])){
					this.send(this.timeline[this.position]);
				}
			}else{
				break;
			}
		}
	};
	CommentManager.prototype.canvasResize = function(){
		try{
		var w=this.width,h=this.height,devicePixelRatio=window.devicePixelRatio;
		this.canvas.width = this.canvas.offsetWidth * devicePixelRatio;
		this.canvas.height = this.canvas.offsetHeight * devicePixelRatio;
        this.ttlRecalcAll();
        drawForResize = true;

		}catch(e){
			console.error('shit happened! forcing CSS! ',e.message);
			this.useCSS(true);
			return;
		}
	};
	var drawForResize = false;
	CommentManager.prototype.canvasDrawer = function(){
		if(this.options.global.useCSS){
			return;
		}
		if(this.paused && !drawForResize){
			requestAnimationFrame(this.canvasDrawerWrapper);
			return;
		}
		var now=performance.now()|0, cmt, i, devicePixelRatio = window.devicePixelRatio, pausedTime = this.pausedTime,
		ctx = this._ctx,
		canvasWidth = this.width, canvasHeight = this.height,
		x, y;
		ctx.clearRect(0, 0, canvasWidth * devicePixelRatio, canvasHeight * devicePixelRatio);
		ctx.globalAlpha=this.options.global.autoOpacity ? this.options.global.autoOpacityVal : this.options.global.opacity;
		ctx.imageSmoothingEnabled = false;

		if(pausedTime!=0){
			this.runline.forEach(function(cmt){
				if(!cmt.textData)return;
				switch(cmt.mode){
					case 1:
						cmt.prev += pausedTime;
					break;
					case 4:
					case 5:
						cmt.removeTime += pausedTime;
					break;
				}
			})
			this.pausedTime = 0;
		}

		var devicePixelRatio = window.devicePixelRatio;
		/*
		maxBottomLine=[0];
		maxBottomMaxWidth=[0],
		maxBottomHeight=[0],
		maxTopMaxWidth=[0],
		maxTopHeight=[0];
		this.runline.forEach(function(cmt){
			if(cmt.mode==1){
				maxBottomLine.push(cmt._y+cmt._height);
			} else if(cmt.mode == 4){
				maxBottomMaxWidth.push(cmt._width);
				maxBottomHeight.push(cmt._y+cmt._height);
			} else if(cmt.mode == 5) {
				maxTopMaxWidth.push(cmt._width);
				maxTopHeight.push(cmt._y+cmt._height);
			}
		});
		maxBottomLine=Math.max.apply(Math,maxBottomLine);
		maxBottomMaxWidth=Math.max.apply(Math,maxBottomMaxWidth);
		maxBottomHeight=Math.max.apply(Math,maxBottomHeight);
		maxTopMaxWidth=Math.max.apply(Math,maxTopMaxWidth);
		maxTopHeight=Math.max.apply(Math,maxTopHeight);*/

		//canvasDraw(this);
		/**
		 * 180303
		 * canvas重构
		 * 恢复全屏canvas
		 * 记录顶部高度进行部分擦除
		 * 0,0 到 width,滚动高
		 * 顶宽左,滚动高 到 顶宽右,顶高 （范围内不擦除）
		 * 底宽左,高-底高 到 底宽右,高 （范围按滚动高改动）
		 */
		/*
		if(cachedMaxBottomLine > 0){
			ctx.clearRect(0, 0, round(canvasWidth * devicePixelRatio), round(cachedMaxBottomLine * devicePixelRatio));
		}
		if(cachedFixedTopHeight>cachedMaxBottomLine) {
			ctx.clearRect(
				round((canvasWidth-cachedFixedTopMaxWidth)/2 * devicePixelRatio),
				round(cachedMaxBottomLine * devicePixelRatio),
				round((canvasWidth+cachedFixedTopMaxWidth)/2 * devicePixelRatio),
				round(cachedFixedTopHeight * devicePixelRatio)
			);
		}
		ctx.clearRect(
			round((canvasWidth-cachedFixedBottomMaxWidth)/2 * devicePixelRatio),
			round((Math.max(canvasHeight-cachedFixedBottomHeight, cachedMaxBottomLine)) * devicePixelRatio),
			round((canvasWidth+cachedFixedBottomMaxWidth)/2 * devicePixelRatio),
			round(canvasHeight * devicePixelRatio)
		);
		cachedMaxBottomLine=maxBottomLine;
		cachedFixedBottomMaxWidth=maxBottomMaxWidth;
		cachedFixedBottomHeight=maxBottomHeight;
		cachedFixedTopMaxWidth=maxTopMaxWidth;
		cachedFixedTopHeight=maxTopHeight;
		*/

		//ctx.globalAlpha = 1;
		//ctx.drawImage(window.abpinst.video, 0, 0);

		var cmMgr=this;

		//ctx.globalAlpha=cmMgr.options.global.autoOpacity ? cmMgr.options.global.autoOpacityVal : cmMgr.options.global.opacity;
		cmMgr.runline.forEach(function(cmt){
			if(!cmt.textData)return;
			switch(cmt.mode){
				case 1:
					//scroll
					if (!drawForResize) {
						cmt.rx += cmt.speed * ( now - cmt.prev ) / 1e3;
						cmt.prev = now;
						cmt.x = canvasWidth - cmt.rx;
					}
					x = (canvasWidth - cmt.rx);
					y = cmt.y;
				break;
				case 4:
					//bottom
					cmt.x = (canvasWidth - cmt.width) / 2;
					x = cmt.x;
					y = (canvasHeight - cmt.y - cmt.height);
				break;
				case 5:
					//top
					cmt.x = (canvasWidth - cmt.width) / 2;
					x = cmt.x;
					y = (cmt.y);
				break;
				default:
				return;
			}
			ctx.drawImage(cmt.textData, round(x * devicePixelRatio), round(y * devicePixelRatio));
		});
		//this.canvas.style.opacity = this.options.global.opacity;
        //this.canvas.getContext('2d').putImageData(ctx.getImageData(0, 0, this.canvas.width, this.canvas.height), 0, 0)
        drawForResize = false;
		requestAnimationFrame(this.canvasDrawerWrapper);
	};
	var prevMoving=false,ceil=Math.ceil,round=Math.round,colorGetter = function(color){
		var color = color.toString(16);
		while(color.length<6)
			color = '0'+color;
		return color;
		/*
		var r = (color >>> 16),
		g = (color >>> 8) & 0xff,
		b = color & 0xff;
		return [r,g,b];*/
	},ttlRecalc=function(cmt){
		if(cmt.speed){
			var runned = cmt.dur - cmt.ttl;
			cmt.dur = ( cmt.parent.width + cmt.width ) / cmt.speed * 1e3;
			cmt.ttl = cmt.dur - runned;
		}
	},commentCanvasDrawer = function(cmt, outline, shadow){
		var commentCanvas = cmt.textData || document.createElement('canvas');
        var commentCanvasCtx = commentCanvas.getContext('2d'), devicePixelRatio = window.devicePixelRatio;
		//commentCanvas.width = 1;
		//commentCanvas.height = 1;
		commentCanvasCtx.font = 'bold '+ (cmt.size * devicePixelRatio) + 'px ' + font;
		commentCanvasCtx.imageSmoothingEnabled = false;
		cmt.width = ceil(commentCanvasCtx.measureText(cmt.text).width / devicePixelRatio)+2;
		cmt.height = ceil(cmt.size+3)+2;
		cmt.oriWidth = ceil(cmt.width * devicePixelRatio);
		cmt.oriHeight = ceil(cmt.height * devicePixelRatio);

		commentCanvas.width = cmt.oriWidth;
		commentCanvas.height = cmt.oriHeight;
		commentCanvasCtx.font = 'bold '+ (cmt.size * devicePixelRatio) + 'px ' + font;
		commentCanvasCtx.lineWidth = .7 * devicePixelRatio;
		commentCanvasCtx.strokeStyle = (cmt._color == 0) ? '#FFFFFF' : '#000000';
		commentCanvasCtx.textBaseline = 'bottom';
		commentCanvasCtx.textAlign = 'left';

		if(shadow) {
			commentCanvasCtx.lineWidth = .25 * devicePixelRatio;
			commentCanvasCtx.shadowBlur = 2 * devicePixelRatio;
			commentCanvasCtx.shadowColor = (cmt._color == 0) ? '#FFFFFF' : '#000000';
		}
		commentCanvasCtx.fillStyle = '#' + colorGetter(cmt.color);
		commentCanvasCtx.fillText(cmt.text, 1, commentCanvas.height-1);
		if (outline)
			commentCanvasCtx.strokeText(cmt.text, 1, commentCanvas.height-1);

		if(cmt.border){
			commentCanvasCtx.lineWidth = round(2 * devicePixelRatio);
			commentCanvasCtx.strokeStyle = '#00ffff';
			commentCanvasCtx.shadowBlur = 0;
			commentCanvasCtx.strokeRect(0,0,commentCanvas.width,commentCanvas.height);
		}
		cmt.textData = commentCanvas;
	};
	CommentManager.prototype.getCommentFromPoint = function(x, y){
		var dmList=[],dx,dy,height=this.height;
		this.runline.forEach(function(i){
			dx=x-i.x;
			if(i.mode==4){
				dy=y-(height-i.y-i.height);
			}else
				dy=y-i.y;
			if(dx>=0&&dx<=i.width &&
					dy>=0&&dy<=i.height)
				dmList.push(i);
		});
		return dmList;
	};
	CommentManager.prototype.useCSS = function(state){
		this.options.global.useCSS = state;
		this.clear();
		if(!state){
			this.stage.style.opacity='';
			requestAnimationFrame(this.canvasDrawerWrapper);
		}
	};
	CommentManager.prototype.autoOpacity = function(state){
		this.options.global.autoOpacity = state;
	};
	CommentManager.prototype.sendAsync = function(data){
		if(data.mode === 8){
			if(this.scripting){
				this.scripting.eval(data.code);
			}
			return;
		}
		if(this.options.global.density > 0 && data.mode == 1 && data.border !== true && this.csa.scroll.length>=this.options.global.density) return false;
		if(this.filter != null){
			data = this.filter.doModify(data);
			if(data == null || data === false) return;
		}
        var cmt = null;
		//canvas break
		if(!this.options.global.useCSS && [1,4,5].indexOf(data.mode) != -1 ){
			var now = performance.now();
			cmt = new CoreComment(this, data);
			cmt.dom = {style:{}};
			commentCanvasDrawer(cmt, this.options.global.outline, this.options.global.shadow);
			if( data.mode == 1 || data.mode == 6){
				cmt.rx = 0;
				cmt.x = this.width;
				cmt.prev = now;
				cmt.speed = ( this.width + cmt.width ) / cmt.dur * 1e3;
			}else if ( data.mode == 4 || data.mode == 5 ){
				cmt.removeTime = now + cmt.dur;
			}
			switch(cmt.mode){
				default:
				case 1:{this.csa.scroll.add(cmt);}break;
				case 4:{this.csa.bottom.add(cmt);}break;
				case 5:{this.csa.top.add(cmt);}break;
			}
		}else{

			if(data.mode === 1 || data.mode === 2 || data.mode === 6){
				cmt = new CSSScrollComment(this, data);
			}else{
				cmt = new CoreComment(this, data);
			}
			switch(cmt.mode){
				case 1:cmt.align = 0;break;
				case 2:cmt.align = 2;break;
				case 4:cmt.align = 2;break;
				case 5:cmt.align = 0;break;
				case 6:cmt.align = 1;break;
			}
			cmt.init();
			this.stage.appendChild(cmt.dom);
			cmt.dom.transitionStartTime=(new Date).getTime();
			switch(cmt.mode){
				default:
				case 1:{this.csa.scroll.add(cmt);}break;
				case 2:{this.csa.scrollbtm.add(cmt);}break;
				case 4:{this.csa.bottom.add(cmt);}break;
				case 5:{this.csa.top.add(cmt);}break;
				case 6:{this.csa.reverse.add(cmt);}break;
				case 17:
				case 7:{
					if(data.rY !== 0 || data.rZ !== 0){
						/** TODO: revise when browser manufacturers make up their mind on Transform APIs **/
						cmt.dom.style.transform = getRotMatrix(data.rY, data.rZ);
						cmt.dom.style.webkitTransform = getRotMatrix(data.rY, data.rZ);
						cmt.dom.style.OTransform = getRotMatrix(data.rY, data.rZ);
						cmt.dom.style.MozTransform = getRotMatrix(data.rY, data.rZ);
						cmt.dom.style.MSTransform = getRotMatrix(data.rY, data.rZ);
					}
				}break;
			}
			cmt.y = cmt.y;
		}
        if (cmt) {
            cmt.originalData=data;
            this.dispatchEvent("enterComment", cmt);
            this.runline.push(cmt);
        }
	};
	CommentManager.prototype.finish = function(cmt){
		this.dispatchEvent("exitComment", cmt);
		if(cmt.dom && cmt.dom.nodeType)
			this.stage.removeChild(cmt.dom);
		var index = this.runline.indexOf(cmt);
		if(index >= 0){
			this.runline.splice(index, 1);
		}
		switch(cmt.mode){
			default:
			case 1:{this.csa.scroll.remove(cmt);}break;
			case 2:{this.csa.scrollbtm.remove(cmt);}break;
			case 4:{this.csa.bottom.remove(cmt);}break;
			case 5:{this.csa.top.remove(cmt);}break;
			case 6:{this.csa.reverse.remove(cmt);}break;
			case 7:break;
		}
		if(cmt.textData)
			cmt.textData = null;
        if(cmt.dom)
            cmt.dom = null;
	};
	CommentManager.prototype.resumeComment=function (){
		Array.prototype.slice.call(this.stage.children).forEach(function(a){
			a.classList.contains("cmt") &&
			a.classList.contains("paused") &&
			(
				a.style.transitionDuration=a.finalDuration+"ms",
				a.style.transform=a.finalTransform,
				a.transitionStartTime=(new Date).getTime(),
				a.classList.remove("paused")
			)
		})
	};
	CommentManager.prototype.pauseComment=function (){
		Array.prototype.slice.call(this.stage.children).forEach(function(a){
			a.classList.contains("cmt")&&
			!a.classList.contains("paused")&&
			(
				a.finalTransform=a.style.transform,
				a.style.transform=window.getComputedStyle(a).getPropertyValue("transform"),
				a.finalDuration=parseFloat(a.style.transitionDuration)-(new Date).getTime()+a.transitionStartTime,
				a.style.transitionDuration="10ms",
				a.classList.add("paused")
			)
		})
	};
	CommentManager.prototype.addEventListener = function(event, listener){
		if(typeof this._listeners[event] !== "undefined"){
			this._listeners[event].push(listener);
		}else{
			this._listeners[event] = [listener];
		}
	};
	CommentManager.prototype.dispatchEvent = function(event, data){
		if(typeof this._listeners[event] !== "undefined"){
			for(var i = 0; i < this._listeners[event].length; i++){
				try{
					this._listeners[event][i](data);
				}catch(e){
					console.error(e.stack);
				}
			}
		}
	};
	/** Static Functions **/
	CommentManager.prototype.onTimerEvent = function(timePassed,cmObj){
		for(var i= 0;i < cmObj.runline.length; i++){
			var cmt = cmObj.runline[i];
			if(cmt.hold){
				continue;
			}
			cmt.time(timePassed);
		}
	};
	return CommentManager;
})();

/**
 * AcFun Format Parser
 * Takes in JSON and parses it based on current documentation for AcFun comments
 * @license MIT License
 **/
var AcfunFormat = (function () {
    var AcfunFormat = {};

    AcfunFormat.JSONParser = function (params) {
        this._logBadComments = true;
        this._logNotImplemented = false;
        if (typeof params === 'object') {
            this._logBadComments = params.logBadComments === false ? false : true;
            this._logNotImplemented = params.logNotImplemented === true ? true : false;
        }
    };

    AcfunFormat.JSONParser.prototype.parseOne = function (comment) {
        // Read a comment and generate a correct comment object
        var data = {};
        if (typeof comment !== 'object' || comment == null || !comment.hasOwnProperty('c')) {
            // This cannot be parsed. The comment contains no config data
            return null;
        }
        var config = comment['c'].split(',');
        if (config.length >= 6) {
            data.stime = parseFloat(config[0]) * 1000;
            data.color = parseInt(config[1])
            data.mode = parseInt(config[2]);
            data.size = parseInt(config[3]);
            data.hash = config[4];
			data.date = parseInt(config[5]);
			data.dbid = config[6];
			data.pool = 0;
            data.position = "absolute";
            if (data.mode !== 7) {
                // Do some text normalization on low complexity comments
                data.text = comment.m.replace(/(\/n|\\n|\n|\r\n|\\r)/g,"\n");
                data.text = data.text.replace(/\r/g,"\n");
                data.text = data.text.replace(/\s/g,"\u00a0");
            } else {
                try {
                    var x = JSON.parse(comment.m);
                } catch (e) {
                    if (this._logBadComments) {
                        console.warn('Error parsing internal data for comment');
                        console.log('[Dbg] ' + data.text);
                    }
                    return null; // Can't actually parse this!
                }
                data.position = "relative";
                data.text = x.n; /*.replace(/\r/g,"\n");*/
                data.text = data.text.replace(/\ /g,"\u00a0");
                if (typeof x.a === 'number') {
                    data.opacity = x.a;
                } else {
                    data.opacity = 1;
                }
                if (typeof x.p === 'object') {
                    // Relative position
                    data.x = x.p.x / 1000;
                    data.y = x.p.y / 1000;
                } else {
                    data.x = 0;
                    data.y = 0;
                }
                if (typeof x.c === 'number') {
                    switch (x.c) {
                        case 0: data.align = 0; break;
                        case 2: data.align = 1; break;
                        case 6: data.align = 2; break;
                        case 8: data.align = 3; break;
                        default:
                            if (this._logNotImplemented) {
                                console.log('Cannot handle aligning to center! AlignMode=' + x.c);
                            }
                    }
                }
                // Use default axis
                data.axis = 0;
                data.shadow = x.b;
                data.dur = 4000;
                if (typeof x.l === 'number') {
                    data.dur = x.l * 1000;
                }
                if (x.z != null && x.z.length > 0) {
                    data.movable = true;
                    data.motion = [];
                    var moveDuration = 0;
                    var last = {
                        x: data.x,
                        y: data.y,
                        alpha: data.opacity,
                        color: data.color
                    };
                    for (var m = 0; m < x.z.length; m++) {
                        var dur = x.z[m].l != null ? (x.z[m].l * 1000) : 500;
                        moveDuration += dur;
                        var motion = {};
                        if (x.z[m].hasOwnProperty('rx') && typeof x.z[m].rx === 'number') {
                            // TODO: Support this
                            if (this._logNotImplemented) {
                                console.log('Encountered animated x-axis rotation. Ignoring.');
                            }
                        }
                        if (x.z[m].hasOwnProperty('e') && typeof x.z[m].e === 'number') {
                            // TODO: Support this
                            if (this._logNotImplemented) {
                                console.log('Encountered animated y-axis rotation. Ignoring.');
                            }
                        }
                        if (x.z[m].hasOwnProperty('d') && typeof x.z[m].d === 'number') {
                            // TODO: Support this
                            if (this._logNotImplemented) {
                                console.log('Encountered animated z-axis rotation. Ignoring.');
                            }
                        }
                        if (x.z[m].hasOwnProperty('x') && typeof x.z[m].x === 'number') {
                            motion.x = {
                                from: last.x,
                                to: x.z[m].x / 1000,
                                dur: dur,
                                delay: 0
                            };
                        }
                        if (x.z[m].hasOwnProperty('y') && typeof x.z[m].y === 'number') {
                            motion.y = {
                                from: last.y,
                                to: x.z[m].y / 1000,
                                dur: dur,
                                delay: 0
                            };
                        }
                        last.x = motion.hasOwnProperty('x') ? motion.x.to : last.x;
                        last.y = motion.hasOwnProperty('y') ? motion.y.to : last.y;
                        if (x.z[m].hasOwnProperty('t') &&
                            typeof x.z[m].t === 'number' &&
                            x.z[m].t !== last.alpha) {
                            motion.alpha = {
                                from: last.alpha,
                                to: x.z[m].t,
                                dur: dur,
                                delay: 0
                            };
                            last.alpha = motion.alpha.to;
                        }
                        if (x.z[m].hasOwnProperty('c') &&
                            typeof x.z[m].c === 'number' &&
                            x.z[m].c !== last.color) {
                            motion.color = {
                                from: last.color,
                                to:x.z[m].c,
                                dur: dur,
                                delay: 0
                            };
                            last.color = motion.color.to;
                        }
                        data.motion.push(motion);
                    }
                    data.dur = moveDuration + (data.moveDelay ? data.moveDelay : 0);
                }
                if (x.hasOwnProperty('w')) {
                    if (x.w.hasOwnProperty('f')) {
                        data.font = x.w.f;
                    }
                    if (x.w.hasOwnProperty('l') && Array.isArray(x.w.l)) {
                        if (x.w.l.length > 0) {
                            // Filters
                            if (this._logNotImplemented) {
                                console.log('[Dbg] Filters not supported! ' +
                                    JSON.stringify(x.w.l));
                            }
                        }
                    }
                }
                if (x.r != null && x.k != null) {
                    data.rX = x.r;
                    data.rY = x.k;
                }

            }
            return data;
        } else {
            // Not enough arguments.
            if (this._logBadComments) {
                console.warn('Dropping this comment due to insufficient parameters. Got: ' + config.length);
                console.log('[Dbg] ' + comment['c']);
            }
            return null;
        }
    };

    AcfunFormat.JSONParser.prototype.parseMany = function (comments) {
        if (!Array.isArray(comments)) {
            return null;
        }
        var list = [];
        for (var i = 0; i < comments.length; i++) {
            var comment = this.parseOne(comments[i]);
            if (comment !== null) {
                list.push(comment);
            }
        }
        return list;
    };

    AcfunFormat.TextParser = function (param) {
        this._jsonParser = new AcfunFormat.JSONParser(param);
    }

    AcfunFormat.TextParser.prototype.parseOne = function (comment) {
        try {
            return this._jsonParser.parseOne(JSON.parse(comment));
        } catch (e) {
            console.warn(e);
            return null;
        }
    }

    AcfunFormat.TextParser.prototype.parseMany = function (comment) {
        try {
            return this._jsonParser.parseMany(JSON.parse(comment));
        } catch (e) {
            console.warn(e);
            return null;
        }
    }

    return AcfunFormat;
})();
