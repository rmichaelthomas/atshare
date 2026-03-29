/**
 * <atshare-selector> web component
 *
 * Attributes:
 *   url      - The URL to share (required)
 *   text     - Optional share text (prepended to URL)
 *   label    - Button label (default: "Share")
 *
 * Usage:
 *   <atshare-selector url="https://example.com/post/123" text="Check this out"></atshare-selector>
 */

import { NETWORKS, buildIntentUrl } from './networks.js';
import { getPublicPreference } from './pds.js';
import { resolveIdentity } from './identity.js';
import { getAuthUrl, checkSession, signOut, getSession, putPreference, handleAuthCallback } from './auth-proxy.js';

const TEMPLATE = document.createElement('template');
TEMPLATE.innerHTML = `
  <style>
    :host {
      display: inline-block;
      font-family: inherit;
    }

    .trigger {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border: 1px solid var(--atshare-border, #e2e8f0);
      border-radius: var(--atshare-radius, 6px);
      background: var(--atshare-bg, #ffffff);
      color: var(--atshare-color, #0f172a);
      font-size: var(--atshare-font-size, 14px);
      cursor: pointer;
      user-select: none;
      transition: background 0.15s;
    }
    .trigger:hover {
      background: var(--atshare-bg-hover, #f8fafc);
    }
    .trigger svg {
      width: 15px;
      height: 15px;
      flex-shrink: 0;
    }

    .popover {
      display: none;
      position: absolute;
      z-index: 9999;
      min-width: 200px;
      padding: 8px;
      margin-top: 6px;
      border: 1px solid var(--atshare-border, #e2e8f0);
      border-radius: var(--atshare-radius, 6px);
      background: var(--atshare-bg, #ffffff);
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    }
    .popover.open {
      display: block;
    }

    .network-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 10px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--atshare-color, #0f172a);
      font-size: 14px;
      cursor: pointer;
      text-align: left;
    }
    .network-btn:hover {
      background: var(--atshare-bg-hover, #f8fafc);
    }
    .network-btn.preferred::after {
      content: "\\2713";
      margin-left: auto;
      color: var(--atshare-accent, #1d4ed8);
      font-size: 12px;
    }

    .divider {
      height: 1px;
      background: var(--atshare-border, #e2e8f0);
      margin: 6px 0;
    }

    .mastodon-input-wrap {
      display: none;
      padding: 8px 10px;
      flex-direction: column;
      gap: 6px;
    }
    .mastodon-input-wrap.visible {
      display: flex;
    }
    .mastodon-input-wrap label {
      font-size: 12px;
      color: #64748b;
    }
    .mastodon-input-wrap input {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid var(--atshare-border, #e2e8f0);
      border-radius: 4px;
      font-size: 13px;
      box-sizing: border-box;
    }
    .mastodon-input-wrap button {
      align-self: flex-end;
      padding: 5px 12px;
      border: none;
      border-radius: 4px;
      background: var(--atshare-accent, #1d4ed8);
      color: #fff;
      font-size: 13px;
      cursor: pointer;
    }

    .footer {
      padding: 4px 10px 2px;
    }
    .footer a {
      font-size: 11px;
      color: #94a3b8;
      text-decoration: none;
    }
    .footer a:hover {
      color: #64748b;
    }

    /* --- Sign-in zone --- */
    .signin-zone {
      padding: 6px 10px;
    }

    /* idle: "Sign in" link */
    .signin-link {
      display: none;
      font-size: 12px;
      color: #94a3b8;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      text-align: left;
    }
    .signin-link:hover { color: #64748b; }

    /* input: handle form */
    .signin-handle-wrap {
      display: none;
      flex-direction: column;
      gap: 6px;
    }
    .signin-handle-wrap label {
      font-size: 12px;
      color: #64748b;
    }
    .signin-handle-wrap input {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid var(--atshare-border, #e2e8f0);
      border-radius: 4px;
      font-size: 13px;
      box-sizing: border-box;
    }
    .signin-handle-wrap input.error { border-color: #ef4444; }
    .signin-handle-wrap .signin-error {
      font-size: 11px;
      color: #ef4444;
      display: none;
    }
    .signin-handle-wrap .signin-error.visible { display: block; }
    .signin-handle-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .signin-btn {
      padding: 5px 12px;
      border: none;
      border-radius: 4px;
      background: var(--atshare-accent, #1d4ed8);
      color: #fff;
      font-size: 13px;
      cursor: pointer;
    }
    .signin-input-cancel-btn {
      font-size: 12px;
      color: #94a3b8;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
    }
    .signin-input-cancel-btn:hover { color: #64748b; }

    /* waiting */
    .signin-waiting {
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 12px;
      color: #64748b;
    }
    .signin-waiting .signin-cancel-btn {
      font-size: 12px;
      color: #94a3b8;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
    }
    .signin-waiting .signin-cancel-btn:hover { color: #64748b; }

    /* signedin */
    .signin-info {
      display: none;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: #475569;
    }
    .signin-info .signin-handle { font-weight: 500; }
    .signin-signout-btn {
      font-size: 11px;
      color: #94a3b8;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
    }
    .signin-signout-btn:hover { color: #64748b; }

    /* State visibility */
    .signin-zone.state-idle     .signin-link        { display: inline; }
    .signin-zone.state-input    .signin-handle-wrap  { display: flex; }
    .signin-zone.state-waiting  .signin-waiting      { display: flex; }
    .signin-zone.state-signedin .signin-info         { display: flex; }
  </style>

  <div style="position: relative; display: inline-block;">
    <button class="trigger" part="trigger">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
      <span class="label-text">Share</span>
    </button>

    <div class="popover" role="dialog" aria-label="Share to...">
      <div class="network-list"></div>
      <div class="mastodon-input-wrap">
        <label>Your Mastodon instance</label>
        <input type="url" placeholder="https://mastodon.social" class="mastodon-instance-input">
        <button class="mastodon-go-btn">Share</button>
      </div>
      <div class="signin-zone state-idle">
        <button class="signin-link">Sign in</button>

        <div class="signin-handle-wrap">
          <label>Your Bluesky handle</label>
          <input type="text" class="signin-handle-input" placeholder="your-handle.bsky.social" autocomplete="username" spellcheck="false">
          <span class="signin-error"></span>
          <div class="signin-handle-actions">
            <button class="signin-btn">Sign in</button>
            <button class="signin-input-cancel-btn">Cancel</button>
          </div>
        </div>

        <div class="signin-waiting">
          <span>Signing in\u2026</span>
          <button class="signin-cancel-btn">Cancel</button>
        </div>

        <div class="signin-info">
          <span class="signin-handle"></span>
          <button class="signin-signout-btn">Sign out</button>
        </div>
      </div>
      <div class="divider"></div>
      <div class="footer"><a href="https://atshare.social" target="_blank" rel="noopener">atShare</a></div>
    </div>
  </div>
`;

