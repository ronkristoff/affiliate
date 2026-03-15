/**
 * salig-affiliate Tracking Library
 * Self-contained, async-loading JavaScript snippet for affiliate tracking
 * 
 * Usage:
 * <script src="/track.js" data-key="YOUR_PUBLIC_KEY" async></script>
 */

(function(window, document) {
  'use strict';

  // Prevent double initialization
  if (window.SaligAffiliate && window.SaligAffiliate._initialized) {
    return;
  }

  var SaligAffiliate = {
    config: {
      cookieName: '_salig_aff',
      cookieExpiry: 30, // days
      apiBase: '/api/tracking',
      retryAttempts: 3,
      retryDelay: 1000, // ms
    },

    key: null,
    _initialized: false,

    /**
     * Initialize the tracking library
     */
    init: function() {
      var script = document.currentScript;
      
      if (!script) {
        this.log('error', 'No script element found');
        return;
      }

      this.key = script.getAttribute('data-key');
      
      if (!this.key) {
        this.log('error', 'Missing data-key attribute');
        return;
      }

      this._initialized = true;
      this.log('info', 'Initializing with key: ' + this.key);
      
      // Send initial verification ping
      this.sendPing();
      
      // Set up click event listeners
      this.setupClickTracking();
    },

    /**
     * Send verification ping to the server
     */
    sendPing: function() {
      var self = this;
      var data = {
        publicKey: this.key,
        domain: window.location.hostname,
        url: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
      };

      this.fetchWithRetry(
        this.config.apiBase + '/ping',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          keepalive: true,
        },
        function(success) {
          if (success) {
            self.log('info', 'Ping sent successfully');
          }
        }
      );
    },

    /**
     * Fetch with retry logic
     */
    fetchWithRetry: function(url, options, callback) {
      var self = this;
      var attempt = 0;

      function attemptFetch() {
        fetch(url, options)
          .then(function(response) {
            callback(response.ok);
          })
          .catch(function(error) {
            attempt++;
            if (attempt < self.config.retryAttempts) {
              self.log('warn', 'Fetch failed, retrying in ' + self.config.retryDelay + 'ms');
              setTimeout(attemptFetch, self.config.retryDelay * attempt);
            } else {
              self.log('error', 'Fetch failed after ' + attempt + ' attempts');
              callback(false);
            }
          });
      }

      attemptFetch();
    },

    /**
     * Set attribution cookie
     */
    setCookie: function(affiliateCode) {
      if (!affiliateCode) {
        return;
      }

      var expires = new Date();
      expires.setDate(expires.getDate() + this.config.cookieExpiry);

      var cookieValue = encodeURIComponent(affiliateCode);
      var cookieString = this.config.cookieName + '=' + cookieValue +
        ';expires=' + expires.toUTCString() +
        ';path=/' +
        ';SameSite=Lax';

      // Add secure flag if on HTTPS
      if (window.location.protocol === 'https:') {
        cookieString += ';Secure';
      }

      document.cookie = cookieString;
      this.log('info', 'Cookie set: ' + affiliateCode);
    },

    /**
     * Get attribution cookie value
     */
    getCookie: function() {
      var name = this.config.cookieName + '=';
      var decodedCookie = decodeURIComponent(document.cookie);
      var cookies = decodedCookie.split(';');

      for (var i = 0; i < cookies.length; i++) {
        var cookie = cookies[i].trim();
        if (cookie.indexOf(name) === 0) {
          return cookie.substring(name.length);
        }
      }

      return null;
    },

    /**
     * Clear attribution cookie
     */
    clearCookie: function() {
      document.cookie = this.config.cookieName + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;';
      this.log('info', 'Cookie cleared');
    },

    /**
     * Set up click tracking for referral links
     */
    setupClickTracking: function() {
      var self = this;
      var affiliateCode = this.getCookie();

      if (!affiliateCode) {
        return;
      }

      // Add affiliate code to all outbound links
      var links = document.querySelectorAll('a[href^="http"]');
      
      for (var i = 0; i < links.length; i++) {
        (function(link) {
          var href = link.getAttribute('href');
          
          // Only modify links that don't already have the affiliate param
          if (href && href.indexOf('ref=') === -1 && href.indexOf(window.location.hostname) === -1) {
            var separator = href.indexOf('?') === -1 ? '?' : '&';
            var newHref = href + separator + 'ref=' + encodeURIComponent(affiliateCode);
            link.setAttribute('href', newHref);
          }
        })(links[i]);
      }
    },

    /**
     * Log messages (only in debug mode)
     */
    log: function(level, message) {
      // Check for debug mode
      var debug = document.currentScript && document.currentScript.getAttribute('data-debug');
      if (debug !== 'true' && level === 'error') {
        console.error('[SaligAffiliate] ' + message);
      } else if (debug === 'true') {
        console.log('[SaligAffiliate] ' + message);
      }
    },

    /**
     * Get full attribution data from cookie
     * Returns object with code, clickId, tenantId, and timestamp
     */
    getAttributionData: function() {
      var cookieValue = this.getCookie();
      if (!cookieValue) {
        return null;
      }

      try {
        // Try to parse as base64 encoded JSON (new format)
        var decoded = atob(cookieValue);
        var data = JSON.parse(decoded);
        return {
          code: data.code || cookieValue,
          clickId: data.clickId || null,
          tenantId: data.tenantId || null,
          timestamp: data.timestamp || null,
        };
      } catch (e) {
        // Fallback to simple code format (legacy)
        return {
          code: cookieValue,
          clickId: null,
          tenantId: null,
          timestamp: null,
        };
      }
    },

    /**
     * Set attribution data with full context
     */
    setAttributionData: function(code, clickId, tenantId) {
      var data = {
        code: code,
        clickId: clickId,
        tenantId: tenantId,
        timestamp: Date.now(),
      };
      var encoded = btoa(JSON.stringify(data));
      this.setCookie(encoded);
      this.log('info', 'Attribution data set: ' + code);
    },

    /**
     * Public API (Legacy compatibility)
     */
    getAffiliateCode: function() {
      var data = this.getAttributionData();
      return data ? data.code : null;
    },

    setAffiliateCode: function(code) {
      this.setAttributionData(code, null, null);
    },

    clearAffiliateCode: function() {
      this.clearCookie();
    },
  };

  // Auto-initialize when DOM is ready
  function initialize() {
    SaligAffiliate.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    // DOM already loaded
    initialize();
  }

  // Expose to global scope
  window.SaligAffiliate = SaligAffiliate;

})(window, document);
