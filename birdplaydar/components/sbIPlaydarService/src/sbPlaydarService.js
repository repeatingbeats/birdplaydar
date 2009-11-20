
/*
 * sbIPlaydarService XPCOM Service Implementation
 *
 * Copyright (c) 2009 Steven M. Lloyd
 * steve@repeatingbeats.com
 *
 *
 * This file is part of the Birdplaydar Songbird add-on.
 *
 * This file may be licensed under the terms of of the
 * GNU General Public License Version 2 (the ``GPL'').
 *
 * Software distributed under the License is distributed
 * on an ``AS IS'' basis, WITHOUT WARRANTY OF ANY KIND, either
 * express or implied. See the GPL for the specific language
 * governing rights and limitations.
 *
 * You should have received a copy of the GPL along with this
 * program. If not, go to http://www.gnu.org/licenses/gpl.html
 * or write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
 *
 * -----------------------------------------------------------------------------
 * 
 * This source code is derived in part from the playdar.js JavaScript library
 * by James Wheare, available at http://github.com/jwheare/playdar.js
 * The original copyright and license of playdar.js are as follows:
 *
 * Copyright (c) James Wheare
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *   
 *   1. Redistributions of source code must retain the above copyright notice, 
 *      this list of conditions and the following disclaimer.
 *   
 *   2. Redistributions in binary form must reproduce the above copyright 
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the distribution.
 *   
 *   3. Neither the name of James Wheare nor the names of its contributors may
 *      be used to endorse or promote products derived from this software
 *      without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
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
const PLAYDAR_LIBRARY_DB_GUID = "playdar@repeatingbeats.com";
// URN for service pane folder
const PLAYDAR_SERVICE_PANE_URN = "urn:playdar";
// custom property IDs
const PLAYDAR_PROP_ID_SOURCE = "http://repeatingbeats.com/playdar/1.0#source";
const PLAYDAR_PROP_ID_SCORE = "http://repeatingbeats.com/playdar/1.0#score";

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

  var sps = Cc['@songbirdnest.com/servicepane/service;1']
              .getService(Ci.sbIServicePaneService);
  sps.init();
 
  // create service pane folder and library node if necessary
  var playdarFolderNode = sps.getNode(PLAYDAR_SERVICE_PANE_URN);
  if (null == playdarFolderNode) {
    playdarFolderNode = sps.addNode('urn:playdar',sps.root,true);
    playdarFolderNode.name = "Playdar";
    playdarFolderNode.hidden = false;
    playdarFolderNode.editable = false;
    playdarFolderNode.properties = "folder playdar";
    playdarFolderNode.setAttributeNS(
        "http://songbirdnest.com/rdf/servicepane#", "Weight", 5);
    
    // create the library node
    var libSps = Cc['@songbirdnest.com/servicepane/library;1']
                       .getService(Ci.sbILibraryServicePaneService);
    var playdarLibraryNode = libSps.createNodeForLibrary(this.playdarLibrary);
    playdarLibraryNode.setAttributeNS(
          "http://songbirdnest.com/rdf/servicepane#", "Weight", 6);
    playdarFolderNode.appendChild(playdarLibraryNode);
    playdarLibraryNode.hidden = false;
    sps.save();
  }
  playdarFolderNode.hidden = false;
  this.playdarServiceNode = playdarFolderNode;
 
  // create properties for Playdar source and Playdar score
  var propManager = Cc['@songbirdnest.com/Songbird/Properties/PropertyManager;1']
                      .getService(Ci.sbIPropertyManager);
 
  var source = Cc['@songbirdnest.com/Songbird/Properties/Info/Text;1']
                 .createInstance(Ci.sbITextPropertyInfo);
  source.id = PLAYDAR_PROP_ID_SOURCE;
  source.userEditable = false;
  source.remoteReadable = false;
  source.remoteWritable = false;
  source.displayName = "Source";
  propManager.addPropertyInfo(source);

  var score = Cc['@songbirdnest.com/Songbird/Properties/Info/Text;1']
                 .createInstance(Ci.sbITextPropertyInfo);
  score.id = PLAYDAR_PROP_ID_SCORE;
  score.userEditable = false;
  score.remoteReadable = false;
  score.remoteWritable = false;
  score.displayName = "Score";
  propManager.addPropertyInfo(score);

  this.sourcePropID = PLAYDAR_PROP_ID_SOURCE;
  this.scorePropID = PLAYDAR_PROP_ID_SCORE;

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
  MAX_POLLS : 15,

  resolveQids : [],
  lastQid : "",
  pollCounts : {},
  listeners : [],
  keepHidden : [],

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

  registerClient : function(listener,keepTracksHidden) {
  
    var list = this.playdarLibrary.createMediaList('simple');
    var clientID = list.getProperty(SBProperties.GUID);
    listener.clientID = clientID;
    this.listeners[clientID] = listener;
    this.stat(clientID);
    this.keepHidden[clientID] = keepTracksHidden;
    return clientID; 
  },

  unregisterClient : function(cid,removeClientList,removeAllTracks,removeHiddenTracks) {
    
    var list = this.getClientList(cid);
    if (removeAllTracks) {
      // remove all tracks on this client's list from the playdar library
      this.removeItemsByProperty(list,SBProperties.isList,"0"); 
    } else {
       if (removeHiddenTracks) {
        // remove all hidden tracks on client's list from the playdar library
        this.removeItemsByProperty(list,SBProperties.hidden,"1");
      }
    }
 
    if (removeClientList) {
      // remove this client's results list from the playdar library
      this.playdarLibrary.remove(list);
    }
    // remove the playdarServiceListener
    delete this.listeners[cid];
  },

  removeItemsByProperty : function(list,prop,value) {
    
    try {
      var trackArray = list.getItemsByProperty(prop,value);
      this.playdarLibrary.removeSome(trackArray.enumerate());
    } catch (err) {
      // not an error, just no tracks with the prop/value
    }
  },

  addClientListListener : function(cid,listener,ownsWeak,flags,filter) {
    
    var list = this.playdarLibrary.getItemByGuid(cid);
    list.addListener(listener,ownsWeak,flags,filter);
  },

  getClientList : function(cid) {

    return this.playdarLibrary.getItemByGuid(cid);
  },

  showClientListInServicePane : function(cid,name) {

    var list = this.getClientList(cid);
    list.name = name;
    list.setProperty(SBProperties.hidden,"0");
    
    var listener =  {
      onEnumerationBegin : function(list) {},
      onEnumeratedItem : function(list,item) {
        item.setProperty(SBProperties.hidden,"0")
      },
      onEnumerationEnd : function(list,code) {}
    };
    list.enumerateAllItems(listener);
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
      // need to do something smarter here
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
    var clientList = this.getClientList(cid);
    for (var r in results) {
      var currResult = results[r];
      var sid = currResult.sid;
      if (!this.listContainsSid(clientList,sid)) {
        this.addTrackToList(clientList,currResult,cid);
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

  addTrackToList : function(mediaList,result,cid) {
    
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
      propArray.appendProperty(SBProperties.duration,result.duration*1000000);
    if(result.source)
      propArray.appendProperty(PLAYDAR_PROP_ID_SOURCE,result.source);
    if(result.score)
      propArray.appendProperty(PLAYDAR_PROP_ID_SCORE,result.score);

    var hidden = this.keepHidden[cid] ? "1" : "0";
    propArray.appendProperty(SBProperties.hidden,hidden);
  
    propArray.appendProperty(SBProperties.isList,"0");
    
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
    return finalAnswer;
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
