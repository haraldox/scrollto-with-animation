(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * An even better animation frame.
 *
 * @copyright Oleg Slobodskoi 2015
 * @website https://github.com/kof/animationFrame
 * @license MIT
 */

module.exports = require('./lib/animation-frame')

},{"./lib/animation-frame":2}],2:[function(require,module,exports){
'use strict'

var nativeImpl = require('./native')
var now = require('./now')
var performance = require('./performance')

// Weird native implementation doesn't work if context is defined.
var nativeRequest = nativeImpl.request
var nativeCancel = nativeImpl.cancel

/**
 * Animation frame constructor.
 *
 * Options:
 *   - `useNative` use the native animation frame if possible, defaults to true
 *   - `frameRate` pass a custom frame rate
 *
 * @param {Object|Number} options
 */
function AnimationFrame(options) {
    if (!(this instanceof AnimationFrame)) return new AnimationFrame(options)
    options || (options = {})

    // Its a frame rate.
    if (typeof options == 'number') options = {frameRate: options}
    options.useNative != null || (options.useNative = true)
    this.options = options
    this.frameRate = options.frameRate || AnimationFrame.FRAME_RATE
    this._frameLength = 1000 / this.frameRate
    this._isCustomFrameRate = this.frameRate !== AnimationFrame.FRAME_RATE
    this._timeoutId = null
    this._callbacks = {}
    this._lastTickTime = 0
    this._tickCounter = 0
}

module.exports = AnimationFrame

/**
 * Default frame rate used for shim implementation. Native implementation
 * will use the screen frame rate, but js have no way to detect it.
 *
 * If you know your target device, define it manually.
 *
 * @type {Number}
 * @api public
 */
AnimationFrame.FRAME_RATE = 60

/**
 * Replace the globally defined implementation or define it globally.
 *
 * @param {Object|Number} [options]
 * @api public
 */
AnimationFrame.shim = function(options) {
    var animationFrame = new AnimationFrame(options)

    window.requestAnimationFrame = function(callback) {
        return animationFrame.request(callback)
    }
    window.cancelAnimationFrame = function(id) {
        return animationFrame.cancel(id)
    }

    return animationFrame
}

/**
 * Request animation frame.
 * We will use the native RAF as soon as we know it does works.
 *
 * @param {Function} callback
 * @return {Number} timeout id or requested animation frame id
 * @api public
 */
AnimationFrame.prototype.request = function(callback) {
    var self = this

    // Alawys inc counter to ensure it never has a conflict with the native counter.
    // After the feature test phase we don't know exactly which implementation has been used.
    // Therefore on #cancel we do it for both.
    ++this._tickCounter

    if (nativeImpl.supported && this.options.useNative && !this._isCustomFrameRate) {
        return nativeRequest(callback)
    }

    if (!callback) throw new TypeError('Not enough arguments')

    if (this._timeoutId == null) {
        // Much faster than Math.max
        // http://jsperf.com/math-max-vs-comparison/3
        // http://jsperf.com/date-now-vs-date-gettime/11
        var delay = this._frameLength + this._lastTickTime - now()
        if (delay < 0) delay = 0

        this._timeoutId = setTimeout(function() {
            self._lastTickTime = now()
            self._timeoutId = null
            ++self._tickCounter
            var callbacks = self._callbacks
            self._callbacks = {}
            for (var id in callbacks) {
                if (callbacks[id]) {
                    if (nativeImpl.supported && self.options.useNative) {
                        nativeRequest(callbacks[id])
                    } else {
                        callbacks[id](performance.now())
                    }
                }
            }
        }, delay)
    }

    this._callbacks[this._tickCounter] = callback

    return this._tickCounter
}

/**
 * Cancel animation frame.
 *
 * @param {Number} timeout id or requested animation frame id
 *
 * @api public
 */
AnimationFrame.prototype.cancel = function(id) {
    if (nativeImpl.supported && this.options.useNative) nativeCancel(id)
    delete this._callbacks[id]
}

},{"./native":3,"./now":4,"./performance":6}],3:[function(require,module,exports){
'use strict'

var global = window

// Test if we are within a foreign domain. Use raf from the top if possible.
try {
    // Accessing .name will throw SecurityError within a foreign domain.
    global.top.name
    global = global.top
} catch(e) {}

exports.request = global.requestAnimationFrame
exports.cancel = global.cancelAnimationFrame || global.cancelRequestAnimationFrame
exports.supported = false

var vendors = ['Webkit', 'Moz', 'ms', 'O']

// Grab the native implementation.
for (var i = 0; i < vendors.length && !exports.request; i++) {
    exports.request = global[vendors[i] + 'RequestAnimationFrame']
    exports.cancel = global[vendors[i] + 'CancelAnimationFrame'] ||
        global[vendors[i] + 'CancelRequestAnimationFrame']
}

// Test if native implementation works.
// There are some issues on ios6
// http://shitwebkitdoes.tumblr.com/post/47186945856/native-requestanimationframe-broken-on-ios-6
// https://gist.github.com/KrofDrakula/5318048

if (exports.request) {
    exports.request.call(null, function() {
        exports.supported = true
    });
}

},{}],4:[function(require,module,exports){
'use strict'

/**
 * Crossplatform Date.now()
 *
 * @return {Number} time in ms
 * @api private
 */
module.exports = Date.now || function() {
    return (new Date).getTime()
}

},{}],5:[function(require,module,exports){
'use strict'

var now = require('./now')

/**
 * Replacement for PerformanceTiming.navigationStart for the case when
 * performance.now is not implemented.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/PerformanceTiming.navigationStart
 *
 * @type {Number}
 * @api private
 */
exports.navigationStart = now()

},{"./now":4}],6:[function(require,module,exports){
'use strict'

var now = require('./now')
var PerformanceTiming = require('./performance-timing')

/**
 * Crossplatform performance.now()
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/Performance.now()
 *
 * @return {Number} relative time in ms
 * @api public
 */
exports.now = function () {
    if (window.performance && window.performance.now) return window.performance.now()
    return now() - PerformanceTiming.navigationStart
}


},{"./now":4,"./performance-timing":5}],7:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _easings = require('./easings');

