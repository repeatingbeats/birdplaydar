
/*
 * Implementation of sbIPlaydarService XPCOM service. Manages
 * interaction between Songbird and Playdar API.
 *
 * Derived from playdar javascript library at
 * http://github.com/jwheare/playdar.js (James Wheare)
 *
 */

if(typeof(Cc)=="undefined")
  var Cc = Components.classes;
if(typeof(Ci)=="undefined")
  var Ci = Components.interfaces;
if(typeof(Cu)=="undefined")
  var Cu = Components.utils;
if(typeof(Cr)=="undefined")
  var Cr = Components.results;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");  
Cu.import("resource://app/jsmodules/sbProperties.jsm");
Cu.import("resource://app/jsmodules/sbLibraryUtils.jsm");

// XPCOM component details
const DESCRIPTION = "Playdar Service";
const CID         = Components.ID("57b773d6-7a0f-41f1-8ef1-768109d47e1c");
const CONTRACTID  = "@repeatingbeats.com/playdar/playdar-service;1";

// GUID for the playdar library database
const PLAYDAR_LIBRARY_DB_GUID = "playdar@repeatingbeats.com"

// XPCOM component constructor
function sbIPlaydarService() {
  
  // get the playdar library (and create if it doesn't exist)
  var playdarLibrary = null;
  try {
    var libraries = LibraryUtils.manager.getLibraries();
    while (libraries.hasMoreElements()) {
      var lib = libraries.getNext();
      var dbguid = lib.QueryInterface(Ci.sbILocalDatabaseLibrary).databaseGuid;
      if (dbguid == PLAYDAR_LIBRARY_DB_GUID) {
        playdarLibrary = lib;
        break;
      }
    }
  } catch(err) {
    Cu.reportError(err);
  }
  
  if (!playdarLibrary) {
    var dir = Cc['@mozilla.org/file/directory_service;1']
                .getService(Ci.nsIProperties)
                .get("ProfD",Ci.nsIFile);
    dir.append("db");
    var playdarDB = dir.clone();
    playdarDB.append((PLAYDAR_LIBRARY_DB_GUID + ".db"));

    var libFactory =
        Cc['@songbirdnest.com/Songbird/Library/LocalDatabase/LibraryFactory;1']
          .getService(Ci.sbILibraryFactory);
    var propBag = Cc['@mozilla.org/hash-property-bag;1']
                    .createInstance(Ci.nsIWritablePropertyBag2);
    propBag.setPropertyAsInterface("databaseFile",playdarDB);
    playdarLibrary = libFactory.createLibrary(propBag);
    LibraryUtils.manager.registerLibrary(playdarLibrary,true);
  }
  this.playdarLibrary = playdarLibrary;

  // init resolution vars
  this.resQueue = [];
  this.resInProgress = {
    count : 0,
    queries : {}
  };
};

sbIPlaydarService.prototype.constructor = sbIPlaydarService;

