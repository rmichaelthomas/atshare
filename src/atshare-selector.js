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
import { signIn, checkSession, signOut, getSession, putPreference } from './auth-proxy.js';

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
      content: "✓";
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

    /* State: signed-out — single "Enter handle to load preference" link */
    .signin-prompt {
      display: none;
      font-size: 12px;
      color: #94a3b8;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      text-align: left;
    }
    .signin-prompt:hover { color: #64748b; }

    /* State: handle-input */
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
    .signin-handle-wrap .signin-continue-btn {
      align-self: flex-end;
      padding: 5px 12px;
      border: none;
      border-radius: 4px;
      background: var(--atshare-accent, #1d4ed8);
      color: #fff;
      font-size: 13px;
      cursor: pointer;
    }

    /* State: waiting (popup open) */
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

    /* State: signed-in */
    .signin-info {
      display: none;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: #475569;
    }
    .signin-info .signin-handle { font-weight: 500; }
    .signin-info .signin-signout-btn {
      font-size: 11px;
      color: #94a3b8;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
    }
    .signin-info .signin-signout-btn:hover { color: #64748b; }

    /* Visibility helpers — applied to parent .signin-zone */
    .signin-zone.state-signedout  .signin-prompt      { display: block; }
    .signin-zone.state-handle     .signin-handle-wrap { display: flex; }
    .signin-zone.state-waiting    .signin-waiting      { display: flex; }
    .signin-zone.state-signedin   .signin-info         { display: flex; }
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
      <div class="signin-zone state-signedout">
        <button class="signin-prompt">Enter handle to load preference</button>

        <div class="signin-handle-wrap">
          <label>Your AT Protocol handle</label>
          <input type="text" class="signin-handle-input" placeholder="rob.bsky.social" autocomplete="username" spellcheck="false">
          <span class="signin-error"></span>
          <button class="signin-continue-btn">Continue</button>
        </div>

        <div class="signin-waiting">
          <span>Loading preference…</span>
          <button class="signin-cancel-btn">Cancel</button>
        </div>

        <div class="signin-info">
          <span class="signin-handle"></span>
          <button class="signin-signout-btn">Forget</button>
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

    this._session = null;       // AT Protocol session (future OAuth integration)
    this._preference = null;    // cached preference record
    this._open = false;

    this._trigger = this.shadowRoot.querySelector('.trigger');
    this._popover = this.shadowRoot.querySelector('.popover');
    this._networkList = this.shadowRoot.querySelector('.network-list');
    this._mastodonWrap = this.shadowRoot.querySelector('.mastodon-input-wrap');
    this._mastodonInput = this.shadowRoot.querySelector('.mastodon-instance-input');
    this._mastodonGoBtn = this.shadowRoot.querySelector('.mastodon-go-btn');
    this._labelText = this.shadowRoot.querySelector('.label-text');

    // Sign-in zone elements
    this._signinZone        = this.shadowRoot.querySelector('.signin-zone');
    this._signinPrompt      = this.shadowRoot.querySelector('.signin-prompt');
    this._signinHandleWrap  = this.shadowRoot.querySelector('.signin-handle-wrap');
    this._signinHandleInput = this.shadowRoot.querySelector('.signin-handle-input');
    this._signinError       = this.shadowRoot.querySelector('.signin-error');
    this._signinContinueBtn = this.shadowRoot.querySelector('.signin-continue-btn');
    this._signinWaiting     = this.shadowRoot.querySelector('.signin-waiting');
    this._signinCancelBtn   = this.shadowRoot.querySelector('.signin-cancel-btn');
    this._signinInfo        = this.shadowRoot.querySelector('.signin-info');
    this._signinHandle      = this.shadowRoot.querySelector('.signin-handle');
    this._signinSignoutBtn  = this.shadowRoot.querySelector('.signin-signout-btn');

    // Event listeners for sign-in zone
    this._signinPrompt.addEventListener('click', () => this._setSigninState('handle'));
    this._signinContinueBtn.addEventListener('click', () => this._onSigninContinue());
    this._signinHandleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._onSigninContinue();
    });
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
    this._tryLoadSavedHandle();
  }

  async _tryRestoreSession() {
    try {
      const { did } = await checkSession();
      if (!did) return;
      // Server session exists — user previously signed in via OAuth
      // The handle lookup will display the handle; this just confirms auth for writes
    } catch {}
  }

  async _tryLoadSavedHandle() {
    try {
      const handle = localStorage.getItem('atshare.handle');
      if (!handle) return;
      const { did, pdsEndpoint } = await resolveIdentity(handle);
      const pref = await getPublicPreference(pdsEndpoint, did);
      if (pref) {
        this._preference = pref;
        this._renderNetworks();
      }
      this._setSigninState('signedin', { handle });
    } catch {}
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

    // Persist preference (PDS if authenticated, localStorage as Phase 2 fallback)
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

  /**
   * Switch the sign-in zone to one of: 'signedout' | 'handle' | 'waiting' | 'signedin'
   * @param {'signedout'|'handle'|'waiting'|'signedin'} state
   * @param {object} [opts]
   * @param {string} [opts.handle] - display handle for 'signedin' state
   * @param {string} [opts.errorMsg] - error message for 'handle' state
   */
  _setSigninState(state, opts = {}) {
    this._signinZone.className = `signin-zone state-${state}`;

    // Clear error on state transitions (unless explicitly setting one)
    if (state !== 'handle' || !opts.errorMsg) {
      this._signinError.textContent = '';
      this._signinError.classList.remove('visible');
      this._signinHandleInput.classList.remove('error');
    }

    if (state === 'handle' && opts.errorMsg) {
      this._signinError.textContent = opts.errorMsg;
      this._signinError.classList.add('visible');
      this._signinHandleInput.classList.add('error');
    }

    if (state === 'signedin' && opts.handle) {
      this._signinHandle.textContent = `✓ ${opts.handle}`;
    }
  }

  async _onSigninContinue() {
    const handle = this._signinHandleInput.value.trim();
    if (!handle) return;
    this._setSigninState('waiting');
    try {
      const { did, pdsEndpoint } = await resolveIdentity(handle);
      const pref = await getPublicPreference(pdsEndpoint, did);
      if (pref) {
        this._preference = pref;
        this._renderNetworks();
      }
      try { localStorage.setItem('atshare.handle', handle); } catch {}
      this._setSigninState('signedin', { handle });
    } catch (err) {
      this._setSigninState('handle', { errorMsg: "Couldn't find that handle" });
    }
  }

  _onSigninCancel() {
    this._setSigninState('signedout');
  }

  async _onSignOut() {
    try { await signOut(); } catch {} // revoke server session
    try { localStorage.removeItem('atshare.handle'); } catch {}
    this._preference = null;
    this._renderNetworks();
    this._setSigninState('signedout');
    this._signinHandleInput.value = '';
  }
}

customElements.define('atshare-selector', AtshareSelector);
