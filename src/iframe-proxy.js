/**
 * Iframe proxy client — communicates with the atShare proxy iframe
 * hosted on atshare.social via postMessage.
 *
 * This avoids third-party cookie restrictions by making API calls
 * from a first-party iframe context on atshare.social.
 *
 * The proxy iframe stores the session token in its own (partitioned)
 * localStorage, so sessions persist across page reloads within the
 * same embedding origin.
 */

const PROXY_ORIGIN = 'https://atshare.social';
const PROXY_URL = `${PROXY_ORIGIN}/proxy/`;

let _iframe = null;
let _ready = false;
let _readyPromise = null;
let _counter = 0;
const _pending = new Map();

/**
 * Ensure the hidden proxy iframe is loaded and ready.
 * @returns {Promise<void>}
 */
function ensureProxy() {
  if (_readyPromise) return _readyPromise;

  _readyPromise = new Promise((resolve, reject) => {
    // Listen for messages from the proxy iframe
    window.addEventListener('message', onMessage);

    _iframe = document.createElement('iframe');
    _iframe.src = PROXY_URL;
    _iframe.style.cssText = 'display:none;width:0;height:0;border:none;position:absolute;';
    _iframe.setAttribute('aria-hidden', 'true');
    _iframe.setAttribute('tabindex', '-1');
    _iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    _iframe.title = 'atShare proxy';
    document.body.appendChild(_iframe);

    // Timeout if proxy doesn't respond
    const timeout = setTimeout(() => {
      reject(new Error('atShare proxy iframe failed to load'));
    }, 10000);

    function onReady() {
      clearTimeout(timeout);
      _ready = true;
      resolve();
    }

    // Store the onReady callback for the message handler
    _onReadyCallback = onReady;
  });

  return _readyPromise;
}

let _onReadyCallback = null;

function onMessage(e) {
  // Only accept messages from atshare.social
  if (e.origin !== PROXY_ORIGIN) return;

  const msg = e.data;
  if (!msg) return;

  // Proxy ready signal
  if (msg.type === 'atshare-proxy-ready') {
    if (_onReadyCallback) {
      _onReadyCallback();
      _onReadyCallback = null;
    }
    return;
  }

  // Response to a request
  if (msg.type === 'atshare-proxy-response') {
    const handler = _pending.get(msg.id);
    if (!handler) return;
    _pending.delete(msg.id);

    if (msg.payload.error) {
      handler.reject(new Error(msg.payload.error));
    } else {
      handler.resolve(msg.payload.data);
    }
  }
}

/**
 * Send a request to the proxy iframe and wait for the response.
 * @param {string} action
 * @param {object} [data]
 * @returns {Promise<any>}
 */
export async function proxyRequest(action, data = {}) {
  await ensureProxy();

  const id = ++_counter;
  return new Promise((resolve, reject) => {
    _pending.set(id, { resolve, reject });

    _iframe.contentWindow.postMessage(
      { type: 'atshare-proxy-request', id, action, data },
      PROXY_ORIGIN
    );

    // Timeout individual requests
    setTimeout(() => {
      if (_pending.has(id)) {
        _pending.delete(id);
        reject(new Error('Proxy request timed out'));
      }
    }, 30000);
  });
}

/**
 * Store a session token in the proxy iframe's localStorage.
 * Called after the OAuth popup sends the token back via postMessage.
 * @param {string} token
 */
export async function storeToken(token) {
  return proxyRequest('storeToken', { token });
}
