/*
  EFB Iframe App - a minimal MSFS 2024 EFB app that shows a web page in an <iframe>.

  Plain JavaScript, no build step. It uses two globals the EFB provides:
    window.EFB_API   the EFB container (exposes use())
    window.msfssdk   @microsoft/msfs-sdk (DisplayComponent, FSComponent, Subject)

  =====================  WHAT YOU MAY CHANGE  =====================
  Only the CONFIG block below. Everything else should stay as is.

  If you rename the app (INTERNAL_NAME), these four things MUST stay identical,
  otherwise the sim silently ignores the app:
    1. INTERNAL_NAME below                          e.g. 'MyMapApp'
    2. this file's name                             e.g. MyMapApp.js
    3. the folder it lives in                       PackageSources/MyMapApp/
    4. <OutputDir> in the package definition XML    ...\efb_apps\MyMapApp\
  (see README.md, section "Renaming the app")
  =================================================================
*/
(function () {
  'use strict';

  // ------------------------------- CONFIG -------------------------------

  // CHANGE ME: the page to embed. Use plain http:// and 127.0.0.1 for a local server
  // (not "localhost": it can resolve to IPv6 ::1 while your server listens on IPv4).
  var IFRAME_URL = 'http://127.0.0.1:8080/';

  // CHANGE ME: name shown in the EFB app list.
  var APP_NAME = 'Iframe App';

  // CHANGE ME (optional): internal id. No spaces. Must match the file/folder name (see above).
  // Do NOT use "TemplateApp": it collides with other EFB add-ons.
  var INTERNAL_NAME = 'IframeApp';

  var VERSION = '1.0.0';

  // Optional: a URL that answers a plain GET with HTTP 200 AND the header
  // "Access-Control-Allow-Origin: *". If set, the app shows an "unreachable" notice
  // and auto-reloads the frame once the server comes up. Leave '' to disable.
  var HEALTH_CHECK_URL = '';

  // Show the thin status bar at the bottom (frame loading state + URL).
  var SHOW_STATUS_BAR = true;

  // ----------------------------- END CONFIG -----------------------------

  var EFB_API_VERSION = '1.0.3';
  var BASE_URL = 'coui://html_ui/efb_ui/efb_apps/' + INTERNAL_NAME;
  var BAR_HEIGHT = SHOW_STATUS_BAR ? 24 : 0;
  var HEALTH_POLL_MS = 2000;
  var STYLE_ID = 'efb-iframe-app-style-' + INTERNAL_NAME;

  function getSdk() {
    return window.msfssdk || (typeof msfssdk !== 'undefined' ? msfssdk : null);
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    // Deliberately plain CSS (no calc(), variables, grid): the sim's browser is old.
    var css =
      '.ifa-root{position:absolute;left:0;top:0;right:0;bottom:0;width:100%;height:100%;' +
      'overflow:hidden;background:#1b2630;}' +
      '.ifa-frame-host{position:absolute;left:0;top:0;right:0;bottom:' + BAR_HEIGHT + 'px;overflow:hidden;}' +
      '.ifa-frame{position:absolute;left:0;top:0;width:100%;height:100%;border:0;background:#ffffff;}' +
      '.ifa-bar{position:absolute;left:0;right:0;bottom:0;height:' + BAR_HEIGHT + 'px;width:100%;' +
      'padding:0 10px;box-sizing:border-box;font:12px/24px Arial,sans-serif;color:#dfe7ee;' +
      'background:#111a22;white-space:nowrap;overflow:hidden;}' +
      '.ifa-msg{position:absolute;left:50%;top:50%;width:70%;margin-left:-35%;margin-top:-50px;' +
      'padding:16px;box-sizing:border-box;text-align:center;font:16px/22px Arial,sans-serif;' +
      'color:#fff;background:rgba(160,30,30,.92);border-radius:8px;z-index:5;}' +
      '.ifa-hidden{display:none;}';
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.type = 'text/css';
    el.appendChild(document.createTextNode(css));
    document.head.appendChild(el);
  }

  function makeViewClass(sdk) {
    return class IframeAppView extends sdk.DisplayComponent {
      constructor(props) {
        super(props);
        this.rootRef = sdk.FSComponent.createRef();
        this.frameHost = sdk.FSComponent.createRef();
        this.frame = null;
        this.frameLoaded = false;
        this.serverOk = null; // null = unknown / check disabled
        this.healthTimer = null;
        this.destroyed = false;
        this.barEl = null;
        this.msgEl = null;
        // The EFB may route gamepad/page-key events to the view; harmless no-ops.
        this.pageKeyActions = new Map();
      }

      render() {
        var h = sdk.FSComponent.buildComponent;
        return h('div', { class: 'ifa-root', ref: this.rootRef },
          h('div', { class: 'ifa-frame-host', ref: this.frameHost }),
          h('div', { class: 'ifa-msg ifa-hidden' }),
          h('div', { class: SHOW_STATUS_BAR ? 'ifa-bar' : 'ifa-bar ifa-hidden' }, APP_NAME + ' ' + VERSION)
        );
      }

      onAfterRender() {
        var root = this.rootRef.instance;
        if (!root) return;
        this.barEl = root.querySelector('.ifa-bar');
        this.msgEl = root.querySelector('.ifa-msg');
        this.createFrame();
        this.startHealthCheck();
      }

      createFrame() {
        var host = this.frameHost.instance;
        if (!host || this.destroyed) return;
        if (this.frame && this.frame.parentNode) this.frame.parentNode.removeChild(this.frame);

        var self = this;
        var f = document.createElement('iframe');
        f.className = 'ifa-frame';
        f.setAttribute('frameborder', '0');
        f.onload = function () {
          self.frameLoaded = true;
          self.updateBar();
        };
        this.frameLoaded = false;
        this.frame = f;
        host.appendChild(f);
        f.src = IFRAME_URL;
        this.updateBar();
      }

      startHealthCheck() {
        if (!HEALTH_CHECK_URL) return;
        var self = this;
        this.stopHealthCheck();
        this.checkHealth();
        this.healthTimer = window.setInterval(function () { self.checkHealth(); }, HEALTH_POLL_MS);
      }

      stopHealthCheck() {
        if (this.healthTimer !== null) {
          window.clearInterval(this.healthTimer);
          this.healthTimer = null;
        }
      }

      checkHealth() {
        if (this.destroyed || !HEALTH_CHECK_URL) return;
        var self = this;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', HEALTH_CHECK_URL + (HEALTH_CHECK_URL.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now());
        xhr.timeout = 1500;
        xhr.onreadystatechange = function () {
          if (xhr.readyState !== 4 || self.destroyed) return;
          var ok = xhr.status === 200;
          var wasOk = self.serverOk;
          self.serverOk = ok;
          // Server came up after the app was opened: (re)load the page.
          if (ok && wasOk === false) self.createFrame();
          self.updateBar();
        };
        try { xhr.send(); } catch (e) {
          this.serverOk = false;
          this.updateBar();
        }
      }

      updateBar() {
        if (this.barEl && SHOW_STATUS_BAR) {
          var parts = [APP_NAME + ' ' + VERSION, 'frame: ' + (this.frameLoaded ? 'loaded' : 'loading')];
          if (HEALTH_CHECK_URL) {
            parts.push('server: ' + (this.serverOk === null ? 'checking...' : (this.serverOk ? 'OK' : 'UNREACHABLE')));
          }
          parts.push(IFRAME_URL);
          this.barEl.textContent = parts.join('  |  ');
        }
        if (this.msgEl) {
          if (this.serverOk === false) {
            this.msgEl.textContent = 'Cannot reach ' + IFRAME_URL + ' - is your server running? ' +
              'This page loads automatically once it is up.';
            this.msgEl.className = 'ifa-msg';
          } else {
            this.msgEl.className = 'ifa-msg ifa-hidden';
          }
        }
      }

      // EFB lifecycle (see efb_api AppView.d.ts in the MSFS SDK EFB sample).
      onOpen() { this.startHealthCheck(); }
      onResume() { this.startHealthCheck(); }
      onPause() { this.stopHealthCheck(); }
      onClose() { this.stopHealthCheck(); }
      onUpdate() {}
      routeGamepadInteractionEvent() {}
      handlePageKeyAction() {}

      destroy() {
        this.destroyed = true;
        this.stopHealthCheck();
        if (this.frame) {
          this.frame.onload = null;
          this.frame.src = 'about:blank';
        }
        super.destroy();
      }
    };
  }

  function register() {
    var sdk = getSdk();
    var efb = window.EFB_API;
    if (!sdk || !efb || typeof efb.use !== 'function') return false;

    injectStyle();
    var View = makeViewClass(sdk);

    class IframeApp {
      constructor() {
        this.available = sdk.Subject.create(true);
        this.BootMode = 0;     // AppBootMode.COLD
        this.SuspendMode = 0;  // AppSuspendMode.SLEEP
        this._isReady = false;
        this._favoriteIndex = -1;
        this.bus = null;
      }

      get name() { return APP_NAME; }
      get internalName() { return INTERNAL_NAME; }
      get icon() { return BASE_URL + '/Assets/app-icon.svg'; }
      get isReady() { return this._isReady; }
      get favoriteIndex() { return this._favoriteIndex; }
      set favoriteIndex(value) { this._favoriteIndex = value; }
      get compatibleAircraftModels() { return undefined; }
      get unitsSettingsManager() { return this._unitsSettingsManager; }
      getIsSearchable() { return true; }
      getIsFavoritable() { return true; }
      getVersion() { return VERSION; }

      async install() { /* nothing to load: the page comes from IFRAME_URL */ }

      async _install(props) {
        this.bus = props && props.bus;
        this._unitsSettingsManager = props && props.unitsSettingManager;
        this.notificationManager = props && props.notificationManager;
        this.efbSettingsManager = props && props.efbSettingsManager;
        this.options = props && props.options;
        await this.install(props);
        this._isReady = true;
        try {
          if (window.Coherent && typeof window.Coherent.trigger === 'function') {
            window.Coherent.trigger('EFB_APP_INSTALLED', APP_NAME, INTERNAL_NAME, EFB_API_VERSION, VERSION);
          }
        } catch (_) { /* informational only */ }
      }

      render() {
        return sdk.FSComponent.buildComponent(View, { bus: this.bus });
      }
    }

    // use() throws until the EFB has handed over its bus; the caller retries.
    efb.use(IframeApp);
    return true;
  }

  // The EFB OS and this script load independently: retry until both are ready.
  var tries = 0;
  var retry = window.setInterval(function () {
    tries += 1;
    var done = false;
    try { done = register(); } catch (e) { done = false; }
    if (done || tries > 200) window.clearInterval(retry);
  }, 50);
})();
