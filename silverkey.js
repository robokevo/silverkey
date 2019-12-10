// Welcome to silverKey! The following is my medium-effort attempt to normalize
// keyboard inputs across browsers, predominantly aimed at QWERTY-US keyboards.
// There is no extra intent to correct for IE versions below 11 but I suspect
// this should work at least down to IE9. I rely on keyboardEvent.key instead of
// keyboardEvent.code to respond better to changes in physical keyboard layouts
// and locales and then try to normalize differences over browsers.
//
// NOTE FOR NON-US/ENGLISH USERS: The keycodes below may vary from language to
// language; relying on keyboardEvent.key is best. Otherwise we could listen
// for keypress events, get charCodes, then do something like:
//
//      var eventKey = String.fromCharCode(charCode);
//
// However I'm trying to limit the amount of deprecated bits in use here and
// keydown events don't emit a .charCode, plus there seems to be no .keyCode
// info that I could find for other languages. The most reliable path for 
// best support is to encourage a browser upgrade, for better or worse (but
// probably better)
//
// Only tested on my crappy microsoft keyboard on Windows 10 (11/20/19)
//
// To-do:
// -proper documentation
// -test tabbing away from binded element affecting binds
//


/*jshint node: true*/ // suppresses jshint "'use strict' in function mode" error
'use strict';

