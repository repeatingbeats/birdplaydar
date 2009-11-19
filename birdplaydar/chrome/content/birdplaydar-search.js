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
  
    var controller = this;
    this.detected = false;
    this.strings = document.getElementById('birdplaydar-strings');
       
    // set up our interaction with playdar 
    this.playdarService = Cc['@repeatingbeats.com/playdar/playdar-service;1']
                            .getService(Ci.sbIPlaydarService);
  
    var playdarServiceListener = {
    
      onStat : function(detected) {
        if (detected) {
          controller.setDetectionFeedback(true);
        } else {
          controller.setDetectionFeedback(false);
          alert(controller.strings.getString("playdarFailMessage"));      
        }
      }, 
      onResults : function(response,finalAnswer) {
        if (finalAnswer) {
          document.getElementById("resolve-progress").hidden = true;
          document.getElementById("resolve-feedback").value = 
              controller.getFeedbackString();
          document.getElementById("resolve-feedback").hidden = false;
        }
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
     
    // set up our columnSpec
    var cspec = SBProperties.trackName + " 250 " +
                SBProperties.artistName + " 180 " +
                SBProperties.albumName + " 180 " +
                SBProperties.duration + " 50 " +
                SBProperties.bitRate + " 80 " +
                this.playdarService.sourcePropID + " 120 " +
                this.playdarService.scorePropID + " 50 ";
    this._mediaList.setProperty(SBProperties.columnSpec,cspec);
   
    // hook up the playlist and the view
    this._playlist = document.getElementById("birdplaydar-playlist");
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
    this.searchButton.addEventListener("command",
      function() {
        controller.resolveQuery();
      },false);
    var page = document.getElementById("birdplaydar-media-page");
    this.addKeypressResolveListener("song-search-input",13);
    this.addKeypressResolveListener("artist-search-input",13);
    this.addKeypressResolveListener("album-search-input",13); 
  
  },

  addKeypressResolveListener : function(id,keyCode) {
    
    var controller = this;
    var element = document.getElementById(id);
    element.addEventListener("keypress", function(e) {
      if (e.keyCode == 13) {
        controller.resolveQuery();
      }
    },false);
  },

  getFeedbackString : function() {

    var numResults = this._mediaList.length;
    var str = this.strings.getString("playdarFound") + " " + numResults +
              " " + this.strings.getString("playdarTrack");
    return (numResults == 1) ? str : (str += "s");
  },

  resolveQuery : function() {

    if (this.detected) {
      var track = document.getElementById("song-search-input").value;
      var artist = document.getElementById("artist-search-input").value;
      var album = document.getElementById("album-search-input").value;

      if (track == '' && artist == '' && album == '') {
        alert("empty");
        return;
      }
   
      this._mediaList.clear();
      document.getElementById("resolve-feedback").hidden = true;
      document.getElementById("resolve-progress").hidden = false;
      this.playdarService.resolve(this.playdarCID,artist,album,track);
    } else {
      alert(this.strings.getString("playdarFailMessage"));
    }
  },

  setDetectionFeedback : function(detected) {

    var label = document.getElementById("playdar-detection"); 
    if (detected) {
      label.value = this.strings.getString("playdarDetected");
      label.setAttribute("style","color:#79CB0C");
    } else {
      label.value = this.strings.getString("playdarNotDetected");
      label.setAttribute("style","color:#B00");
    }
    this.detected = detected;
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