var _easings2 = _interopRequireDefault(_easings);

var _animationFrame = require('animation-frame');

var _animationFrame2 = _interopRequireDefault(_animationFrame);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DEFAULT_ANIMATION = 'easeInQuad';

var AnimatedScrollTo = function () {
  function AnimatedScrollTo() {
    _classCallCheck(this, AnimatedScrollTo);
  }

  _createClass(AnimatedScrollTo, null, [{
    key: 'findAnimation',
    value: function findAnimation() {
      var transition = arguments.length <= 0 || arguments[0] === undefined ? DEFAULT_ANIMATION : arguments[0];

      var animation = _easings2.default[transition];
      if (animation === undefined) {
        throw new Error('scrollToWithAnimation: Transition not found - https://github.com/davesnx/scrollToWithAnimation');
      }
      return animation;
    }
  }, {
    key: 'defineAnimation',
    value: function defineAnimation(transition) {
      if (transition.length !== 4) {
        throw new TypeError("scrollToWithAnimation: callback transition don't look like a valid equation - https://github.com/davesnx/scrollToWithAnimation");
      }
      return transition;
    }
  }, {
    key: 'scrollToWithAnimation',
    value: function scrollToWithAnimation(element, to, duration, transition, callback) {
      var start = element.scrollTop;
      var change = to - start;
      var animationStart = +new Date();
      var animating = true;
      var lastpos = null;
      var eq = null;

      if (typeof transition === 'string' || transition === null) {
        eq = AnimatedScrollTo.findAnimation(transition);
      } else if (typeof transition === 'function') {
        eq = AnimatedScrollTo.defineAnimation(transition);
      } else {
        throw new TypeError("scrollToWithAnimation: Transition isn't string or Function - https://github.com/davesnx/scrollToWithAnimation");
      }

      var animateScroll = function animateScroll() {
        if (!animating) {
          return;
        }
        (0, _animationFrame2.default)(animateScroll);
        var now = +new Date();
        var val = Math.floor(eq(now - animationStart, start, change, duration));
        if (lastpos) {
          if (lastpos === element.scrollTop) {
            lastpos = val;
            element.scrollTop = val;
          } else {
            animating = false;
          }
        } else {
          lastpos = val;
          element.scrollTop = val;
        }
        if (now > animationStart + duration) {
          element.scrollTop = to;
          animating = false;
          if (callback) {
            callback();
          }
        }
      };
      (0, _animationFrame2.default)(animateScroll);
    }
  }]);

  return AnimatedScrollTo;
}();