class AtshareSelector extends HTMLElement {
  static get observedAttributes() {
    return ['url', 'text', 'label'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(TEMPLATE.content.cloneNode(true));

    this._preference = null;    // cached preference record
    this._open = false;
    this._authenticated = false; // true when signed in via OAuth proxy
    this._authPopup = null;      // reference to the OAuth popup window

    this._trigger = this.shadowRoot.querySelector('.trigger');
    this._popover = this.shadowRoot.querySelector('.popover');
    this._networkList = this.shadowRoot.querySelector('.network-list');
    this._mastodonWrap = this.shadowRoot.querySelector('.mastodon-input-wrap');
    this._mastodonInput = this.shadowRoot.querySelector('.mastodon-instance-input');
    this._mastodonGoBtn = this.shadowRoot.querySelector('.mastodon-go-btn');
    this._labelText = this.shadowRoot.querySelector('.label-text');

    // Sign-in zone elements
    this._signinZone           = this.shadowRoot.querySelector('.signin-zone');
    this._signinLink           = this.shadowRoot.querySelector('.signin-link');
    this._signinHandleWrap     = this.shadowRoot.querySelector('.signin-handle-wrap');
    this._signinHandleInput    = this.shadowRoot.querySelector('.signin-handle-input');
    this._signinError          = this.shadowRoot.querySelector('.signin-error');
    this._signinBtn            = this.shadowRoot.querySelector('.signin-btn');
    this._signinInputCancelBtn = this.shadowRoot.querySelector('.signin-input-cancel-btn');
    this._signinWaiting        = this.shadowRoot.querySelector('.signin-waiting');
    this._signinCancelBtn      = this.shadowRoot.querySelector('.signin-cancel-btn');
    this._signinInfo           = this.shadowRoot.querySelector('.signin-info');
    this._signinHandle         = this.shadowRoot.querySelector('.signin-handle');
    this._signinSignoutBtn     = this.shadowRoot.querySelector('.signin-signout-btn');

    // Sign-in zone event listeners
    this._signinLink.addEventListener('click', () => this._setSigninState('input'));
    this._signinBtn.addEventListener('click', () => this._onSignIn());
    this._signinHandleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._onSignIn();
    });
    this._signinInputCancelBtn.addEventListener('click', () => this._setSigninState('idle'));
    this._signinCancelBtn.addEventListener('click', () => this._onSigninCancel());
    this._signinSignoutBtn.addEventListener('click', () => this._onSignOut());

