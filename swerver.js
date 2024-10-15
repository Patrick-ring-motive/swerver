globalThis.AsyncFunction = async function() { }.constructor;
globalThis.await = _ => _;
globalThis.async = async a => await a();

globalThis.sleep = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

function isString(str) {
    return typeof str === 'string' || str instanceof String;
}

void async function MainThread() {
    const preswervers = [];
    for (let x of Array(10)) {
        preswervers.push(await startSwerver());
    }
    const swervers = (await Promise.allSettled(preswervers)).map(x => x.value);
    let swerverNum = 0;
    function nextSwerver() {
        const ns = swervers[swerverNum];
        swerverNum++;
        swerverNum %= swervers.length;
        return ns;
    }
    globalThis.spellFix = async function() {
        var n, a = [],
            walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        while (n = walk.nextNode()) {
            if (!n.textContent) { continue; }
            if (!String(n.textContent).trim().length) { continue; }
            await sleep(20);
            if (navigator?.scheduling?.isInputPending?.({ includeContinuous: true })) {
                continue;
            }
            const tag = String(n?.parentElement?.tagName).toLowerCase();
            if (~tag.search(/style|script/)) {
                continue;
            }
            a.push(n);
            let ntext = n.textContent;
            nwords = ntext.split(' ');
            nwords = (await Promise.allSettled(nwords.map(async x => {
                if (/[^a-zA-Z]/.test(x)) {
                    return x;
                }
                if (x.length < 3) {
                    return x;
                }
                let res = await nextSwerver().fetch('check', { method: 'POST', body: x });
                let check = await res.text();
                console.log(check);
                if (check == 'true') {
                    return x;
                }
                let y = await (await nextSwerver().fetch('suggest', { method: 'POST', body: x })).json();
                console.warn(y);
                return y[0] ?? x
            }))).map(x => x?.value);
            let nnext = nwords.join(' ');
            if (nnext == ntext) { continue; }
            console.warn(ntext, 'changing to', nnext);
            n.textContent = nnext;
        };
        return a;
    }
    spellFix();
}?.();

async function startSwerver() {
    const [requestChannel, responseChannel, appCache] = await Promise.all([
        caches.open('swerver-requests'),
        caches.open('swerver-responses'),
        caches.open('app')
    ]);
    requestChannel.send = async function send(workerId, request) {
        request.headers.set('Worker-Message-Id', workerId);
        request.headers.set('Vary', `Worker-Message-Id, ${workerId}`);
        request.headers.set('url', request.url);
        const obj = {};
        for (const x in request) {
            obj[x] = request[x];
        }
        delete obj.body;
        delete obj.method;
        obj.headers.set('method', request.method);
        return await requestChannel.put(new Request(location.origin + workerId + request.url, obj), new Response(request.body), obj);
    }

    if (!self?.window?.Worker) {
        return;
    }
    if (!globalThis.workerMessageMap) {
        globalThis.workerMessageMap = new Map();
    }

    function getWorkerMessageId(timeout = 10000) {
        const workerMessageId = ('WorkerMessageId' + new Date().getTime() + "" + performance.now() + "" + Math.random()).replaceAll('.', '_');
        const workerMessagePromise = {};
        workerMessagePromise.promise = new Promise((resolve, reject) => {
            workerMessagePromise.resolve = resolve;
            workerMessagePromise.reject = reject;
        });
        (async () => {
            await sleep(timeout);
            if (workerMessageMap.has(workerMessageId)) {
                workerMessagePromise?.reject?.('timeout');
            }
        })();
        workerMessageMap.set(workerMessageId, workerMessagePromise);
        return workerMessageId;
    }
    const swerver = new Worker(URL.createObjectURL(new Blob(['(' + Swerver + ')();'], { type: "text/javascript" })));
    swerver.ready = new Promise((resolve) => { swerver.readyResolve = resolve });
    swerver.ready.catch((reason) => swerver.readyResolve(reason));
    swerver.fetch = async function processWorkerMessage() {
        const request = new Request(...arguments)
        const workerId = getWorkerMessageId();
        await requestChannel.send(workerId, request);
        swerver.postMessage([workerId]);
        const workerPromise = workerMessageMap.get(workerId).promise;
        const workerReturnValue = await workerPromise;
        setTimeout(() => workerMessageMap.delete(workerId), 100);
        return workerReturnValue;
    }
    swerver.onmessage = async function receive(event) {
        const workerId = event.data[0];
        if (workerId == 'ready') {
            swerver.readyResolve();
            return;
        }
        await swerver.ready;
        let req = new Request(location.origin + workerId);
        const workerReturnValue = await responseChannel.match(req);
        setTimeout(() => responseChannel.delete(req), 100);
        workerMessageMap.get(workerId).resolve(workerReturnValue);
    }
    await swerver.ready;
    return swerver;
}