var silverKey = {
    // most values here set programatically
    _delimiter: ',',
    _activeKeys : {},
    _activeShortcuts : {},
    _activeShortcutKeys : {},
    _activeSequences : {},
    _activeSequenceKeys : {},
    _currentSequence : '',
    _currentCombo : [],
    _preventDefault : [],
    _stopPropagation : [],
    _throttle:      0,
    _lastKeyActionTime: null,
    _lastSequenceTime:  null,
    _lastShortcutTime:  null,
    _lastEventTime : null,
    _keyTimeout : 1000,
    _debug: false,
    keyInput: null,
    modifiers : {
        shiftKey:   false,
        capsLock:   false,
        repeat:     false,
        altKey:     false,
        ctrlKey:    false,
        metaKey:    false,
    },
    // (Literally minutes after I had finished most of writing the following tables
    // I found this reference: http://www.javascripter.net/faq/keycodes.htm)
    _KEYALIASES : {
        // List of various input values from event.key plus variants that don't
        // match up with their corresponding 'Standards' value, as well as some
        // conveniences for adding key bindings. Notably,
        //
        // 1.) arrow keys have "Arrow" prepended to them per standards
        //  (mostly for IE, Edge fixed this),
        // 2.) Numpad keys can't be reliably detected everywhere without
        //  key.code support and will be treated like their normal
        //  counterparts. For IE you can do some sniffing with
        //  keyboardEvent.location but that's out of the scope of this
        //  library unless I can think of a compelling use-case.
        // 3.) One of the convenience values is "comma", in case you need to
        //  bind the "comma" key to a behavior; if you prefer using another
        //  value to seperate your strings you can set it with:
        //      silverKey.setDelimiter('+') // or whatever key
        //
        // For ease of data checking all entries are lower-case
        any:    'Any', // can't forget the Any key!
        space:  ' ',
        spacebar:   ' ',
        enter: 'Enter',
        backspace:  'Backspace',
        tab:  'Tab',
        clear: 'Clear',
        shift: 'Shift',
        control: 'Control',
        ctrl: 'Control',
        ctl: 'Control',
        option: 'Alt',
        alt: 'Alt',
        capslock: 'CapsLock',
        caps:	'CapsLock',
        escape: 'Escape',
        esc:    'Escape',
        pageup: 'PageUp',
        pagedown:'PageDown',
        end:	'End',
        home:	'Home',
        del:    'Delete',
        delete: 'Delete',
        up:     'ArrowUp',
        arrowup:'ArrowUp',
        down:   'ArrowDown',
        arrowdown:'ArrowDown',
        left:   'ArrowLeft',
        arrowleft:'ArrowLeft',
        right:  'ArrowRight',
        arrowright:'ArrowRight',
        printscreen:'PrintScreen',
        prtscn:	'PrintScreen',
        insert: 'Insert',
        ins:	'Insert',
        add:    '+',
        plus:	'+',
        subtract: '-',
        minus:	'-',
        decimal: '.',
        dot: '.',
        period: '.',
        comma: ',',
        divide: '/',
        forwardslash: '/',
        backslash: '\\',
        multiply: '*',
        scroll: 'ScrollLock',
        scrolllock: 'ScrollLock',
        scrlk:	'ScrollLock',
        numlock:'NumLock',
        command:'Meta',
        win:    'Meta',
        os:     'Meta',
        meta:	'Meta',
        apps:   'ContextMenu',
        contextmenu: 'ContextMenu',
        altgraph:'AltGraph',
        altgr:	'AltGraph',
        f1:	'F1',
        f2:	'F2',
        f3:	'F3',
        f4:	'F4',
        f5:	'F5',
        f6:	'F6',
        f7:	'F7',
        f8:	'F8',
        f9:	'F9',
        f10:	'F10',
        f11:	'F11',
        f12:	'F12',
        medianexttrack: 'MediaTrackNext',
        mediatracknext: 'MediaTrackNext',
        mediatrackprevious: 'MediaTrackPrevious',
        mediaprevioustrack: 'MediaTrackPrevious',
        volumedown: 'AudioVolumeDown',
        audiovolumedown: 'AudioVolumeDown',
        volumeup: 'AudioVolumeUp',
        audiovolumeup: 'AudioVolumeUp',
        volumemute: 'AudioVolumeMute',
        audiovolumemute: 'AudioVolumeMute',
        mediaplaypause:	'MediaPlayPause',
        play:	'MediaPlayPause',
        pause: 'Pause',
        hangulmode: 'HangulMode',
        hanjamode: 'HanjaMode',
    },
    _KEYCODEALIASES : {
        // List of various input values from event.keyCode/event.charCode
        // and their event.key counterpart values. Like above, Numpad keys
        // will be mapped to their generic counterparts. Some additional
        // values here were added from Wes Bos's awesome keycode resource
        // found at https://keycode.info/.
        //
        // Most browsers seem to support event.key so this should
        // be unecessary but here are some random hold-outs
        // as of now (caniuse.com, 10/29/2019):
        //  - Opera Mini
        //  - Android Browser
        //  - Chrome < 51
        //  - UC Browser for Android
        //  - Safari < 10.1/10.2 (iOS 3.2)
        //  - QQ Browser
        //  - Baidu Browser
        //
        // One last note: if a code has a different value in FireFox, I will
        // only use the one used elsewhere because FireFox is a Good
        // Browser(TM) and actually implements keyboardEvent.key. FireFox-
        // only values are included here mostly for historical reasons

        8:  'Backspace',
        9:  'Tab',
        12: 'Clear',
        13: 'Enter',
        16: 'Shift',
        17: 'Control',
        18: 'Alt',
        19: 'Pause',
        20: 'CapsLock',
        21: 'HangulMode', // keycode.info
        25: 'HanjaMode', // keycode.info
        27: 'Escape',
        // 28: conversion // keycode.info
        // 29: non-conversion // keycode.info
        32: ' ', // Space character
        33: 'PageUp',
        34: 'PageDown',
        35: 'End',
        36: 'Home',
        37: 'ArrowLeft',
        38: 'ArrowUp',
        39: 'ArrowRight',
        40: 'ArrowDown',
        // 41: select // keycode.info
        // 42: print // keycode.info
        // 43: execute // keycode.info
        44: 'PrintScreen', // Only works on keyup event?
        45: 'Insert',
        46: 'Delete',
        // 47: help // keycode.info
        48: '0',
        49: '1',
        50: '2',
        51: '3',
        52: '4',
        53: '5',
        54: '6',
        55: '7',
        56: '8',
        57: '9',
        59: ';', // Firefox
        61: '=', // Firefox
        65: 'a',
        66: 'b',
        67: 'c',
        68: 'd',
        69: 'e',
        70: 'f',
        71: 'g',
        72: 'h',
        73: 'i',
        74: 'j',
        75: 'k',
        76: 'l',
        77: 'm',
        78: 'n',
        79: 'o',
        80: 'p',
        81: 'q',
        82: 'r',
        83: 's',
        84: 't',
        85: 'u',
        86: 'v',
        87: 'w',
        88: 'x',
        89: 'y',
        90: 'z',
        91: 'Meta',
        92: 'Meta', // Windows only?
        93: 'ContextMenu',
        // 96-105: numpad numbers
        96:  '0',
        97:  '1',
        98:  '2',
        99:  '3',
        100: '4',
        101: '5',
        102: '6',
        103: '7',
        104: '8',
        105: '9',
        // 106-111: numpad keys
        106: '*',
        107: '+',
        109: '-',
        110: '.',
        111: '/',
        // F Keys are hard to rely on in IE
        112: 'F1',
        113: 'F2', 
        114: 'F3',
        115: 'F4',
        116: 'F5',
        117: 'F6',
        118: 'F7',
        119: 'F8',
        120: 'F9',
        121: 'F10',
        122: 'F11',
        123: 'F12',
        144: 'NumLock',
        145: 'ScrollLock',
        173: 'AudioVolumeMute', // also '-' in Firefox        
        174: 'AudioVolumeDown',
        175: 'AudioVolumeUp',
        176: 'MediaTrackNext',
        177: 'MediaTrackPrevious',
        179: 'MediaPlayPause',
        181: 'AudioVolumeMute', // Firefox
        186: ';',
        187: '=',
        188: ',',
        189: '-',
        190: '.',
        191: '/',
        192: '`',
        219: '[',
        220: '\\',
        221: ']',
        222: '\'',
        223: '`',
        224: '⌘', // Firefox
        225: 'AltGraph',
    },
    _KEYCODESHIFTED : {
        // Shifted keys don't have different keycodes :'(
        48: ')',
        49: '!',
        50: '@',
        51: '#',
        52: '$',
        53: '%',
        54: '^',
        55: '&',
        56: '*',
        57: '(',
        59: '-',
        60: '+',
        61: '+', // FireFox
        65: 'A',
        66: 'B',
        67: 'C',
        68: 'D',
        69: 'E',
        70: 'F',
        71: 'G',
        72: 'H',
        73: 'I',
        74: 'J',
        75: 'K',
        76: 'L',
        77: 'M',
        78: 'N',
        79: 'O',
        80: 'P',
        81: 'Q',
        82: 'R',
        83: 'S',
        84: 'T',
        85: 'U',
        86: 'V',
        87: 'W',
        88: 'X',
        89: 'Y',
        90: 'Z',
        173: '_', // FireFox
        186: ':',
        187: '+',
        188: '<',
        189: '_',
        190: '>',
        191: '?',
        192: '~',
        219: '{',
        220: '|',
        221: '}',
        222: '"',
    },
};

