# acfunhtmlbiliver
modified from [esterTion/AcFun-HTML5-Player](https://github.com/esterTion/AcFun-HTML5-Player) make it could use in tampermonkey, but there are many scripts need to require.

The most change is that we should use `GM_xmlhttpRequest` function for cross domain requests in this case we will lose benefit using native `fetch` function.

These scripts mainly based on [flv.js](https://github.com/Bilibili/flv.js) also mp4 segments file support add from [esterTion/flv.js](https://github.com/esterTion/flv.js)
I just merge them together and make some change, so the flv.js file is from a branch in [flv.js](https://github.com/zwjhuhu/flv.js/tree/tmloader)
  



