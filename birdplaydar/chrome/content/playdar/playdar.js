Playdar = {
    VERSION: "0.4.4",
    SERVER_ROOT: "localhost",
    SERVER_PORT: "60210",
    STATIC_HOST: "http://www.playdar.org",
    STAT_TIMEOUT: 2000,
    AUTH_POPUP_NAME: "PD_auth",
    AUTH_POPUP_SIZE: {
        'w': 500,
        'h': 260
    },
    QUERIES_POPUP_NAME: "PD_queries",
    QUERIES_POPUP_SIZE: {
        'w': 640,
        'h': 700
    },
    REFRESH_INTERVAL: null,
    MAX_CONCURRENT_RESOLUTIONS: 5,
    USE_STATUS_BAR: false,
    USE_SCROBBLER: false,
    
    client: null,
    status_bar: null,
    player: null,
    setup: function (auth_details) {
        new Playdar.Client(auth_details);
        //new Playdar.Boffin();
    },
    setup_player: function (soundmanager) {
        //new Playdar.Player(soundmanager);
    },
    unload: function () {
        if (Playdar.player) {
            // Stop the music
            Playdar.player.stop_current(true);
        } else if (Playdar.scrobbler) {
            // Stop scrobbling
            Playdar.scrobbler.stop();
        }
    }
};

Playdar.DefaultListeners = {
    onStat: function (detected) {
        if (detected) {
            // Playdar detected
        } else {
            // Playdar not found
        }
    },
    onAuth: function () {
        // Playdar authorised
    },
    onAuthClear: function () {
        // Playdar deauthorised
    },
    onResults: function (response, final_answer) {
        if (final_answer) {
            if (response.results.length) {
                // Found results
            } else {
                // No results
            }
        } else {
            // Still polling
        }
    },
    onTagCloud: function (response) {
        // Tag cloud response
    },
    onRQL: function (response) {
        // RQL playlist response
    },
    onResolveIdle: function () {
        // Resolution queue is empty and nothing in progress
    }
};