silverKey.debugMode = function(on) {
    // debug mode toggle for returning diagnostic object
    // from silverKey.handleKey function
    if (on) {
        silverKey._debug = true;
    } else {
        silverKey._debug = false;
    }
};

silverKey.findAlias = function(input, preserveCase) {
    // Checks input against known aliases, otherwise returns as lower-case
    // unless preserveCase is specified
    var sameCase = preserveCase || false;
    var lowerCase = input.toLowerCase();
    if (silverKey._KEYALIASES[lowerCase] !== undefined) {
        return silverKey._KEYALIASES[lowerCase];
    } else {
        if (sameCase) {
            return input;
        } else {
            return lowerCase;
        }
    }
};

silverKey.parseInput = function(input, preserveCase) {
    // Takes delimited string input and divides it into their respective keys.
    // used by .bindKeySequence/.unbindKeySequence and .bindCombo/.unbindCombo
    var sameCase = preserveCase || false;
    var keys;
    var key;
    keys = input.split(silverKey._delimiter);
    for (var k = 0; k < keys.length; k++) {
        key = silverKey.findAlias(keys[k], sameCase);
        keys[k] = key;
    }
    return keys;
};

silverKey.setDelimiter = function(char) {
    if (typeof char !== "string") {
        throw 'not a valid string';
    }
    silverKey._delimiter = char;
};