    this._trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this._togglePopover();
    });

    this._mastodonGoBtn.addEventListener('click', () => this._onMastodonGo());
    this._mastodonInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._onMastodonGo();
    });

    document.addEventListener('click', (e) => {
      // composedPath() pierces Shadow DOM — only close if click was outside this element
      if (!e.composedPath().includes(this)) {
        this._closePopover();
      }
    }, { passive: true });
  }

  connectedCallback() {
    this._render();
    this._tryRestoreSession();
    this._tryBackgroundPreferenceRead();
  }

  /**
   * Check for an existing OAuth session (cookie) and restore signed-in state.
   */
  async _tryRestoreSession() {
    try {
      const { did } = await checkSession();
      if (!did) return;
      this._authenticated = true;
      const handle = localStorage.getItem('atshare.handle');
      if (handle) {
        this._setSigninState('signedin', { handle });
      }
    } catch {}
  }

  /**
   * Silently load preference from PDS using a previously saved handle.
   * Does NOT change sign-in state — just populates ✓ on networks.
   */
  async _tryBackgroundPreferenceRead() {
    try {
      const handle = localStorage.getItem('atshare.handle');
      if (!handle) return;
      await this._loadPreferenceForHandle(handle);
    } catch {}
  }

  /**
   * Resolve a handle and load their preference from PDS.
   * @param {string} handle
   */
  async _loadPreferenceForHandle(handle) {
    const { did, pdsEndpoint } = await resolveIdentity(handle);
    const pref = await getPublicPreference(pdsEndpoint, did);
    if (pref) {
      this._preference = pref;
      this._renderNetworks();
    }
  }

  attributeChangedCallback(name, _old, value) {
    if (name === 'label' && this._labelText) {
      this._labelText.textContent = value || 'Share';
    }
  }

  get shareUrl() {
    return this.getAttribute('url') || window.location.href;
  }

  get shareText() {
    const text = this.getAttribute('text');
    return text ? `${text} ${this.shareUrl}` : this.shareUrl;
  }

  _render() {
    const label = this.getAttribute('label') || 'Share';
    this._labelText.textContent = label;
    this._renderNetworks();
  }

  _renderNetworks() {
    this._networkList.innerHTML = '';
    for (const network of NETWORKS) {
      const btn = document.createElement('button');
      btn.className = 'network-btn';
      btn.dataset.networkId = network.id;
      if (this._preference?.primaryNetwork === network.id) {
        btn.classList.add('preferred');
      }
      btn.textContent = network.label;
      btn.addEventListener('click', () => this._onNetworkSelect(network.id));
      this._networkList.appendChild(btn);
    }
  }

  _togglePopover() {
    this._open ? this._closePopover() : this._openPopover();
  }

  _openPopover() {
    this._open = true;
    this._mastodonWrap.classList.remove('visible');
    this._popover.classList.add('open');
  }

  _closePopover() {
    this._open = false;
    this._popover.classList.remove('open');
  }

  _onNetworkSelect(networkId) {
    if (networkId === 'mastodon') {
      // Check if we have a stored instance
      const storedInstance = this._getMastodonInstance();
      if (storedInstance) {
        this._share('mastodon', { mastodonInstance: storedInstance });
      } else {
        this._mastodonWrap.classList.add('visible');
      }
      return;
    }
    this._share(networkId);
  }

  _onMastodonGo() {
    const instance = this._mastodonInput.value.trim();
    if (!instance) return;
    // Normalize instance URL
    const instanceUrl = instance.startsWith('http') ? instance : `https://${instance}`;
    this._setMastodonInstance(instanceUrl);
    this._share('mastodon', { mastodonInstance: instanceUrl });
  }

  _share(networkId, opts = {}) {
    const intentUrl = buildIntentUrl(networkId, this.shareText, opts);
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
    this._closePopover();

    // Persist preference (PDS if authenticated, localStorage always)
    this._persistPreference(networkId, opts);
  }

  _persistPreference(networkId, opts) {
    const pref = {
      primaryNetwork: networkId,
      networks: this._buildNetworksArray(networkId, opts),
    };
    try {
      localStorage.setItem('atshare.preference', JSON.stringify(pref));
    } catch {}
    // Write to PDS via server proxy if authenticated (fire-and-forget)
    const session = getSession();
    if (session) {
      putPreference(session.sub, pref).catch(() => {});
    }
  }

  _buildNetworksArray(primaryNetworkId, opts) {
    const networks = [];
    if (primaryNetworkId === 'bluesky') {
      networks.push({ type: 'atproto', appView: 'https://bsky.app' });
    } else if (primaryNetworkId === 'mastodon' && opts.mastodonInstance) {
      networks.push({ type: 'activitypub', instance: opts.mastodonInstance });
    }
    return networks;
  }

  _getMastodonInstance() {
    try {
      const pref = JSON.parse(localStorage.getItem('atshare.preference') || 'null');
      return pref?.networks?.find((n) => n.type === 'activitypub')?.instance || null;
    } catch (_) {
      return null;
    }
  }

  _setMastodonInstance(instanceUrl) {
    // Pre-fill for next time
    this._mastodonInput.value = instanceUrl;
  }

  // --- Sign-in state machine ---

  /**
   * Switch the sign-in zone to one of: 'idle' | 'input' | 'waiting' | 'signedin'
   * @param {'idle'|'input'|'waiting'|'signedin'} state
   * @param {object} [opts]
   * @param {string} [opts.handle] - display handle for 'signedin' state
   * @param {string} [opts.errorMsg] - error message for 'input' state
   */
  _setSigninState(state, opts = {}) {
    this._signinZone.className = `signin-zone state-${state}`;

    // Clear error on state transitions (unless explicitly setting one)
    if (state !== 'input' || !opts.errorMsg) {
      this._signinError.textContent = '';
      this._signinError.classList.remove('visible');
      this._signinHandleInput.classList.remove('error');
    }

    if (state === 'input') {
      // Pre-fill handle from localStorage if input is empty
      if (!this._signinHandleInput.value) {
        const saved = localStorage.getItem('atshare.handle');
        if (saved) this._signinHandleInput.value = saved;
      }
      if (opts.errorMsg) {
        this._signinError.textContent = opts.errorMsg;
        this._signinError.classList.add('visible');
        this._signinHandleInput.classList.add('error');
      }
      // Focus the input after a tick (allows CSS transition)
      setTimeout(() => this._signinHandleInput.focus(), 0);
    }

    if (state === 'signedin' && opts.handle) {
      this._signinHandle.textContent = `\u2713 ${opts.handle}`;
    }
  }

  /**
   * Sign in via OAuth popup.
   * Opens popup synchronously (avoids popup blockers), then fetches OAuth URL.
   * The popup sends the session token back via postMessage (no third-party cookies needed).
   */
  async _onSignIn() {
    const handle = this._signinHandleInput.value.trim();
    if (!handle) return;

    // Open popup IMMEDIATELY (synchronous with user gesture — avoids blockers)
    const popup = window.open('about:blank', 'atshare-auth', 'width=600,height=700');
    if (!popup) {
      this._setSigninState('input', { errorMsg: 'Popup blocked. Allow popups and try again.' });
      return;
    }
    popup.document.write('<p style="font-family:system-ui;color:#64748b;text-align:center;margin-top:40px">Redirecting\u2026</p>');
    this._authPopup = popup;
    this._setSigninState('waiting');

    try {
      // Fetch OAuth URL from server via iframe proxy (async — popup is already open)
      const url = await getAuthUrl(handle);
      popup.location.href = url;

      // Wait for the popup to send the session token via postMessage
      const { sessionId, did } = await this._waitForAuthMessage(popup);

      // Store the token in the iframe proxy for future API calls
      await handleAuthCallback(sessionId, did);

      // Session established — save handle, load preference
      this._authenticated = true;
      try { localStorage.setItem('atshare.handle', handle); } catch {}
      this._setSigninState('signedin', { handle });

      // Load preference from PDS in background
      this._loadPreferenceForHandle(handle).catch(() => {});
    } catch (err) {
      // Close popup if still open
      try { if (!popup.closed) popup.close(); } catch {}
      this._authPopup = null;
      if (err.message === 'Sign-in timed out' || err.message === 'Sign-in cancelled') {
        this._setSigninState('input');
      } else {
        this._setSigninState('input', { errorMsg: err.message || 'Sign-in failed' });
      }
    }
  }

  /**
   * Wait for the OAuth popup to send back the session token via postMessage,
   * or for the popup to close without sending (cancelled).
   * @param {Window} popup
   * @returns {Promise<{sessionId: string, did: string}>}
   */
  _waitForAuthMessage(popup) {
    return new Promise((resolve, reject) => {
      let settled = false;

      const onMessage = (e) => {
        if (settled) return;
        const msg = e.data;
        if (!msg || msg.type !== 'atshare-auth-callback') return;
        settled = true;
        cleanup();
        this._authPopup = null;
        resolve({ sessionId: msg.sessionId, did: msg.did });
      };

      // Also poll for popup close (user closed it manually)
      const poll = setInterval(() => {
        if (settled) return;
        try {
          if (!popup.closed) return;
        } catch {
          return; // cross-origin access error — keep waiting
        }
        settled = true;
        cleanup();
        this._authPopup = null;
        reject(new Error('Sign-in cancelled'));
      }, 500);

      // Safety timeout
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        this._authPopup = null;
        reject(new Error('Sign-in timed out'));
      }, 120000);

      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        clearInterval(poll);
        clearTimeout(timeout);
      };

      window.addEventListener('message', onMessage);
    });
  }

  /**
   * Cancel sign-in — close popup if open, return to input state.
   */
  _onSigninCancel() {
    if (this._authPopup && !this._authPopup.closed) {
      try { this._authPopup.close(); } catch {}
    }
    this._authPopup = null;
    this._setSigninState('input');
  }

  /**
   * Sign out — revoke OAuth session, clear state, return to idle.
   */
  async _onSignOut() {
    try { await signOut(); } catch {}
    this._authenticated = false;
    try {
      localStorage.removeItem('atshare.handle');
      localStorage.removeItem('atshare.preference');
    } catch {}
    this._preference = null;
    this._renderNetworks();
    this._setSigninState('idle');
    this._signinHandleInput.value = '';
  }
}

customElements.define('atshare-selector', AtshareSelector);