async function Swerver() {
    globalThis.AsyncFunction = async function() { }.constructor;
    globalThis.await = _ => _;
    globalThis.async = async a => await a();

    globalThis.sleep = (ms) => {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    };
    if (!self?.DedicatedWorkerGlobalScope) {
        return;
    }

    const [requestChannel, responseChannel, appCache, wordCache] = await Promise.all([
        caches.open('swerver-requests'),
        caches.open('swerver-responses'),
        caches.open('app'),
        caches.open('wordCache'),
    ]);
    requestChannel.receive = async function receive(workerId) {
        //console.log('request received',workerId)
        const key = (await requestChannel.keys()).find(x => (x?.headers?.get?.('Worker-Message-Id') == workerId));
        const obj = {};
        for (const x in key) {
            obj[x] = key[x];
        }
        const res = await requestChannel.match(key) ?? new Response(null, { status: 404 });
        obj.method = String(key.headers.get('method'));
        if (!/GET|HEAD/.test(obj.method)) {
            obj.body = await res.arrayBuffer();;
        }
        setTimeout(() => requestChannel.delete(key), 100);
        return new Request(key.headers.get('url') ?? key.url, obj);
    }
    async function fetchText() {
        return await (await fetch(...arguments)).text();
    }
    globalThis.suggestions = {};
    globalThis.checks = {};
    async function zfetchText() {
        try {
            const req = new Request(...arguments);
            const res = await appCache.match(req);
            if (res) {
                return await res.text();
            }
            try { return await fetchText(req); } catch (e) { return e.message; }
        } catch (e) {
            console.log(e, ...arguments);
        }
        try { return await fetchText(...arguments); } catch (e) { return e.message; }
    }

    const typoCdn = 'https://cdn.jsdelivr.net/npm/typo-js@1.2.4/';

    eval?.((await zfetchText(`${typoCdn}typo.min.js`)).replace('var Type', 'globalThis.Typo'));
    const [aff, dic] = await Promise.all([
        zfetchText(`${typoCdn}dictionaries/en_US/en_US.aff`),
        zfetchText(`${typoCdn}dictionaries/en_US/en_US.dic`)
    ]);
    const dictionary = new Typo("en_US", aff, dic);
    //console.log('asdf', dictionary.check(''));

    async function setWordCache(key, val) {
        return await wordCache.put('https://' + key, new Response(JSON.stringify(val)));
    }

    async function getWordCache(key) {
        return (await (await wordCache.match('https://' + key))?.text?.());
    }

    const routes = [
        [/check$/, async (request) => {
            const text = await request.text();
            if (globalThis.checks[text]) {
                return new Response(globalThis.checks[text]);
            }
            const test = dictionary.check(text);
            globalThis.checks[text] = test;
            return new Response(test);
        }],
        [/suggest$/, async (request) => {
            const text = await request.text();
            console.log(text);
            if (globalThis.suggestions[text]) {
                return new Response(JSON.stringify(globalThis.suggestions[text]));
            }
            const cacheWord = await getWordCache(text);
            if (cacheWord) {
                globalThis.suggestions[text] = JSON.parse(cacheWord);
                return new Response(cacheWord);
            }
            let firstWords = dictionary.suggest(text);
            let words = firstWords ?? [];
            words = words.filter(x => !/[0-9]/.test(x));
            if (!words.length) {
                words = firstWords.map(x => x.replace(/[0-9]/g, String.fromCharCode(x + 97)));
            }
            if (!words.length) {
                if (/k/i.test(text)) {
                    firstWords = dictionary.suggest(text).replace(/k/ig, 'c');
                    words = firstWords ?? [];
                    words = words.filter(x => !/[0-9]/.test(x));
                    if (!words.length) {
                        words = firstWords.map(x => x.replace(/[0-9]/g, String.fromCharCode(x + 97))).filter(x => x.trim());
                    }
                }
            }
            if (!words.length) {
                if (/v/i.test(text)) {
                    firstWords = dictionary.suggest(text).replace(/v/ig, 'w');
                    words = firstWords ?? [];
                    words = words.filter(x => !/[0-9]/.test(x));
                    if (!words.length) {
                        words = firstWords.map(x => x.replace(/[0-9]/g, x => String.fromCharCode(x + 97))).filter(x => x.trim());
                    }
                }
            }
            globalThis.suggestions[text] = words;
            setWordCache(text, words);
            return new Response(JSON.stringify(words));
        }],
    ];

    function matchRoute(url) {
        return routes.find(x => x[0].test(url))?.[1];
    }

    function onRequest(req) {
        return matchRoute(req.url)?.(req) ?? new Response('Not Found', { status: 404 });
    }


    self.onmessage = async function(event) {
        try {
            const workerId = event.data[0];
            const request = await requestChannel.receive(workerId);
            //console.log('awdf',location.origin,request)
            const response = await onRequest(request);
            await responseChannel.put(new Request(location.origin + workerId), response);
            self.postMessage([workerId]);
        } catch (e) {
            try {
                //console.log(e);
                await responseChannel.put(new Request(location.origin + workerId), new Response(e.message, { status: 500 }));
                self.postMessage([event.data[0], e.message]);
            } catch {
                self.postMessage([event.data[0], e.message]);
            }
        }
    }
    self.postMessage(['ready']);
}