sbIPlaydarService.prototype = {

  // XPCOM details
  classDescription: DESCRIPTION,
  classID:  Components.ID(CID),
  contractID:  CONTRACTID,

  QueryInterface : function(aIID) {
    if (aIID.equals(Ci.sbIPlaydarService)) {
      return this;
    }
    if (!aIID.equals(Ci.nsISupports)) {
      throw Cr.NS_ERROR_NO_INTERFACE;
    }
    return this;
  },

  // ---- end boilerplate

  VERSION : "0.0.0.1",
  SERVER_ROOT : "localhost",
  SERVER_PORT : "60210",
  STAT_TIMEOUT : 2000,
  MAX_CONCURRENT_RESOLUTIONS : 10,
  REFRESH_INTERVAL : null,
  MAX_POLLS : 5,

  resolveQids : [],
  lastQid : "",
  pollCounts : {},
  listeners : [],

  JSON : Cc['@mozilla.org/dom/json;1'].createInstance(Ci.nsIJSON),
  
  callAPI : function(method, params, callback) {

    params = params || {};
    params.call_id = new Date().getTime();
    params.method = method;

    var url = this.getBaseUrl('/api/',params);
    var req = Cc['@mozilla.org/xmlextras/xmlhttprequest;1']
                .createInstance(Ci.nsIXMLHttpRequest);
    req.open('GET',url,true);
    req.onreadystatechange = function(e) {
      if (req.readyState == 4) {
        if (req.status == 200) {
          callback(req.responseText);
        } else {
          Cu.reportError("playdar api xmlhttprequest error");
        }
      }
    };
    req.send(null);
  },

  /*
   * Register a new client. Create a medialist in the Playdar library,
   * attach the client's listener to the list, and return the guid
   * of the list. This guid doubles as the client's unique cid so 
   * the service knows which list to update when the client calls resolve.
   */
  registerClient : function(listener) {
  
    var list = this.playdarLibrary.createMediaList('simple');
    var clientID = list.getProperty(SBProperties.GUID);
    listener.clientID = clientID;
    this.listeners[clientID] = listener;
    this.stat(clientID);
    
    var dbstr = "";
    for (var i in this.listeners) {
      dbstr += this.listeners[i].clientID + "\n";
    }
    Cu.reportError(dbstr);    

    return clientID; 
  },

  unregisterClient : function(cid) {

    this.playdarLibrary.remove(this.playdarLibrary.getItemByGuid(cid));
  },

  addResultsListListener : function(cid,listener,ownsWeak,flags,filter) {
    
    var list = this.playdarLibrary.getItemByGuid(cid);
    list.addListener(listener,ownsWeak,flags,filter);
  },

  getClientResultsList : function(cid) {

    return this.playdarLibrary.getItemByGuid(cid);
  },

  stat : function(cid) {
      
      var svc = this;
      this.setTimeout(function () {
        svc.checkStatTimeout(cid);
      }, this.STAT_TIMEOUT);
      this.callAPI('stat', null, function(resp) {
          svc.handleStat(resp,cid);
      });
  },

  checkStatTimeout : function(cid) {
    
    if (!this.statResponse) {
      this.getListenerByCid(cid).onStat(false);
    }
  },

  handleStat : function (resp,cid) {
    var resp = this.JSON.decode(resp);
    this.statResponse = resp;
    this.getListenerByCid(cid).onStat(resp);
  },

  resolve : function(cid,artist,album,track,qid,url) {

    var params = {
      artist : artist || '',
      album  : album || '',
      track  : track || '',
      url    : url || '',
      qid    : qid || this.generateUUID()
    };

    var query = {
      cid : cid,
      params : params,
    }

    this.resQueue.push(query);
    this.processResolutionQueue();
  },

  handleResolution : function(resp,cid) {
  
    var query = this.JSON.decode(resp);
    if (this.resInProgress.queries[query.qid]) {
      this.lastQid = query.qid;
      this.resolveQids.push(this.lastQid);
      this.getResults(query.qid,cid);
    }
  },

  processResolutionQueue : function() {
    
    if (this.resInProgress.count >= this.MAX_CONCURRENT_RESOLUTIONS) {
      return false;
    }

    var resCount = this.resQueue.length + this.resInProgress.count;
    if (resCount) {
      var availableSlots = this.MAX_CONCURRENT_RESOLUTIONS -
                           this.resInProgress.count;
      for (var i = 1; i <= availableSlots; i++) {
        var query = this.resQueue.shift();
        if (!query) {
          break;
        }
        this.resInProgress.queries[query.params.qid] = query;
        this.resInProgress.count++;
        var svc = this;
        var cid = query.cid;
        this.callAPI('resolve', query.params, function(resp) { 
            svc.handleResolution(resp,cid); });
      }
    } else {
      // onResolveIdle
    }
  },

  getResults : function(qid,cid) {

    if (this.resInProgress.queries[qid]) {
      if (!this.pollCounts[qid]) {
        this.pollCounts[qid] = 0;
      }
      var svc = this;
      this.pollCounts[qid]++;
      this.callAPI('get_results', { qid : qid, poll : this.pollCounts[qid] },
        function (resp) {
          svc.handleResults(resp,cid);
      });
    }
  },

  handleResults : function(resp,cid) {
    
    var decodedResp = this.JSON.decode(resp);
    if (this.resInProgress.queries[decodedResp.qid]) {
      var finalAnswer = this.pollResults(decodedResp,cid);
      this.getListenerByCid(cid).onResults(resp,finalAnswer);
      this.processResults(decodedResp,cid);
      if (finalAnswer) {
        delete this.resInProgress.queries[decodedResp.qid];
        this.resInProgress.count--; 
        this.processResolutionQueue();
      }
    }
  },

  processResults : function(decodedResp,cid) {
    
    var results = decodedResp.results; 
    var clientList = this.getClientResultsList(cid);
    for (var r in results) {
      var currResult = results[r];
      var sid = currResult.sid;
      if (!this.listContainsSid(clientList,sid)) {
        Cu.reportError("adding " + currResult.track + " to " + cid);
        this.addTrackToList(clientList,currResult);
      }
    }
  },

  listContainsSid : function(mediaList,sid) {

    var sidContentUri = this.getUriForSid(sid);
    var contains = false;
    var listener =  {
      onEnumerationBegin : function(list) {},
      onEnumeratedItem : function(list,item) {
        if (item.contentSrc.equals(sidContentUri)) {
          contains = true;
        }
      },
      onEnumerationEnd : function(list,code) {}
    };
    mediaList.enumerateAllItems(listener);
    return contains;
  },

  getUriForSid : function(sid) {
    
    var ioSvc = Cc['@mozilla.org/network/io-service;1']
                  .getService(Ci.nsIIOService);
    var uri = ioSvc.newURI(this.getBaseUrl('/sid/') + sid,null,null);
    var libUtils = Cc['@songbirdnest.com/Songbird/library/Manager;1']
                     .getService(Ci.sbILibraryUtils);
    return libUtils.getContentURI(uri);
  },

  addTrackToList : function(mediaList,result) {
    
    var propArray =
      Cc['@songbirdnest.com/Songbird/Properties/MutablePropertyArray;1']
        .createInstance(Ci.sbIMutablePropertyArray);

    if(result.track)
      propArray.appendProperty(SBProperties.trackName,result.track);
    if(result.artist)
      propArray.appendProperty(SBProperties.artistName,result.artist);
    if(result.album)
      propArray.appendProperty(SBProperties.albumName,result.album);
    if(result.bitrate)
      propArray.appendProperty(SBProperties.bitRate,result.bitrate);
    if(result.duration)
      propArray.appendProperty(SBProperties.duration,result.duration);
    
    var contentURI = this.getUriForSid(result.sid);
    
    var mediaItem = this.playdarLibrary.createMediaItem(contentURI,propArray);
    
    mediaList.add(mediaItem);
  },
  
  pollResults : function(decodedResp,cid) {

    var finalAnswer = this.shouldStopPolling(decodedResp);
    var svc = this;
    if (!finalAnswer) {
      this.setTimeout( function() {
        svc.getResults(decodedResp.qid,cid);
      }, decodedResp.poll_interval || decodedResp.refresh_interval);
    }
  },

  shouldStopPolling : function(decodedResp) {
    
    if (decodedResp.poll_interval <= 0 || decodedResp.refresh_interval <=0) {
      return true;
    }
    if (decodedResp.solved == true) {
      return true;
    }
    if (this.pollCounts[decodedResp.qid] >=
        (decodedResp.poll_limit || this.MAX_POLLS)) {
      return true;
    }
    return false;
  },

  getListenerByCid : function(cid) {
    return this.listeners[cid];
  },

  getBaseUrl : function(path,params) {

    var url = "http://" + this.SERVER_ROOT + ":" + this.SERVER_PORT;
    if (path) {
      url += path;
    }
    if (params) {
      url +=  "?" + this.toQueryString(params);
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

  setTimeout : function(callback,timeout) {
  
    this.getWindow().setTimeout(callback,timeout);
  },

  getWindow : function() {

    return Cc['@mozilla.org/appshell/window-mediator;1']
             .getService(Ci.nsIWindowMediator)
             .getMostRecentWindow("Songbird:Main").window;
  },

  /**
   * Based on: Math.uuid.js
   * Copyright (c) 2008, Robert Kieffer. All rights reserved.
   * License/info: http://www.broofa.com/blog/2008/09/javascript-uuid-function/
   **/
  generateUUID: function () {
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

// doing this the long way instead of using XPCOMUtils so we can 
// ensure the service is a singleton
var sbIPlaydarServiceFactory = {

  singleton : null,

  createInstance : function(aOuter, aIID) {
    if (aOuter != null) {
      throw Cr.NS_ERROR_NO_AGGREGATION;
    }
    if (this.singleton == null) {
      this.singleton = new sbIPlaydarService();
    }
    return this.singleton.QueryInterface(aIID);
  }
};

var sbIPlaydarServiceModule = {

  registerSelf : function(aCompMgr, aFileSpec, aLocation, aType) {
    aCompMgr = aCompMgr.QueryInterface(Ci.nsIComponentRegistrar);
    aCompMgr.registerFactoryLocation(CID, DESCRIPTION, CONTRACTID,
                                     aFileSpec, aLocation, aType);
  },

  unregisterSelf : function(aCompMgr, aLocation, aType) {
    aCompMgr = aCompMgr.QueryInterface(Ci.nsIComponentRegistrar);
    aCompMgr.unregisterFactoryLocation(CID, aLocation);
  },

  getClassObject : function(aCompMgr, aCID, aIID) {
    if (!aIID.equals(Ci.nsIFactory)) {
      throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    }
    if (aCID.equals(CID)) {
      return sbIPlaydarServiceFactory;
    }
    throw Cr.NS_ERROR_NO_INTERFACE;
  },
  
  canUnload : function(aCompMgr) {
    return true;
  }
};

function NSGetModule(aCompMgr, aFileSpec) { return sbIPlaydarServiceModule; }