Playdar.Client = function (auth_details, listeners) {
    Playdar.client = this;
    
    this.auth_token = false;
    this.auth_popup = null;
    
    this.listeners = {};
    this.results_handlers = {};
    
    this.resolve_qids = [];
    this.last_qid = "";
    this.poll_counts = {};
    
    /**
     * A query resolution queue consumed by process_resolution_queue, which is called
     * each time a final_answer is received from the daemon.
    **/
    this.initialise_resolve();
    
    // Setup auth
    this.auth_details = auth_details;
    // Setup listeners
    this.register_listeners(Playdar.DefaultListeners);
    this.register_listeners(listeners);
    
    this.uuid = Playdar.Util.generate_uuid();
    alert("uuid: " + this.uuid);
};
Playdar.Client.prototype = {
    register_listener: function (event, callback) {
        callback = callback || Playdar.Util.null_callback;
        this.listeners[event] = function () { return callback.apply(Playdar.client, arguments); };
    },
    register_listeners: function (listeners) {
        if (!listeners) {
            return;
        }
        for (var event in listeners) {
            this.register_listener(event, listeners[event]);
        }
        return true;
    },
    // Custom search result handlers can be bound to a specific qid
    register_results_handler: function (handler, qid) {
        if (qid) {
            this.results_handlers[qid] = handler;
        } else {
            this.register_listener('onResults', handler);
        }
    },
    
    // INIT / STAT / AUTH
    
    init: function () {
        //if (!this.auth_token) {
          //this.auth_token = Playdar.Util.getcookie('auth');
        //}
        //this.auth_token = true;
        //this.stat();
        this.auth_callback(this.uuid);
    },
    
    stat: function () {
        setTimeout(function () {
            Playdar.client.check_stat_timeout();
        }, Playdar.STAT_TIMEOUT);
        Playdar.Util.loadjs(this.get_url("stat", "handle_stat"));
    },
    check_stat_timeout: function () {
        if (!this.stat_response || this.stat_response.name != "playdar") {
            this.listeners.onStat(false);
        }
    },
    handle_stat: function (response) {
        this.stat_response = response;
        // Update status bar
        if (Playdar.USE_STATUS_BAR) {
            new Playdar.StatusBar();
            Playdar.status_bar.handle_stat(response);
        }
        this.listeners.onStat(response);
        
        if (response.authenticated) {
            // Setup scrobbling if we haven't already, if it's enabled globally
            // and if the daemon has it enabled
            if (!Playdar.scrobbler && Playdar.USE_SCROBBLER && response.capabilities.audioscrobbler) {
                new Playdar.Scrobbler();
            }
            this.listeners.onAuth();
        } else if (this.auth_token) {
            this.clear_auth();
        }
    },
    clear_auth: function () {
        Playdar.unload();
        // Revoke auth at the server
        Playdar.Util.loadjs(this.get_revoke_url());
        // Clear auth token
        this.auth_token = false;
        Playdar.Util.deletecookie('auth');
        // Callback
        this.listeners.onAuthClear();
        // Update status bar
        if (Playdar.status_bar) {
            Playdar.status_bar.offline();
        }
    },
    is_authed: function () {
        if (this.auth_token) {
            return true;
        }
        return false;
    },
    get_revoke_url: function () {
        return this.get_base_url("/settings/auth/", {
            revoke: this.auth_token,
            jsonp: 'Playdar.Util.null_callback'
        });
    },
    get_auth_url: function () {
        return this.get_base_url("/auth_1/", this.auth_details);
    },
    get_auth_link_html: function (title) {
        title = title || "Connect";
        var html = '<a href="' + this.get_auth_url()
            + '" target="' + Playdar.AUTH_POPUP_NAME
            + '" onclick="Playdar.client.start_auth(); return false;'
        + '">' + title + '</a>';
        return html;
    },
    get_disconnect_link_html: function (text) {
        text = text || "Disconnect";
        var html = '<a href="' + this.get_base_url('/settings/auth/')
            + '" onclick="Playdar.client.clear_auth(); return false;'
        + '">' + text + '</a>';
        return html;
    },
    start_auth: function () {
        if (!this.auth_popup || this.auth_popup.closed) {
            this.auth_popup = window.open(
                this.get_auth_url(),
                Playdar.AUTH_POPUP_NAME,
                Playdar.Util.get_popup_options(Playdar.AUTH_POPUP_SIZE)
            );
        } else {
            this.auth_popup.focus();
        }
        if (!this.auth_details.receiverurl) {
            // Show manual auth form
            if (Playdar.status_bar) {
                Playdar.status_bar.start_manual_auth();
            }
        }
    },
    
    auth_callback: function (token) {
        //Playdar.Util.setcookie('auth', token, 365);
        //if (this.auth_popup && !this.auth_popup.closed) {
        //    this.auth_popup.close();
        //    this.auth_popup = null;
        //}
        this.auth_token = token;
        this.stat();
    },
    manual_auth_callback: function (input_id) {
        var input = document.getElementById(input_id);
        if (input && input.value) {
            this.auth_callback(input.value);
        }
    },
    
    // CONTENT RESOLUTION
    
    parse_microformats: function (context) {
        var tracks = [];
        var elements = Playdar.Util.select('.haudio', context);
        for (var i = 0; i < elements.length; i++) {
            var element = elements[i];
            var item_artist = Playdar.Util.select('.contributor', element);
            var item_track = Playdar.Util.select('.fn', element);
            if (item_track[0] && item_artist[0]) {
                var track = {
                    'artist': item_artist[0].title || item_artist[0].innerHTML,
                    'name': item_track[0].title || item_track[0].innerHTML,
                    'element': element
                };
                tracks.push(track);
            }
        }
        return tracks;
    },
    
    /**
     * Playdar.client.autodetect([callback][, context])
     * - callback (Function): Function to be run for each track to be resolved
     *      Will be passed the track object. If this returns a qid, it will be
     *      passed on to the resolve call.
     * - context (DOMElement): A DOM node to use to scope the selector
     * 
     * Attempts to detect any mentions of a track on a page or within a node
     * and resolves them.
    **/
    autodetect: function (callback, context) {
        var track, qid;
        var tracks = this.parse_microformats(context);
        for (var i = 0; i < tracks.length; i++) {
            track = tracks[i];
            if (callback) {
                qid = callback(track);
            }
            Playdar.client.resolve(track.artist, '', track.name, qid);
        }
    },
    
    resolve: function (artist, album, track, qid, url) {
        var query = {
            artist: artist || '',
            album: album || '',
            track: track || '',
            url: url || '',
            qid: qid || Playdar.Util.generate_uuid()
        };
        // Update resolving progress status
        if (Playdar.status_bar) {
            Playdar.status_bar.increment_requests();
        }
        
        this.resolution_queue.push(query);
        this.process_resolution_queue();
    },
    process_resolution_queue: function() {
        if (this.resolutions_in_progress.count >= Playdar.MAX_CONCURRENT_RESOLUTIONS) {
            return false;
        }
        // Check we've got nothing queued up or in progress
        var resolution_count = this.resolution_queue.length + this.resolutions_in_progress.count;
        if (resolution_count) {
            var available_resolution_slots = Playdar.MAX_CONCURRENT_RESOLUTIONS - this.resolutions_in_progress.count;
            for (var i = 1; i <= available_resolution_slots; i++) {
                var query = this.resolution_queue.shift();
                if (!query) {
                    break;
                }
                this.resolutions_in_progress.queries[query.qid] = query;
                this.resolutions_in_progress.count++;
                Playdar.Util.loadjs(this.get_url("resolve", "handle_resolution", query));
            }
        } else {
            this.listeners.onResolveIdle();
        }
    },
    cancel_resolve: function () {
        this.initialise_resolve();
        if (Playdar.status_bar) {
            Playdar.status_bar.cancel_resolve();
        }
    },
    initialise_resolve: function () {
        this.resolution_queue = [];
        this.resolutions_in_progress = {
            count: 0,
            queries: {}
        };
    },
    recheck_results: function (qid) {
        var query = {
            qid: qid 
        };
        this.resolutions_in_progress.queries[qid] = query;
        this.resolutions_in_progress.count++;
        this.handle_resolution(query);
    },
    handle_resolution: function (query) {
        // Check resolving hasn't been cancelled
        if (this.resolutions_in_progress.queries[query.qid]) {
            this.last_qid = query.qid;
            this.resolve_qids.push(this.last_qid);
            this.get_results(query.qid);
        }
    },
    
    // poll results for a query id
    get_results: function (qid) {
        // Check resolving hasn't been cancelled
        if (this.resolutions_in_progress.queries[qid]) {
            if (!this.poll_counts[qid]) {
                this.poll_counts[qid] = 0;
            }
            this.poll_counts[qid]++;
            Playdar.Util.loadjs(this.get_url("get_results", "handle_results", {
                qid: qid,
                poll: this.poll_counts[qid]
            }));
        }
    },
    poll_results: function (response, callback, scope) {
        // figure out if we should re-poll, or if the query is solved/failed:
        var final_answer = this.should_stop_polling(response);
        scope = scope || this;
        if (!final_answer) {
            setTimeout(function () {
                callback.call(scope, response.qid);
            }, Playdar.REFRESH_INTERVAL || response.refresh_interval);
        }
        return final_answer;
    },
    should_stop_polling: function (response) {
        // Stop if we've exceeded our refresh limit
        if (response.refresh_interval <= 0) {
            return true;
        }
        // Stop if the query is solved
        if (response.query.solved == true) {
            return true;
        }
        // Stop if we've exceeded 4 poll requests
        if (this.poll_counts[response.qid] >= 10) {
            return true;
        }
        return false;
    },
    handle_results: function (response) {
        // Check resolving hasn't been cancelled
        if (this.resolutions_in_progress.queries[response.qid]) {
            var final_answer = this.poll_results(response, this.get_results);
            // Status bar handler
            if (Playdar.status_bar) {
                Playdar.status_bar.handle_results(response, final_answer);
            }
            if (this.results_handlers[response.qid]) {
                // try a custom handler registered for this query id
                this.results_handlers[response.qid](response, final_answer);
            } else {
                // fall back to standard handler
                this.listeners.onResults(response, final_answer);
            }
            // Check to see if we can make some more resolve calls
            if (final_answer) {
                delete this.resolutions_in_progress.queries[response.qid];
                this.resolutions_in_progress.count--;
                this.process_resolution_queue();
            }
        }
    },
    get_last_results: function () {
        if (this.last_qid) {
            if (Playdar.status_bar) {
                Playdar.status_bar.increment_requests();
            }
            this.get_results(this.last_qid);
        }
    },
    
    // UTILITY FUNCTIONS
    
    get_base_url: function (path, query_params) {
        var url = "http://" + Playdar.SERVER_ROOT + ":" + Playdar.SERVER_PORT;
        if (path) {
            url += path;
        }
        if (query_params) {
            url += '?' + Playdar.Util.toQueryString(query_params);
        }
        alert(url);
        return url;
    },
    
    /**
     * Playdar.client.get_url(method, jsonp[, query_params]) -> String
     * - method (String): Method to call on the Playdar API
     * - jsonp (String | Array): JSONP Callback name.
     *     If a string, will be passed to Playdar.client.jsonp_callback to build
     *     a callback of the form Playdar.client.<callback>
     *     If an array, will be joined together with dot notation.
     * - query_params (Object): An optional object that defines extra query params
     * 
     * Builds an API URL from a method name, jsonp parameter and an optional object
     * of extra query parameters.
    **/
    get_url: function (method, jsonp, query_params) {
        query_params = query_params || {};
        query_params.call_id = new Date().getTime();
        query_params.method = method;
        if (!query_params.jsonp) {
            if (jsonp.join) { // duck type check for array
                query_params.jsonp = jsonp.join('.');
            } else {
                query_params.jsonp = this.jsonp_callback(jsonp);
            }
        }
        this.add_auth_token(query_params);
        return this.get_base_url("/api/", query_params);
    },
    
    add_auth_token: function (query_params) {
        if (this.auth_token) {
            query_params.auth = this.auth_token;
        }
        return query_params;
    },
    
    // turn a source id into a stream url
    get_stream_url: function (sid) {
        return this.get_base_url("/sid/" + sid);
    },
    
    // build the jsonp callback string
    jsonp_callback: function (callback) {
        return "Playdar.client." + callback;
    },
    
    list_results: function (response) {
        for (var i = 0; i < response.results.length; i++) {
            console.log(response.results[i].name);
        }
    }
};