silverKey.preventDefault = function(k) {
    // employed by default for binded keys
    var key = silverKey.findAlias(k);
    if (silverKey._preventDefault.indexOf(key) === -1) {
        silverKey._preventDefault.push(key);
    }
};

silverKey.stopPropagation = function(k) {
    // employed by default for binded keys
    var key = silverKey.findAlias(k);
    if (silverKey._stopPropagation.indexOf(key) === -1) {
        silverKey._stopPropagation.push(key);
    }
};

silverKey.allowDefault = function(k) {
    var key = silverKey.findAlias(k);
    if (silverKey._preventDefault.indexOf(key) !== -1) {
        silverKey._preventDefault.splice(silverKey._preventDefault.indexOf(key),1);
    }
};

silverKey.allowPropagation = function(k) {
    var key = silverKey.findAlias(k);
    if (silverKey._stopPropagation.indexOf(key) !== -1) {
        silverKey._stopPropagation.splice(silverKey._preventDefault.indexOf(key),1);
    }
};

silverKey.setThrottle = function(ms) {
    // set delay in milliseconds before sequence and combos reset
    // isNaN is 'truthy' so casting ms as number just in case
    if (!isNaN(ms)) {
        silverKey._throttle = Number(ms);
    } else {
        throw "ms was not a valid value in milliseconds";
    }
};

silverKey.setTimeout = function(ms) {
    // set delay in milliseconds before sequence and combos reset
    // isNaN is 'truthy' so casting ms as number just in case
    if (!isNaN(ms)) {
        silverKey._keyTimeout = Number(ms);
    } else {
        throw "ms was not a valid value in milliseconds";
    }
};

silverKey.activeKeys = function() {
    // returns list of active keys
    return Object.keys(silverKey._activeKeys);
};

silverKey.activeSequences = function() {
    // returns list of lists of sequences
    var seqList = [];
    var allKeys = Object.keys(silverKey._activeSequenceKeys);
    var keys;
    for (var s = 0; s < allKeys.length; s++) {
        keys = allKeys[s];
        seqList.push(silverKey._activeSequenceKeys[keys].join(silverKey._delimiter));
    }
    return seqList;
};

silverKey.activeShortcuts = function() {
    // returns list of lists of sequences
    var seqList = [];
    var allShortcuts = Object.keys(silverKey._activeShortcutKeys);
    var keys;
    for (var s = 0; s < allShortcuts.length; s++) {
        keys = allShortcuts[s];
        seqList.push(silverKey._activeShortcutKeys[keys].join(silverKey._delimiter));
    }
    return seqList;
};

silverKey.bindElement = function(element) {
    element.addEventListener('keydown', silverKey.handleKey);
    element.addEventListener('keyup', silverKey.handleKey);
    element.addEventListener('blur', silverKey.handleKey);
};

silverKey.unbindElement = function(element) {
    element.removeEventListener('keydown', silverKey.handleKey);
    element.removeEventListener('keyup', silverKey.handleKey);
    element.removeEventListener('blur', silverKey.handleKey);
};

silverKey.bindKey = function(input, callback, allowDefaults) {
    // Accepts a key command, checking against non-printable keys and alises
    // first before adding. Key is saved to lower-case as most shortcuts are
    // *NOT* case sensitive
    // 
    // Check silverkey._KEYALIASES
    var key = silverKey.findAlias(input);
    var defaults = allowDefaults || false;
    silverKey._activeKeys[key] = callback;
    if (!defaults) {
        silverKey.preventDefault(key);
        silverKey.stopPropagation(key);
    }
};