if (window) {
  window.AnimatedScrollTo = AnimatedScrollTo.scrollToWithAnimation;
}

exports.default = AnimatedScrollTo;

},{"./easings":8,"animation-frame":1}],8:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = {
  linearTween: function linearTween(t, b, c, d) {
    return c * t / d + b;
  },
  easeInQuad: function easeInQuad(t, b, c, d) {
    t /= d;
    return c * t * t + b;
  },
  easeOutQuad: function easeOutQuad(t, b, c, d) {
    t /= d;
    return -c * t * (t - 2) + b;
  },
  easeInOutQuad: function easeInOutQuad(t, b, c, d) {
    t /= d / 2;
    if (t < 1) return c / 2 * t * t + b;
    t--;
    return -c / 2 * (t * (t - 2) - 1) + b;
  },
  easeInCubic: function easeInCubic(t, b, c, d) {
    t /= d;
    return c * t * t * t + b;
  },
  easeOutCubic: function easeOutCubic(t, b, c, d) {
    t /= d;
    t--;
    return c * (t * t * t + 1) + b;
  },
  easeInOutCubic: function easeInOutCubic(t, b, c, d) {
    t /= d / 2;
    if (t < 1) return c / 2 * t * t * t + b;
    t -= 2;
    return c / 2 * (t * t * t + 2) + b;
  },
  easeInQuart: function easeInQuart(t, b, c, d) {
    t /= d;
    return c * t * t * t * t + b;
  },
  easeOutQuart: function easeOutQuart(t, b, c, d) {
    t /= d;
    t--;
    return -c * (t * t * t * t - 1) + b;
  },
  easeInOutQuart: function easeInOutQuart(t, b, c, d) {
    t /= d / 2;
    if (t < 1) return c / 2 * t * t * t * t + b;
    t -= 2;
    return -c / 2 * (t * t * t * t - 2) + b;
  },
  easeInQuint: function easeInQuint(t, b, c, d) {
    t /= d;
    return c * t * t * t * t * t + b;
  },
  easeOutQuint: function easeOutQuint(t, b, c, d) {
    t /= d;
    t--;
    return c * (t * t * t * t * t + 1) + b;
  },
  easeInOutQuint: function easeInOutQuint(t, b, c, d) {
    t /= d / 2;
    if (t < 1) return c / 2 * t * t * t * t * t + b;
    t -= 2;
    return c / 2 * (t * t * t * t * t + 2) + b;
  },
  easeInSine: function easeInSine(t, b, c, d) {
    return -c * Math.cos(t / d * (Math.PI / 2)) + c + b;
  },
  easeOutSine: function easeOutSine(t, b, c, d) {
    return c * Math.sin(t / d * (Math.PI / 2)) + b;
  },
  easeInOutSine: function easeInOutSine(t, b, c, d) {
    return -c / 2 * (Math.cos(Math.PI * t / d) - 1) + b;
  },
  easeInExpo: function easeInExpo(t, b, c, d) {
    return c * Math.pow(2, 10 * (t / d - 1)) + b;
  },
  easeOutExpo: function easeOutExpo(t, b, c, d) {
    return c * (-Math.pow(2, -10 * t / d) + 1) + b;
  },
  easeInOutExpo: function easeInOutExpo(t, b, c, d) {
    t /= d / 2;
    if (t < 1) return c / 2 * Math.pow(2, 10 * (t - 1)) + b;
    t--;
    return c / 2 * (-Math.pow(2, -10 * t) + 2) + b;
  },
  easeInCirc: function easeInCirc(t, b, c, d) {
    t /= d;
    return -c * (Math.sqrt(1 - t * t) - 1) + b;
  },
  easeOutCirc: function easeOutCirc(t, b, c, d) {
    t /= d;
    t--;
    return c * Math.sqrt(1 - t * t) + b;
  },
  easeInOutCirc: function easeInOutCirc(t, b, c, d) {
    t /= d / 2;
    if (t < 1) return -c / 2 * (Math.sqrt(1 - t * t) - 1) + b;
    t -= 2;
    return c / 2 * (Math.sqrt(1 - t * t) + 1) + b;
  }
};

},{}]},{},[7]);