if (typeof(Cc) == "undefined")
  var Cc = Components.classes;
if (typeof(Ci) == "undefined")
  var Ci = Components.interfaces;
if (typeof(Cu) == "undefined")
  var Cu = Components.utils;
if (typeof(Cr) == "undefined")
  var Cr = Components.results;

Cu.import("resource://app/jsmodules/sbProperties.jsm");
Cu.import("resource://app/jsmodules/sbLibraryUtils.jsm");
Cu.import("resource://app/jsmodules/kPlaylistCommands.jsm");

if (typeof Birdplaydar == 'undefined') {
  var Birdplaydar = {};
}

Birdplaydar.Page = {

  SID_URL_BASE : "http://localhost:60210/sid/",

  _mediaListView: null,

  _playlist: null,
	
  /** 
   * Called when the page finishes loading.  
   */
  onLoad:  function(e) {

    // Make sure we have the javascript modules we're going to use
    if (!window.SBProperties) 
      Cu.import("resource://app/jsmodules/sbProperties.jsm");
    if (!window.LibraryUtils) 
      Cu.import("resource://app/jsmodules/sbLibraryUtils.jsm");
    if (!window.kPlaylistCommands) 
      Cu.import("resource://app/jsmodules/kPlaylistCommands.jsm");

    var cspec = SBProperties.trackName + " 250 " +
                SBProperties.artistName + " 170 " +
                SBProperties.albumName + " 170 " +
                SBProperties.duration + " 40 " +
                SBProperties.bitRate + " 70 " +
                SBProperties.downloadButton + " 85";
    this._mediaList = LibraryUtils.mainLibrary.createMediaList("simple");
    this._mediaList.setProperty(SBProperties.hidden,"1");
    this._mediaList.setProperty(SBProperties.columnSpec,cspec);
    this._playlist = document.getElementById("birdplaydar-playlist");
    
    var mgr = Cc["@songbirdnest.com/Songbird/PlaylistCommandsManager;1"]
                .createInstance(Ci.sbIPlaylistCommandsManager);
    var cmds = mgr.request(kPlaylistCommands.MEDIAITEM_DEFAULT);
    this._mediaListView = this._mediaList.createView(); 
    // Set up the playlist widget
    this._playlist.bind(this._mediaListView, cmds);

    // hook up the search button
    var wMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
                      .getService(Ci.nsIWindowMediator);
    var mainWindow = wMediator.getMostRecentWindow("Songbird:Main");
    
    this.searchButton = document.getElementById("search-button");
    var controller = this;
    this.searchButton.addEventListener("command",
      function() {
        controller.resolveQuery();
      },false);

  
    /*
    var auth_details = {
      name: "birdplaydar",
      website: "do we really need auth"
    };
    var listeners = {
      onStat: function (detected) {
        if (detected) {
          alert('Playdar detected');
        } else {
          alert('Playdar unavailabled');
        }
      },
      onAuth: function () {
        alert('Access to Playdar authorised');
      },
      onAuthClear: function () {
        alert('User revoked authorisation');
      }
    };

    Playdar.setup(auth_details);
    Playdar.client.register_listeners(listeners);
    Playdar.client.init();
    */
  
    var listeners = {
      
      onStat : function (detected) {
        if (detected) {
          alert('Playdar detected');
        } else {
          alert('Playdar unavailable');
        }
      },

      onResults : function (response,final_answer) {
        Birdplaydar.Page.processResults(response,final_answer);
      },

      onUrl : function (resp) {
        //alert(resp);
      }

    };

    this.utils = Birdplaydar.Utils;
    this.utils.register_listeners(listeners);
    
    this.utils.stat();

  },

  processResults : function(resp, final_answer) {
     
    var results = resp.results;
    //alert("got results, length = " + results.length);
    for (var r in results) {
      var curr_result = results[r];
      //alert("sid: " + curr_result.sid + "\ntrack " + curr_result.track);
      if (this.sids.indexOf(curr_result.sid) == -1) {
        this.sids.push(curr_result.sid);
        //alert("track: " + curr_result.track +
             // "\nsource: " + curr_result.source +
             // "\nscore: " + curr_result.score);
        this.addTrack(curr_result);
        //this.utils.getUrlFromSid(curr_result.sid);
      }
    }
     
  },

  // add track to media list from http API result
  addTrack : function(result) {
    
    var propArray = Cc['@songbirdnest.com/Songbird/Properties/MutablePropertyArray;1']
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
    //propArray.appendProperty(SBProperties.contentURL,this.SID_URL_BASE + result.sid);
    var ioSvc = Cc['@mozilla.org/network/io-service;1']
                  .getService(Ci.nsIIOService);
    var uri = ioSvc.newURI(this.SID_URL_BASE + result.sid, null, null);
    //alert("formed a uri"); 
    var libUtils = Cc['@songbirdnest.com/Songbird/library/Manager;1']
                     .getService(Ci.sbILibraryUtils);
    var contentURI = libUtils.getContentURI(uri);
    
    var mediaItem = LibraryUtils.mainLibrary.createMediaItem(contentURI,propArray);
    
    this._mediaList.add(mediaItem);

    

  },

  resolveQuery : function() {
    
    var song = document.getElementById("song-search-input").value;
    var artist = document.getElementById("artist-search-input").value;
    var album = document.getElementById("album-search-input").value;
    
    this.sids = [];
    this.removePreviousResults();  
    this.utils.resolve(artist,album,song);  
  },

  removePreviousResults : function() {
    
    var listener = {
      onEnumerationBegin : function(list) {

      },
      onEnumeratedItem : function(list,item) {
        LibraryUtils.mainLibrary.remove(item);
      },
      onEnumerationEnd : function(list,code) {

      }
    };

    this._mediaList.enumerateAllItems(listener);
  },  

   /** 
   * Called as the window is about to unload
   */
  onUnload:  function(e) {
    
    //this._mediaListView.removeListener(this._listViewListener);
    if (this._playlist) {
      this._playlist.destroy();
      this._playlist = null;
    }
  },
  /** 
   * Show/highlight the MediaItem at the given MediaListView index.
   * Called by the Find Current Track button.
   */
  highlightItem: function(aIndex) {
    this._playlist.highlightItem(aIndex);
  },

  /** 
   * Called when something is dragged over the tabbrowser tab for this window
   */
  canDrop: function(aEvent, aSession) {
    return this._playlist.canDrop(aEvent, aSession);
  },

  /** 
   * Called when something is dropped on the tabbrowser tab for this window
   */
  onDrop: function(aEvent, aSession) {
    return this._playlist._dropOnTree(this._playlist.mediaListView.length,
               Ci.sbIMediaListViewTreeViewObserver.DROP_AFTER);
  }     
} 