Playdar.Util = {
    /**
     * Based on: Math.uuid.js
     * Copyright (c) 2008, Robert Kieffer. All rights reserved.
     * License and info: http://www.broofa.com/blog/2008/09/javascript-uuid-function/
    **/
    generate_uuid: function () {
        // Private array of chars to use
        var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
        var uuid = [];
        var rnd = Math.random;
        
        // rfc4122, version 4 form
        var r;
        
        // rfc4122 requires these characters
        uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
        uuid[14] = '4';
        
        // Fill in random data.  At i==19 set the high bits of clock sequence as
        // per rfc4122, sec. 4.1.5
        for (var i = 0; i < 36; i++) {
            if (!uuid[i]) {
                r = 0 | rnd()*16;
                uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r & 0xf];
            }
        }
        return uuid.join('');
    },
    
    // Query string helpers
    toQueryPair: function (key, value) {
        if (value === null) {
            return key;
        }
        return key + '=' + encodeURIComponent(value);
    },
    toQueryString: function (params) {
        var results = [];
        for (var key in params) {
            var values = params[key];
            key = encodeURIComponent(key);
            
            if (Object.prototype.toString.call(values) == '[object Array]') {
                for (var i = 0; i < values.length; i++) {
                    results.push(Playdar.Util.toQueryPair(key, values[i]));
                }
            } else {
                results.push(Playdar.Util.toQueryPair(key, values));
            }
        }
        return results.join('&');
    },
    
    // format secs -> mm:ss helper.
    mmss: function (secs) {
        var s = secs % 60;
        if (s < 10) {
            s = "0" + s;
        }
        return Math.floor(secs/60) + ":" + s;
    },
    
    // JSON loader
    loadjs: function (url) {
       var s = document.createElement("script");
       s.src = url;
       alert("loadjs: " + url);
       //document.getElementsByTagName("head")[0].appendChild(s);
       document.getElementsByTagName("page")[0].appendChild(s);
    },
    
    // Cookie helpers
    setcookie: function (name, value, days) {
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days*24*60*60*1000));
            var expires = "; expires=" + date.toGMTString();
        } else {
            var expires = "";
        }
        document.cookie = "PD_" + name + "=" + value + expires + "; path=/";
    },
    getcookie: function (name) {
        /*
        var namekey = "PD_" + name + "=";
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length;i++) {
            var c = cookies[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1, c.length);
            }
            if (c.indexOf(namekey) == 0) {
                return c.substring(namekey.length, c.length);
            }
        }
        */
        return null;
    },
    deletecookie: function (name) {
        Playdar.Util.setcookie(name, "", -1);
    },
    
    // Window dimension/position helpers
    get_window_position: function () {
        var location = {};
        if (window.screenLeft) {
            location.x = window.screenLeft || 0;
            location.y = window.screenTop || 0;
        } else {
            location.x = window.screenX || 0;
            location.y = window.screenY || 0;
        }
        return location;
    },
    get_window_size: function () {
        return {
            'w': (window && window.innerWidth) || 
                 (document && document.documentElement && document.documentElement.clientWidth) || 
                 (document && document.body && document.body.clientWidth) || 
                 0,
            'h': (window && window.innerHeight) || 
                 (document && document.documentElement && document.documentElement.clientHeight) || 
                 (document && document.body && document.body.clientHeight) || 
                 0
        };
    },
    
    get_popup_options: function (size) {
        var popup_location = Playdar.Util.get_popup_location(size);
        return [
            "left=" + popup_location.x,
            "top=" + popup_location.y,
            "width=" + size.w,
            "height=" + size.h,
            "location=yes",
            "toolbar=no",
            "menubar=yes",
            "status=yes",
            "resizable=yes",
            "scrollbars=yes"
        ].join(',');
    },
    get_popup_location: function (size) {
        var window_location = Playdar.Util.get_window_position();
        var window_size = Playdar.Util.get_window_size();
        return {
            'x': Math.max(0, window_location.x + (window_size.w - size.w) / 2),
            'y': Math.max(0, window_location.y + (window_size.h - size.h) / 2)
        };
    },
    
    // http://ejohn.org/blog/flexible-javascript-events
    addEvent: function (obj, type, fn) {
        if (obj.attachEvent) {
            obj['e'+type+fn] = fn;
            obj[type+fn] = function () {
                obj['e'+type+fn](window.event);
            };
            obj.attachEvent('on'+type, obj[type+fn]);
        } else {
            obj.addEventListener(type, fn, false);
        }
    },
    // Event target helper
    getTarget: function (e) {
        e = e || window.event;
        return e.target || e.srcElement;
    },
    
    extend_object: function (destination, source) {
        source = source || {};
        for (var property in source) {
            destination[property] = source[property];
        }
        return destination;
    },
    
    merge_callback_options: function (callback_options) {
        var option_map = {};
        var keys = [];
        var i, options, option_name;
        // Loop through an array of option objects
        for (i = 0; i < callback_options.length; i++) {
            options = callback_options[i];
            // Process callback functions in each object
            for (option_name in options) {
                if (typeof (options[option_name]) == 'function') {
                    // Collect all matching option callbacks into one callback
                    if (!option_map[option_name]) {
                        keys.push(option_name);
                        option_map[option_name] = [];
                    }
                    option_map[option_name].push(options);
                }
            }
        }
        var final_options = {};
        var key, mapped_options;
        // Merge the mapped callback options
        for (i = 0; i < keys.length; i++) {
            var key = keys[i];
            // Pass in the scope because closures don't really work
            // with shared variables in a loop
            final_options[key] = (function (key, mapped_options) {
                return function () {
                    // Call each function that's been mapped to this property
                    for (var j = 0; j < mapped_options.length; j++) {
                        mapped_options[j][key].apply(this, arguments);
                    }
                };
            })(key, option_map[key]);
        }
        return final_options;
    },
    
    log: function (response) {
        if (typeof console != 'undefined') {
            console.dir(response);
        }
    },
    null_callback: function () {}
};

Playdar.Util.addEvent(window, 'beforeunload', Playdar.unload);



