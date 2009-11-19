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

Birdplaydar.SearchPage = {


  _mediaListView: null,

  _playlist: null,
	
  /** 
   * Called when the page finishes loading.  
   */
  onLoad:  function(e) {

    // set up our columnSpec
    var cspec = SBProperties.trackName + " 250 " +
                SBProperties.artistName + " 170 " +
                SBProperties.albumName + " 170 " +
                SBProperties.duration + " 40 " +
                SBProperties.bitRate + " 70 ";
   
    // set up our interaction with playdar 
    this.playdarService = Cc['@repeatingbeats.com/playdar/playdar-service;1']
                            .getService(Ci.sbIPlaydarService);
  
    var playdarServiceListener = {
    
      onStat : function(detected) {
        if (detected) {
          // do nothing right now
        } else {
          alert("playdar not detected");
        }
      }, 
      onResults : function(response,finalAnswer) {
        // do nothing, use a mediaList listener instead
      },
    };

    var playdarMediaListListener = {

      onItemAdded: function(list,item,i) {
        // items are hidden by default
        item.setProperty(SBProperties.hidden,"0");
      }
    };

    // register the client and add the medialist listener
    this.playdarCID = this.playdarService
                          .registerClient(playdarServiceListener,false);
    this._mediaList = this.playdarService.getClientList(this.playdarCID);
    this.playdarService.addClientListListener(this.playdarCID,
         playdarMediaListListener, false,
        LibraryUtils.mainLibrary.LISTENER_FLAGS_ITEMADDED);
     
    this._mediaList.setProperty(SBProperties.columnSpec,cspec);
    this._playlist = document.getElementById("birdplaydar-playlist");
   
    // hook up the playlist and the view
    var mgr = Cc["@songbirdnest.com/Songbird/PlaylistCommandsManager;1"]
                .createInstance(Ci.sbIPlaylistCommandsManager);
    var cmds = mgr.request(kPlaylistCommands.MEDIAITEM_DEFAULT);
    this._mediaListView = this._mediaList.createView(); 
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
  
  },

  resolveQuery : function() {
    
    var track = document.getElementById("song-search-input").value;
    var artist = document.getElementById("artist-search-input").value;
    var album = document.getElementById("album-search-input").value;
   
    this._mediaList.clear();
    this.playdarService.resolve(this.playdarCID,artist,album,track); 
  },

  /** 
   * Called as the window is about to unload
   */
  onUnload:  function(e) {
    
    this.playdarService.unregisterClient(this.playdarCID,true,false);
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