silverKey.bindSequence = function(input, callback, allowDefaults) {
    // Accepts an ordered list (array) of sequential commands to cause an action
    //
    // Checks entries against silverKey._KEYALIASES, otherwise adds them as-is
    
    if (typeof input === 'string') {
        var defaults = allowDefaults || false;
        var keys = silverKey.parseInput(input);
        var key;
        if (!defaults) {
            for (var k = 0; k < keys.length; k++) {
                key = keys[k];
                silverKey.preventDefault(keys[k]);
                silverKey.stopPropagation(keys[k]);
            }
        }
        silverKey._activeSequences[keys.join("")] = callback;
        silverKey._activeSequenceKeys[keys.join("")] = keys;
    } else {
        throw "sequence was not valid string";
    }
};

silverKey.bindShortcut = function (input, callback, allowDefaults) {
    // accepts an unordered list (delimited string) of 6 or less keys to cause
    // an action DOES NOT work with PrintScreen as it doesn't show on keydown
    // events. Try to keep it to fewer keys because of the following--
    //
    // 2 WARNINGS:
    //
    // 1.) 6(ish) is the max possible keys I can get to register simultaneously
    // on IE/Chrome/FireFox, but NOT RELIABLY. 4 (FOUR) (CUATRO) is the maximum
    // I can quasi-reliably get to register, because...
    //
    // 2.) Multiple letter keys can interfere with eachother's events (e.g.
    // hitting 's+d+f+g' is more likely to fail than 'Ctrl+Alt+s+g'). This
    // appears to be OS-level/app-independant. Mashing keys in general
    // will mess with input so beware!! (e.g. all arrow keys at once
    // doesn't seem to work. who knew?)
    //
    // (FWIW if you make somebody use a shortcut longer than 3 or 4 keys
    // simultaneoulsy you may be a sadist. Just Sayin'(TM))
    
    if (typeof input === 'string') {
        var defaults = allowDefaults || false;
        // sort to ensure easier lookups
        var keys = silverKey.parseInput(input);
        var key;
        // duplicate input check
        for (var i = 0; i < keys.length; i++){
            key = keys[i];
            while (keys.indexOf(key) !== keys.lastIndexOf(key)) {
                keys.splice(i,1);
            }
        }
        if (keys.length > 6) {
            throw "key shortcut has too many keys (6 or less please!)";
        }
        keys.sort();
        if (!defaults) {
            for (var k = 0; k < keys.length; k++) {
                key = keys[k];
                silverKey.preventDefault(keys[k]);
                silverKey.stopPropagation(keys[k]);
            }
        }
        silverKey._activeShortcuts[keys.join("")] = callback;
        silverKey._activeShortcutKeys[keys.join("")] = keys;
    } else {
        throw "sequence was not valid string";
    }
};

silverKey.unbindKey = function(input) {
    // errors out when unbound key is passed to prevent typos
    var key = silverKey.findAlias(input);
    if (silverKey._activeKeys[key] !== undefined) {
        delete silverKey._activeKeys[key];
    } else {
        throw "input was not found in active binded keys";
    }
    if (!silverKey.keyInUse(input, input)) {
        silverKey.allowDefault(key);
        silverKey.allowPropagation(key);
    }
};

silverKey.unbindSequence = function (input) {
    // Accepts a delimited string of sequential commands to unbind; throws
    // an error when unbound key is passed to prevent typos
    
    if (typeof input === 'string') {
        var keys = silverKey.parseInput(input);
        if (silverKey._activeSequences[keys.join('')] !== undefined) {
            delete silverKey._activeSequences[keys.join('')];
            delete silverKey._activeSequenceKeys[keys.join('')];
        } else {
            throw "sequence not found";
        }
        for (var k = 0; k < keys.length; k++) {
            if (!silverKey.keyInUse(keys[k], input)) {
                silverKey.allowDefault(keys[k]);
                silverKey.allowPropagation(keys[k]);
            }
        }
    } else {
        throw "sequence was not a valid string";
    }
};

