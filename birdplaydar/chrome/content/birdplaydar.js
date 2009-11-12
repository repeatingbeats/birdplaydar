if (typeof(Cc) == 'undefined')
  var Cc = Components.classes;
if (typeof(Ci) == 'undefined')
  var Ci = Components.interfaces;
if (typeof(Cu) == 'undefined')
  var Cu = Components.utils;
if (typeof(Cr) == 'undefined')
  var Cr = Components.results;

Cu.import("resource://app/jsmodules/sbProperties.jsm");
Cu.import("resource://app/jsmodules/sbLibraryUtils.jsm");
Cu.import("resource://app/jsmodules/kPlaylistCommands.jsm");


if (typeof Birdplaydar == 'undefined') {
  var Birdplaydar = {};
}

Birdplaydar.Utils = {

  SERVER_ROOT : "localhost",
  SERVER_PORT : "60210",
  STAT_TIMEOUT : 2000,
  MAX_CONCERRENT_RESOLUTIONS : 5,
  REFRESH_INTERVAL : null,

  listeners : {},

  register_listeners : function(listeners) {
    
    if (!listeners) {
      return;
    }
    for (var event in listeners) {
      this.register_listener(event, listeners[event]);
    }
    return true;
  },

  register_listener : function(event, callback) {
      
      callback = callback || this.null_callback;
      var utils = this;
      this.listeners[event] = function() {
        return callback.apply(utils,arguments); };
  },

  stat : function() {
    setTimeout(function () {
      Birdplaydar.Utils.check_stat_timeout();
      }, Birdplaydar.Utils.STAT_TIMEOUT);
    this.callAPI('stat', null, function(r) { Birdplaydar.Utils.handle_stat(r); } );
  },

  check_stat_timeout : function() {
    if (!this.stat_response) {
       this.listeners.onStat(false);
    }
  },

  resolve : function (artist,album,track,qid,url) {
    
    var params = {
      artist : artist || '',
      album : album || '',
      track : track || '',
      url : url || '',
      qid : qid || this.generate_uuid(),
    };

    this.callAPI("resolve",params,
         function(resp) { Birdplaydar.Utils.handle_resolution(resp);});
  },

  handle_resolution : function(resp) {
    this.qid = resp.qid;
    this.poll_counts  = 0;
    this.get_results(this.qid); 
  },

  get_results : function (qid) {
    
    this.poll_counts++;
    var params = {
      qid : qid,
      poll : this.poll_counts
    };
    this.callAPI("get_results",params,
         function(resp) { Birdplaydar.Utils.handle_results(resp);});
  },

  handle_results : function(resp) {
    //alert(resp); 
    var final_answer = this.poll_results(resp,this.get_results);
    this.listeners.onResults(resp,final_answer);
    if (final_answer) {
      // add stuff when hosting multiple queries
    }
  },

  poll_results : function(resp,callback,scope) {
    
    var final_answer = this.should_stop_polling(resp);
    scope = scope || this;
    if (!final_answer) {
      setTimeout(function() {
          callback.call(scope,resp.qid);
      }, this.REFRESH_INTERVAL || resp.refresh_interval);
    }
    return final_answer;
  },

  should_stop_polling : function (response) {
    
    // stop if exceeded refresh limit
    if (response.refresh_interval <= 0) {
      return true;
    }
    if (response.query.solved == true) {
      return true;
    }
    if (this.poll_counts >= 30) {
      return true;
    }
    return false;
  },

  // only code xhr once!
  getUrlFromSid : function(sid) {

    var url = this.get_base_url('/sid/') + sid;
    var req = new XMLHttpRequest();
    req.open('GET',url,true);
    req.onreadystatechange = function(e) {
      if (req.readyState == 4) {
        if (req.status==200) {
          Birdplaydar.Utils.listeners.onUrl(req.responseText);
        } else {
          alert("sid request error");
        }
      }
    };
    req.send(null);
  },

  callAPI : function (method, params, callback) {
   
   var JSON = Cc['@mozilla.org/dom/json;1']
                 .createInstance(Ci.nsIJSON);

    params = params || {};
    params.call_id = new Date().getTime();
    params.method = method;

    var url = this.get_base_url('/api/',params);
    var req = new XMLHttpRequest();
    req.open('GET',url,true);
    req.onreadystatechange = function (e) {
      if (req.readyState == 4) {
        if (req.status == 200) {
          //alert(req.responseText);
          callback(JSON.decode(req.responseText));
        } else {
          alert("xmlhttprequest error");
        }
      }
    };
    req.send(null);  

  },

  handle_stat : function (resp) {
    this.stat_response = resp;
    this.listeners.onStat(resp);
  },

  get_base_url : function(path,params) {
    
    var url = "http://" + this.SERVER_ROOT + ":" + this.SERVER_PORT;
    if (path) {
      url += path;
    }
    if (params) {
      url += '?' + this.toQueryString(params);
    }

    return url;
  },

  toQueryString : function(params) {
    
    var results = [];
    for (var key in params) {
      var values = params[key];
      key = encodeURIComponent(key);
            
      if (Object.prototype.toString.call(values) == '[object Array]') {
        for (var i = 0; i < values.length; i++) {
          results.push(this.toQueryPair(key, values[i]));
        }
      } else {
        results.push(this.toQueryPair(key, values));
      }
    }
    return results.join('&');
  },

  toQueryPair: function (key, value) {

    if (value === null) {
      return key;
    }
    return key + '=' + encodeURIComponent(value);
  },

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


  null_callback : function() {}

};

Birdplaydar.DefaultListeners = {

  onStat : function(detected) {
    if (detected) {
      // Playdar detected
    } else {
      // Playdar not found
    }
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

  onResolveIdle: function () {
    // Resolution queue is empty and nothing in progress
  }

};

