/**
 * Affilio Tracking Library
 * Self-contained, async-loading JavaScript snippet for affiliate tracking
 * 
 * Usage:
 * <script src="/track.js" data-key="YOUR_PUBLIC_KEY" async></script>
 * 
 * After installing, add to your signup form:
 * Affilio.referral({ email: customerEmail });
 */

(function(window, document) {
  'use strict';

  // Prevent double initialization
  if (window.Affilio && window.Affilio._initialized) {
    return;
  }

  var Affilio = {
    config: {
      cookieName: '_affilio',
      cookieExpiry: 30, // days
      apiBase: '/api/tracking',
      retryAttempts: 3,
      retryDelay: 1000, // ms
    },

    key: null,
    tenantId: null,
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
      this.tenantId = script.getAttribute('data-tenant');
      
      if (!this.key) {
        this.log('error', 'Missing data-key attribute');
        return;
      }

      if (!this.tenantId) {
        this.log('warn', 'Missing data-tenant attribute - referral path interception disabled');
      }

      this._initialized = true;
      this.log('info', 'Initializing with key: ' + this.key);
      
      // Handle /ref/{code} path interception (MUST run before async work)
      this.handleReferralPath();
      
      // Send initial verification ping
      this.sendPing();
      
      // Set up click event listeners
      this.setupClickTracking();
    },

    /**
     * Record a referral lead when a customer signs up.
     * Call this on your signup form after collecting the customer's email.
     * 
     * @param {Object} data - { email: string, uid?: string }
     * 
     * Usage:
     *   Affilio.referral({ email: 'customer@example.com' });
     *   Affilio.referral({ email: 'customer@example.com', uid: 'cus_12345' });
     */
    referral: function(data) {
      if (!data || !data.email) {
        this.log('error', 'referral() requires an email address');
        return;
      }

      var self = this;
      var attributionData = this.getAttributionData() || {};
      var body = { email: data.email };
      if (data.uid) body.uid = data.uid;
      if (attributionData.code) body.affiliateCode = attributionData.code;
      if (attributionData.tenantId) body.tenantId = attributionData.tenantId;
      if (this.key) body.publicKey = this.key;

      fetch('/track/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(function(e) {
        self.log('error', 'referral() failed: ' + e.message);
      });

      // Fire referral health ping
      this.sendReferralPing(data.email);
    },

    /**
     * Send referral health ping for monitoring
     */
    sendReferralPing: function(email) {
      var domain = window.location.hostname.replace(/^www\./, '');
      var data = {
        publicKey: this.key,
        domain: domain,
        userAgent: navigator.userAgent,
        email: email || undefined,
      };

      this.fetchWithRetry(
        this.config.apiBase + '/referral-ping',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          keepalive: true,
        },
        function(success) {
          if (success) {
            // Silent success
          }
        }
      );
    },

    /**
     * Handle /ref/{code} path interception
     * Extracts referral code from URL, records click, sets cookie, and cleans URL
     */
    handleReferralPath: function() {
      if (!this.tenantId) {
        return;
      }

      var self = this;
      var path = window.location.pathname;
      
      // Match /ref/{code} pattern where code is 8 alphanumeric chars (excluding 0, O, I, 1)
      var match = path.match(/\/ref\/([A-HJ-NP-Z2-9]{8})$/i);
      
      if (!match) {
        return;
      }

      var code = match[1].toUpperCase();
      self.log('info', 'Referral code detected: ' + code);

      // Record click via API
      fetch('/track/click?code=' + encodeURIComponent(code) + '&t=' + encodeURIComponent(this.tenantId), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Click recording failed: ' + response.status);
        }
        return response.json();
      })
      .then(function(data) {
        if (data.success && data.attributionData) {
          // Set cookie with full attribution data
          self.setAttributionData(
            data.attributionData.affiliateCode,
            data.attributionData.clickId,
            data.attributionData.tenantId
          );
          self.log('info', 'Attribution data set from referral path');
        }

        // Clean URL by removing /ref/{code} using replaceState
        var cleanPath = path.replace(/\/ref\/[A-HJ-NP-Z2-9]{8}$/i, '');
        if (cleanPath === '') cleanPath = '/';
        
        var newUrl = window.location.protocol + '//' + window.location.host + cleanPath + window.location.search + window.location.hash;
        window.history.replaceState({}, '', newUrl);
        self.log('info', 'URL cleaned: ' + cleanPath);
      })
      .catch(function(error) {
        self.log('error', 'Failed to record click: ' + error.message);
      });
    },

    /**
     * Send verification ping to the server
     */
    sendPing: function() {
      var self = this;
      // Strip www. prefix from domain for consistency
      var domain = window.location.hostname.replace(/^www\./, '');
      var data = {
        publicKey: this.key,
        domain: domain,
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
          
          // Skip links that:
          // 1. Already have ref= param
          // 2. Are same-domain links
          // 3. Contain /ref/ in path (referral links themselves)
          if (!href || href.indexOf('ref=') !== -1) {
            return;
          }
          
          // Skip same-domain links
          if (href.indexOf(window.location.hostname) !== -1) {
            return;
          }
          
          // Skip links with /ref/ in path
          if (href.match(/\/ref\/[A-HJ-NP-Z2-9]{8}/i)) {
            return;
          }
          
          var separator = href.indexOf('?') === -1 ? '?' : '&';
          var newHref = href + separator + 'ref=' + encodeURIComponent(affiliateCode);
          link.setAttribute('href', newHref);
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
        console.error('[Affilio] ' + message);
      } else if (debug === 'true') {
        console.log('[Affilio] ' + message);
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
        // If cookie is corrupt, clear it and log warning
        this.log('warn', 'Corrupt attribution cookie cleared');
        this.clearCookie();
        return null;
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
    Affilio.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    // DOM already loaded
    initialize();
  }

  // Expose to global scope
  window.Affilio = Affilio;

})(window, document);