silverKey.unbindShortcut = function (input) {
    // unbinds list of commands (delimited string) if already bound, otherwise
    // throws an error if not found
    if (typeof input === 'string') {
        var keys = silverKey.parseInput(input).sort();
        if (silverKey._activeShortcuts[keys.join('')] !== undefined) {
            delete silverKey._activeShortcuts[keys.join('')];
            delete silverKey._activeShortcutKeys[keys.join('')];
        } else {
            throw "sequence not found";
        }
        for (var k = 0; k < keys.length; k++) {
            if (!silverKey.keyInUse(keys[k], input)) {
                silverKey.allowDefault(keys[k]);
                silverKey.allowPropagation(keys[k]);
            }
        }
    } else {
        throw "sequence was not a valid string";
    }    
};

silverKey.unbindAll = function() {
    var allKeys = Object.keys(silverKey._activeKeys);
    var allSequences = Object.keys(silverKey._activeSequences);
    var allShortcuts = Object.keys(silverKey._activeShortcuts);
    var command;
    for (var k = 0; k < allKeys.length; k++) {
        command = allKeys[k];
        silverKey.unbindKey(command);
    }
    for (var sq = 0; sq < allSequences.length; sq++) {
        command = allSequences[sq];
        silverKey.unbindSequence(silverKey._activeSequenceKeys[command].join());
    }
    for (var sc = 0; sc < allSequences.length; sc++) {
        command = allShortcuts[sc];
        silverKey.unbindShortcut(silverKey._activeShortcutKeys[command].join());
    }
};

silverKey.runKeyAction = function(key, newTime) {
    if (silverKey._activeKeys[key] !== undefined) {
        if ((silverKey._lastKeyActionTime &&
            silverKey._lastKeyActionTime < newTime - silverKey._throttle) ||
        !silverKey._lastKeyActionTime) {
            silverKey._activeKeys[key]();
            silverKey._lastKeyActionTime = newTime;
        }
        return true;
    } else if (silverKey._activeKeys.Any !== undefined) {
        if ((silverKey._lastKeyActionTime &&
            silverKey._lastKeyActionTime < newTime - silverKey._throttle) ||
        !silverKey._lastKeyActionTime) {
            silverKey._activeKeys.Any();
            silverKey._lastKeyActionTime = newTime;
        }
        return true;
    }
};

silverKey.runSequences = function(newTime) {
    // Checks history against active sequences; called on
    // keydown and also keyup for 'PrintScreen' keypresses
    var activeSequences = Object.keys(silverKey._activeSequences);
    for (var s = 0; s < activeSequences.length; s++) {
        var sequence = activeSequences[s];
        var offset = silverKey._currentSequence.length - sequence.length;
        if (silverKey._currentSequence.slice(offset) === sequence) {
            if ((silverKey._lastSequenceTime &&
                silverKey._lastSequenceTime < newTime - this._throttle) ||
                !silverKey._lastSequenceTime) {
                    silverKey._activeSequences[activeSequences[s]]();
                    silverKey._lastSequenceTime = newTime;
                    return true;
            }
        }
    }
};

silverKey.runShortcuts = function(newTime) {
    // Checks history against active sequences; called on
    // keydown and also keyup for 'PrintScreen' keypresses
    var activeShortcuts = Object.keys(silverKey._activeShortcuts);
    var currentCombo = silverKey._currentCombo.sort().join('');
    var shortcut;
    for (var s = 0; s < activeShortcuts.length; s++) {
        shortcut = activeShortcuts[s];
        if (currentCombo.indexOf(shortcut) !== -1) {
                if ((silverKey._lastShortcutTime &&
                    silverKey._lastShortcutTime < newTime - silverKey._throttle) ||
                    !silverKey._lastShortcutTime) {
                        silverKey._activeShortcuts[shortcut]();
                        silverKey._lastShortcutTime = newTime;
                        return true;
            }
        }
    }
};

