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

import {
  getProtocols,
  getClients,
  getDefaultClient,
  getClientById,
  getClientByDomain,
  buildIntentUrl,
  resolvePreference,
  migrateLocalPreference,
} from './destinations.js';
import { getPublicPreference } from './pds.js';
import { resolveIdentity } from './identity.js';
import { getAuthUrl, checkSession, signOut, getSession, putPreference, handleAuthCallback } from './auth-proxy.js';

import blueskyIcon from './icons/bluesky.svg?raw';
import mastodonIcon from './icons/mastodon.svg?raw';
import linkedinIcon from './icons/linkedin.svg?raw';
import xIcon from './icons/x.svg?raw';
import threadsIcon from './icons/threads.svg?raw';

const ICONS = {
  'bluesky.svg': blueskyIcon,
  'mastodon.svg': mastodonIcon,
  'linkedin.svg': linkedinIcon,
  'x.svg': xIcon,
  'threads.svg': threadsIcon,
};

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
      min-width: 220px;
      max-width: 280px;
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

    /* --- Protocol buttons (default view) --- */
    .protocol-btn {
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
      position: relative;
      box-sizing: border-box;
    }
    .protocol-btn:hover {
      background: var(--atshare-bg-hover, #f8fafc);
    }
    .protocol-btn.preferred {
      background: var(--atshare-preferred-bg, rgba(0, 0, 0, 0.02));
    }
    .protocol-btn .proto-icon {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .protocol-btn .proto-icon svg {
      width: 18px;
      height: 18px;
    }
    .protocol-btn .proto-label {
      flex: 1;
      min-width: 0;
    }
    .protocol-btn .proto-name {
      font-weight: 500;
    }
    .protocol-btn .proto-via {
      font-size: 11px;
      color: #94a3b8;
      margin-left: 4px;
    }
    .protocol-btn .proto-check {
      font-size: 12px;
      margin-left: 2px;
      flex-shrink: 0;
    }
    .protocol-btn .proto-chevron {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 3px;
      flex-shrink: 0;
      cursor: pointer;
      transition: background 0.1s;
    }
    .protocol-btn .proto-chevron:hover {
      background: rgba(0, 0, 0, 0.06);
    }
    .protocol-btn .proto-chevron svg {
      width: 14px;
      height: 14px;
      transition: transform 0.15s;
    }
    .protocol-btn .proto-chevron.expanded svg {
      transform: rotate(90deg);
    }

    /* --- Client sub-list (expanded) --- */
    .client-list {
      padding: 2px 0 2px 20px;
    }
    .client-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 6px 10px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--atshare-color, #0f172a);
      font-size: 13px;
      cursor: pointer;
      text-align: left;
    }
    .client-btn:hover {
      background: var(--atshare-bg-hover, #f8fafc);
    }
    .client-btn.preferred {
      font-weight: 500;
    }
    .client-btn .client-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .client-btn .client-check {
      margin-left: auto;
      font-size: 11px;
      flex-shrink: 0;
    }

    /* --- More destinations link --- */
    .more-link {
      display: block;
      width: 100%;
      padding: 6px 10px;
      margin-top: 2px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: #64748b;
      font-size: 12px;
      cursor: pointer;
      text-align: left;
    }
    .more-link:hover {
      background: var(--atshare-bg-hover, #f8fafc);
      color: #475569;
    }

    /* --- Full list view --- */
    .full-list {
      display: none;
    }
    .full-list.visible {
      display: block;
    }
    .full-list .back-link {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px 8px;
      border: none;
      background: transparent;
      color: #64748b;
      font-size: 12px;
      cursor: pointer;
    }
    .full-list .back-link:hover {
      color: #475569;
    }
    .full-list .back-link svg {
      width: 12px;
      height: 12px;
    }
    .full-list-section {
      margin-bottom: 4px;
    }
    .full-list-section .section-header {
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .full-list-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 7px 10px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--atshare-color, #0f172a);
      font-size: 13px;
      cursor: pointer;
      text-align: left;
    }
    .full-list-item:hover {
      background: var(--atshare-bg-hover, #f8fafc);
    }
    .full-list-item .item-icon {
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .full-list-item .item-icon svg {
      width: 16px;
      height: 16px;
    }
    .full-list-item .item-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .full-list-item .item-check {
      margin-left: auto;
      font-size: 11px;
      flex-shrink: 0;
    }

    /* --- Clipboard --- */
    .clipboard-divider {
      height: 1px;
      background: var(--atshare-border, #e2e8f0);
      margin: 6px 0;
    }
    .clipboard-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 7px 10px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--atshare-color, #0f172a);
      font-size: 13px;
      cursor: pointer;
      text-align: left;
    }
    .clipboard-btn:hover {
      background: var(--atshare-bg-hover, #f8fafc);
    }
    .clipboard-btn svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    .divider {
      height: 1px;
      background: var(--atshare-border, #e2e8f0);
      margin: 6px 0;
    }

    /* --- Mastodon instance input --- */
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

    /* --- View mode --- */
    .default-view {
      display: block;
    }
    .default-view.hidden {
      display: none;
    }
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
      <div class="default-view">
        <div class="network-list"></div>
        <div class="mastodon-input-wrap">
          <label>Your Mastodon instance</label>
          <input type="url" placeholder="https://mastodon.social" class="mastodon-instance-input">
          <button class="mastodon-go-btn">Share</button>
        </div>
        <button class="more-link">More destinations</button>
      </div>
      <div class="full-list"></div>
      <div class="signin-zone state-idle">
        <button class="signin-link">Sign in</button>

        <div class="signin-handle-wrap">
          <label>Your ATProto handle</label>
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

const CHEVRON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
const BACK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
const COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

/**
 * Render an SVG icon for a client. If the client has an `icon` field, look it
 * up in ICONS and tint it. Otherwise render a small filled circle.
 * @param {object} client
 * @param {string} color - protocol brand color
 * @param {number} [size=18] - icon size in px
 * @returns {string} HTML string
 */
function renderClientIcon(client, color, size = 18) {
  // Validate color is a hex value (defense-in-depth against malicious registry data)
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#888888';

  if (client.icon && ICONS[client.icon]) {
    let svg = ICONS[client.icon];
    // Set fill, width, height on root <svg> element only (not child elements)
    svg = svg.replace(/<svg([^>]*)>/, (match, attrs) => {
      // Remove any existing fill/width/height from root attrs
      let cleaned = attrs
        .replace(/\s*fill="[^"]*"/g, '')
        .replace(/\s*width="[^"]*"/g, '')
        .replace(/\s*height="[^"]*"/g, '');
      return `<svg${cleaned} fill="${safeColor}" width="${size}" height="${size}" style="display:block">`;
    });
    return svg;
  }
  // Fallback: colored dot
  return `<span style="display:inline-block;width:${Math.round(size * 0.45)}px;height:${Math.round(size * 0.45)}px;border-radius:50%;background:${safeColor};"></span>`;
}

class AtshareSelector extends HTMLElement {
  static get observedAttributes() {
    return ['url', 'text', 'label'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(TEMPLATE.content.cloneNode(true));

    this._open = false;
    this._authenticated = false; // true when signed in via OAuth proxy
    this._authPopup = null;      // reference to the OAuth popup window

    // UI state for popover views
    this._expandedProtocol = null;        // null or protocol ID string
    this._viewMode = 'default';           // 'default' | 'full'
    this._pendingFediverseClientId = null; // client awaiting instance input
    this._clipboardTimeout = null;

    this._trigger = this.shadowRoot.querySelector('.trigger');
    this._popover = this.shadowRoot.querySelector('.popover');
    this._defaultView = this.shadowRoot.querySelector('.default-view');
    this._networkList = this.shadowRoot.querySelector('.network-list');
    this._mastodonWrap = this.shadowRoot.querySelector('.mastodon-input-wrap');
    this._mastodonInput = this.shadowRoot.querySelector('.mastodon-instance-input');
    this._mastodonGoBtn = this.shadowRoot.querySelector('.mastodon-go-btn');
    this._moreLink = this.shadowRoot.querySelector('.more-link');
    this._fullList = this.shadowRoot.querySelector('.full-list');
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

    this._moreLink.addEventListener('click', () => this._showFullList());

    this._onDocumentClick = (e) => {
      // composedPath() pierces Shadow DOM — only close if click was outside this element
      if (!e.composedPath().includes(this)) {
        this._closePopover();
      }
    };
  }

  connectedCallback() {
    document.addEventListener('click', this._onDocumentClick, { passive: true });
    this._render();
    this._tryRestoreSession();
    this._tryBackgroundPreferenceRead();
  }

  disconnectedCallback() {
    document.removeEventListener('click', this._onDocumentClick);
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
   * Does NOT change sign-in state — just populates checkmarks on networks.
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
    const pdsPref = await getPublicPreference(pdsEndpoint, did);
    if (pdsPref) {
      const resolved = resolvePreference(pdsPref);
      if (resolved) {
        // Hydrate localStorage from PDS
        const localPref = {
          primaryNetwork: resolved.protocolId,
          preferredClient: resolved.clientId,
        };
        if (resolved.instance) localPref.mastodonInstance = resolved.instance;
        try { localStorage.setItem('atshare.preference', JSON.stringify(localPref)); } catch {}
      }
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

  // ---------------------------------------------------------------------------
  // Default view: protocol buttons with chevrons
  // ---------------------------------------------------------------------------

  _renderNetworks() {
    this._networkList.innerHTML = '';
    const localPref = this._getLocalPreference();

    for (const protocol of getProtocols()) {
      // "other" protocol doesn't get a top-level button
      if (protocol.id === 'other') continue;

      const defaultClient = getDefaultClient(protocol.id);
      if (!defaultClient) continue;

      // Determine the preferred client for this protocol
      const isPreferred = localPref?.primaryNetwork === protocol.id;
      const preferredClientId = isPreferred ? localPref.preferredClient : null;
      const preferredClient = preferredClientId ? getClientById(preferredClientId) : null;
      const displayClient = preferredClient || defaultClient;

      // Build the protocol button row
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-direction:column;';

      const btn = document.createElement('button');
      btn.className = 'protocol-btn';
      if (isPreferred) {
        btn.classList.add('preferred');
        btn.style.background = this._hexToRgba(protocol.color, 0.06);
      }

      // Icon
      const iconWrap = document.createElement('span');
      iconWrap.className = 'proto-icon';
      iconWrap.innerHTML = renderClientIcon(displayClient, protocol.color);
      btn.appendChild(iconWrap);

      // Label + via text
      const labelWrap = document.createElement('span');
      labelWrap.className = 'proto-label';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'proto-name';
      nameSpan.textContent = protocol.label;
      labelWrap.appendChild(nameSpan);

      if (isPreferred && preferredClient) {
        const viaSpan = document.createElement('span');
        viaSpan.className = 'proto-via';
        viaSpan.textContent = `via ${preferredClient.name}`;
        labelWrap.appendChild(viaSpan);
      }

      btn.appendChild(labelWrap);

      // Checkmark (if preferred)
      if (isPreferred) {
        const check = document.createElement('span');
        check.className = 'proto-check';
        check.style.color = protocol.color;
        check.textContent = '\u2713';
        btn.appendChild(check);
      }

      // Chevron
      const chevron = document.createElement('span');
      chevron.className = 'proto-chevron';
      if (this._expandedProtocol === protocol.id) {
        chevron.classList.add('expanded');
      }
      chevron.innerHTML = CHEVRON_SVG;
      chevron.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleExpanded(protocol.id);
      });
      btn.appendChild(chevron);

      // Click the button area (not chevron) to share
      btn.addEventListener('click', (e) => {
        if (e.target.closest('.proto-chevron')) return;
        this._handleClientShare(displayClient);
      });

      row.appendChild(btn);

      // Expanded client sub-list
      if (this._expandedProtocol === protocol.id) {
        const clientListEl = this._renderClientList(protocol, localPref);
        row.appendChild(clientListEl);
      }

      this._networkList.appendChild(row);
    }
  }

  // ---------------------------------------------------------------------------
  // Expanded client sub-list
  // ---------------------------------------------------------------------------

  /**
   * Render the client sub-list for an expanded protocol.
   * @param {object} protocol
   * @param {object|null} localPref — current preference (passed to avoid redundant reads)
   * @returns {HTMLElement}
   */
  _renderClientList(protocol, localPref) {
    const wrap = document.createElement('div');
    wrap.className = 'client-list';

    const isPreferredProtocol = localPref?.primaryNetwork === protocol.id;

    for (const client of getClients(protocol.id)) {
      const btn = document.createElement('button');
      btn.className = 'client-btn';

      const isPreferredClient = isPreferredProtocol && localPref?.preferredClient === client.id;
      if (isPreferredClient) {
        btn.classList.add('preferred');
      }

      // Colored dot
      const dot = document.createElement('span');
      dot.className = 'client-dot';
      dot.style.background = isPreferredClient ? protocol.color : '#cbd5e1';
      btn.appendChild(dot);

      // Name
      const nameSpan = document.createElement('span');
      nameSpan.textContent = client.name;
      btn.appendChild(nameSpan);

      // Checkmark for preferred
      if (isPreferredClient) {
        const check = document.createElement('span');
        check.className = 'client-check';
        check.style.color = protocol.color;
        check.textContent = '\u2713';
        btn.appendChild(check);
      }

      btn.addEventListener('click', () => this._handleClientShare(client));
      wrap.appendChild(btn);
    }

    return wrap;
  }

  // ---------------------------------------------------------------------------
  // Full list view
  // ---------------------------------------------------------------------------

  _showFullList() {
    this._viewMode = 'full';
    this._defaultView.classList.add('hidden');
    this._renderFullList();
    this._fullList.classList.add('visible');
  }

  _hideFullList() {
    this._viewMode = 'default';
    this._fullList.classList.remove('visible');
    this._fullList.innerHTML = '';
    this._defaultView.classList.remove('hidden');
  }

  _renderFullList() {
    this._fullList.innerHTML = '';

    // Back link
    const backBtn = document.createElement('button');
    backBtn.className = 'back-link';
    backBtn.innerHTML = `${BACK_SVG} <span>Back</span>`;
    backBtn.addEventListener('click', () => this._hideFullList());
    this._fullList.appendChild(backBtn);

    const localPref = this._getLocalPreference();

    // Render all protocols
    for (const protocol of getProtocols()) {
      const section = document.createElement('div');
      section.className = 'full-list-section';

      const header = document.createElement('div');
      header.className = 'section-header';
      header.style.color = protocol.color;
      header.textContent = protocol.label;
      section.appendChild(header);

      for (const client of getClients(protocol.id)) {
        const item = document.createElement('button');
        item.className = 'full-list-item';

        const isPreferred = localPref?.primaryNetwork === protocol.id
          && localPref?.preferredClient === client.id;

        // Icon or dot
        if (client.icon && ICONS[client.icon]) {
          const iconWrap = document.createElement('span');
          iconWrap.className = 'item-icon';
          iconWrap.innerHTML = renderClientIcon(client, protocol.color, 16);
          item.appendChild(iconWrap);
        } else {
          const dot = document.createElement('span');
          dot.className = 'item-dot';
          dot.style.background = protocol.color;
          item.appendChild(dot);
        }

        // Name
        const nameSpan = document.createElement('span');
        nameSpan.textContent = client.name;
        item.appendChild(nameSpan);

        // Checkmark
        if (isPreferred) {
          const check = document.createElement('span');
          check.className = 'item-check';
          check.style.color = protocol.color;
          check.textContent = '\u2713';
          item.appendChild(check);
        }

        item.addEventListener('click', () => this._handleClientShare(client, () => this._hideFullList()));
        section.appendChild(item);
      }

      this._fullList.appendChild(section);
    }

    // Clipboard divider + button
    const clipDivider = document.createElement('div');
    clipDivider.className = 'clipboard-divider';
    this._fullList.appendChild(clipDivider);

    const clipBtn = document.createElement('button');
    clipBtn.className = 'clipboard-btn';
    clipBtn.innerHTML = `${COPY_SVG} <span>Copy to clipboard</span>`;
    clipBtn.addEventListener('click', () => this._onClipboardCopy());
    this._fullList.appendChild(clipBtn);
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  _toggleExpanded(protocolId) {
    this._expandedProtocol = this._expandedProtocol === protocolId ? null : protocolId;
    this._mastodonWrap.classList.remove('visible');
    this._renderNetworks();
  }

  /**
   * Shared handler for selecting a client from any view. Checks if the client
   * needs an instance URL; if so, shows the input or shares with the stored one.
   * @param {object} client
   * @param {Function} [afterShare] — called after a successful share (e.g. hide full list)
   */
  _handleClientShare(client, afterShare) {
    if (client.requiresInstance) {
      const storedInstance = this._getMastodonInstance();
      if (storedInstance) {
        this._share(client.id, { instance: storedInstance });
        afterShare?.();
      } else {
        afterShare?.();
        this._mastodonWrap.classList.add('visible');
        this._pendingFediverseClientId = client.id;
      }
      return;
    }
    this._share(client.id);
    afterShare?.();
  }

  async _onClipboardCopy() {
    try {
      await navigator.clipboard.writeText(this.shareText);
      const btn = this.shadowRoot.querySelector('.clipboard-btn span');
      if (!btn) return;
      clearTimeout(this._clipboardTimeout);
      btn.textContent = 'Copied!';
      this._clipboardTimeout = setTimeout(() => { btn.textContent = 'Copy to clipboard'; }, 2000);
    } catch {}
  }

  _togglePopover() {
    this._open ? this._closePopover() : this._openPopover();
  }

  _openPopover() {
    this._open = true;
    this._viewMode = 'default';
    this._expandedProtocol = null;
    this._mastodonWrap.classList.remove('visible');
    this._fullList.classList.remove('visible');
    this._fullList.innerHTML = '';
    this._defaultView.classList.remove('hidden');
    this._renderNetworks();
    this._popover.classList.add('open');
  }

  _closePopover() {
    this._open = false;
    this._popover.classList.remove('open');
  }

  _onMastodonGo() {
    const instance = this._mastodonInput.value.trim();
    if (!instance) return;
    const instanceUrl = instance.startsWith('http') ? instance : `https://${instance}`;
    this._prefillMastodonInput(instanceUrl);
    const clientId = this._pendingFediverseClientId || 'mastodon';
    this._pendingFediverseClientId = null;
    this._share(clientId, { instance: instanceUrl });
  }

  _share(clientId, opts = {}) {
    const intentUrl = buildIntentUrl(clientId, {
      text: this.shareText,
      url: this.shareUrl,
      title: this.getAttribute('title') || '',
      instance: opts.instance,
    });
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
    this._expandedProtocol = null;
    this._closePopover();
    this._persistPreference(clientId, opts);
  }

  _persistPreference(clientId, opts = {}) {
    const client = getClientById(clientId);
    if (!client) return;

    // Write new flat format to localStorage
    const localPref = {
      primaryNetwork: client.protocolId,
      preferredClient: clientId,
    };
    if (opts.instance) {
      localPref.mastodonInstance = opts.instance;
    }
    try {
      localStorage.setItem('atshare.preference', JSON.stringify(localPref));
    } catch {}

    // Write PDS-format preference (fire-and-forget) if authenticated
    const session = getSession();
    if (session) {
      const pdsPref = {
        primaryNetwork: client.protocolId === 'atproto' ? 'bluesky' : 'mastodon',
        networks: [],
      };
      if (client.protocolId === 'atproto') {
        pdsPref.networks.push({ type: 'atproto', appView: `https://${client.domain || 'bsky.app'}` });
      } else if (opts.instance) {
        pdsPref.networks.push({ type: 'activitypub', instance: opts.instance });
      }
      putPreference(session.sub, pdsPref).catch(() => {});
    }
  }

  _getLocalPreference() {
    try {
      const raw = JSON.parse(localStorage.getItem('atshare.preference') || 'null');
      if (!raw) return null;
      const migrated = migrateLocalPreference(raw);
      // Write back migrated format if it changed
      if (migrated && raw.networks) {
        localStorage.setItem('atshare.preference', JSON.stringify(migrated));
      }
      return migrated;
    } catch {
      return null;
    }
  }

  _getMastodonInstance() {
    const pref = this._getLocalPreference();
    return pref?.mastodonInstance || null;
  }

  _prefillMastodonInput(instanceUrl) {
    // Pre-fill for next time
    this._mastodonInput.value = instanceUrl;
  }

  /**
   * Convert a hex color to rgba with given alpha.
   * @param {string} hex
   * @param {number} alpha
   * @returns {string}
   */
  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
    this._renderNetworks();
    this._setSigninState('idle');
    this._signinHandleInput.value = '';
  }
}

customElements.define('atshare-selector', AtshareSelector);