silverKey.keyInUse = function(key, command) {
    // Checks if key is already in use; useful before enabling defaults for a key
    // that is still in use by other bindings, with mainCommand being the
    // command invoking keyInUse
    var self = silverKey; // context gets lost in forEach loops
    var inUse = false;
    var invokingCommand = command || undefined;
    var activeKeys = Object.keys(silverKey._activeKeys);
    var activeSequences = Object.keys(silverKey._activeSequences);
    var activeShortcuts = Object.keys(silverKey._activeShortcuts);
    activeKeys.forEach(function(aKey) {
        if (aKey !== invokingCommand) {
            if (aKey === key) {
                inUse = true;
            }
        }
    });
    activeSequences.forEach(function(seq){
        var seqKeys;
        if (seq !== invokingCommand) {
            seqKeys = self._activeSequenceKeys[seq];
            seqKeys.forEach(function(seqKey){
                if (seqKey === key) {
                    inUse = true;
                }
            });
        }
    });
    activeShortcuts.forEach(function(sc){
        var sKeys;
        if (sc !== invokingCommand) {
            sKeys = self._activeShortcutKeys[sc];
            sKeys.forEach(function(sKey){
                if (sKey === key) {
                    inUse = true;
                }
            });
        }
    });
    return inUse;
};

silverKey.handleKey = function(event) {
    // Returns standard value for what should be returned by
    // keyboardEvent.key. Uses keydown and keyup events; blur events clear key history
    //
    // Locations on keyboard can be found with:
    // var location = event.location;
    // "0" is the main keyboard, "1" is left versions of shift/alt/etc, "2"
    // the right-handed versions, and "3" is the numpad. Since they all
    // map to the same event.key values, I won't bother here but do as you will.
    var eventKey;
    var newEventTime = Date.now();
    if (event.getModifierState) {
        // If you need to check for Scroll Lock or NumLock you can do the following:
        // var scrollLock = event.getModifierState('ScrollLock') || event.getModifierState('Scroll'); // IE, of course
        // silverKey.modifiers.scrollLock = scrollLock;
        // silverKey.modifiers.numLock = event.getModifierState('NumLock');
        // (silverKey does not need to check these but adding would be trivial)
        silverKey.modifiers.capsLock = event.getModifierState('CapsLock');
    } else {
        silverKey.modifiers.capsLock = false;
    }
    if (!silverKey._lastEventTime) {
        silverKey._lastEventTime = newEventTime;
    }
    silverKey.modifiers.shiftKey = event.shiftKey;
    silverKey.modifiers.altKey = event.altKey;
    silverKey.modifiers.ctrlKey = event.ctrlKey;
    if (event.key) {
        // supported by most modern browsers
        eventKey = silverKey.findAlias(event.key, true); // preserves case for eventKey info
    }
    // IE throws 'Unidentified' for some key combos with modifier keys
    if (event.key === 'Unidentified' || (event.key === undefined && event.keyCode)) {
        // sigh
        //
        // The following corrects for QWERTY-US; mileage varies drastically
        // with other languages and regionally specific browers (Yandex, Baidu, etc.)
        // If you use AZERTY/Dvorak/other alternate layouts or non-English, the
        // keyboardEvent.key property should pick it up so encourage users to use
        // a modern browser that supports this

        var keyCode = event.keyCode;
        if (silverKey.modifiers.shiftKey && keyCode in silverKey._KEYCODESHIFTED) {
            // Checking if a letter is changed by capslock and shift
            if (keyCode > 64 && keyCode < 91) {
                if (silverKey.modifiers.capsLock && keyCode in silverKey._KEYCODEALIASES) {
                    // if shifted and then inverted by caps
                    eventKey = silverKey._KEYCODEALIASES[keyCode];
                } else {
                    eventKey = silverKey._KEYCODESHIFTED[keyCode];
                }
            } else {
                // normal shifted key (affects numpads)
                eventKey = silverKey._KEYCODESHIFTED[keyCode];
            }
        } else if (silverKey.modifiers.capsLock) {
            // if modified by just capslock
            if (keyCode > 64 && keyCode < 91 &&
                keyCode in silverKey._KEYCODESHIFTED) {
                eventKey = silverKey._KEYCODESHIFTED[keyCode];
            } else if (keyCode in silverKey._KEYCODEALIASES) {
                eventKey = silverKey._KEYCODEALIASES[keyCode];
            }
        } else if (keyCode in silverKey._KEYCODEALIASES) {
            // "normal" key
            eventKey = silverKey._KEYCODEALIASES[keyCode];
        } else { // failure :(
            eventKey = 'Unidentified';
        }
    }
    if (event.type === 'keydown') {
        var aliasKey = silverKey.findAlias(eventKey);// for adding to history
        if (newEventTime - silverKey._lastEventTime > silverKey._keyTimeout) {
            silverKey._currentSequence = '';
            silverKey._currentCombo = [];
        }
        if (eventKey === 'Meta') {
            // corrects for IE and FireFox
            silverKey.modifiers.metaKey = true;
        }
        // testing for repeating key
        var repeatStr = silverKey._currentSequence.slice(
            silverKey._currentSequence.length-eventKey.length);
        if (event.repeat) {
            silverKey.modifiers.repeat = event.repeat;
        } else if (eventKey === repeatStr) {
            // IE repeat detection
            silverKey.modifiers.repeat = true;
        }else {
            silverKey.modifiers.repeat = false;
        }
        // Avoid duplicate combo key entries
        if (silverKey._currentCombo.indexOf(aliasKey) === -1) {
            silverKey._currentCombo.push(aliasKey);
        }
        silverKey._currentSequence += aliasKey;

        // key behaviors triggered on keydown for responsiveness
        // History check for sequences and shortcuts
        var action = silverKey.runSequences(newEventTime);
        if (!action) {
            silverKey.runShortcuts(newEventTime);
        }
        if (!action) {
            silverKey.runKeyAction(aliasKey, newEventTime);
        }
        // prevent defaults if necessary
        if (silverKey._preventDefault.indexOf(eventKey) !== -1) {
        // taken from:
        // https://developer.mozilla.org/en-US/docs/Web/API/Event/cancelable
            if (typeof event.cancelable !== 'boolean' || event.cancelable) {
                // The event can be canceled, so we do so.
                event.preventDefault();
            } else {
                // The event cannot be canceled, so it is not safe
                // to call preventDefault() on it.
                console.warn("The following event couldn't be canceled:");
                console.dir(event);
            }
        }
        if (silverKey._stopPropagation.indexOf(eventKey) !== -1) {
            event.stopPropagation();
        }
    } else if (event.type === 'keyup') {
        silverKey.modifiers.repeat = false;
        if (eventKey === 'PrintScreen') {
            silverKey._currentSequence += eventKey;
            if (silverKey._activeKeys.PrintScreen !== undefined) {
                silverKey.runKeyAction('PrintScreen', newEventTime);
            }
            silverKey.runSequences();
        } else {
            silverKey._currentCombo.splice(silverKey._currentCombo.indexOf(eventKey), 1);
        }
        if (eventKey === 'Meta') {
            // corrects for IE and FireFox
            silverKey.modifiers.metaKey = false;
        }
    } else if (event.type === 'blur') {
        // use silverKey.bindKey('blur'...) for onblur behavior
        eventKey = 'blur';
        if (silverKey._activeKeys.blur !== undefined) {
            silverKey._activeKeys.blur();
        }
    }
    silverKey._lastEventTime = newEventTime;
    if (!silverKey._debug) {
        silverKey.keyInput = eventKey;
    } else {
        // returned in debug mode; primarily for use with associated demo.html
        silverKey.keyInput = {
            result: eventKey,
            eventType:  event.type,
            eventKey:   event.key,
            eventKeyCode: event.keyCode,
            shiftKey: silverKey.modifiers.shiftKey,
            capsLock: silverKey.modifiers.capsLock,
            repeating: silverKey.modifiers.repeat,
            altKey: silverKey.modifiers.altKey,
            ctrlKey: silverKey.modifiers.ctrlKey,
            metaKey: silverKey.modifiers.metaKey,
            history: silverKey._currentSequence,
            combo: silverKey._currentCombo,
            binds: silverKey._activeKeys,
            shortcuts: silverKey._activeShortcuts,
            sequences: silverKey._activeSequenceKeys,
        };
    }
};