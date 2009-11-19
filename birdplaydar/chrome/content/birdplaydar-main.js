
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

Birdplaydar.Controller = {

  onLoad: function() {
    
    this._initialized = true;
    var controller = this;
    this.strings = document.getElementById("birdplaydar-strings");
    this._menuCmd = document.getElementById("birdplaydar-menu-cmd");
    this._menuCmd.addEventListener("command", function() {
        // test the XPCOM component
        Birdplaydar.Test.run();
    },false);
  
    this.addServicePaneBookmark();
    this.configureUninstallObserver();  
  
  },
 
  onUnLoad: function() {

    this._initialized = false;
  },
  
  /*
   * Adapted from Stephen Lau's (stevel@songbirdnest.com) concerts add-on
   *
   */
  addServicePaneBookmark : function () {
    
    var svcPaneSvc =  Cc['@songbirdnest.com/servicepane/service;1']
			            .getService(Ci.sbIServicePaneService);
	svcPaneSvc.init();
    
    var playdarService = Cc['@repeatingbeats.com/playdar/playdar-service;1']
                           .getService(Ci.sbIPlaydarService);

    var playdarServiceNode = playdarService.playdarServiceNode;	
    var birdplaydarNode = svcPaneSvc.getNode("urn:birdplaydar-search");
  
    if (birdplaydarNode == null) {
      birdplaydarNode = svcPaneSvc.addNode("urn:birdplaydar-search",
                                           playdarServiceNode, false);
      birdplaydarNode.url =
          "chrome://birdplaydar/content/birdplaydar-search.xul";
      birdplaydarNode.name = this.strings.getString("servicePaneName");
      birdplaydarNode.tooltip = this.strings.getString("servicePaneTooltip");
      birdplaydarNode.properties = "birdplaydar-search";
      birdplaydarNode.image = "http://www.playdar.org/favicon.ico";
      playdarServiceNode.insertBefore(birdplaydarNode,
                                      playdarServiceNode.firstChild);
      svcPaneSvc.save();
    }

    birdplaydarNode.hidden = false;
  },

  configureUninstallObserver : function() {
    
    var myUninstallObserver = {  
      _uninstall : false,  
      _tabs : null,  
 
      observe : function(subject, topic, data) {  
        if (topic == "em-action-requested") {  
          // Extension has been flagged to be uninstalled  
          subject.QueryInterface(Ci.nsIUpdateItem);  
          if (subject.id == "birdplaydar@repeatingbeats.com") {  
            if (data == "item-uninstalled") {  
              this._uninstall = true;  
            } else if (data == "item-cancel-action") {  
              this._uninstall = false;  
            }  
          }  
        } else if (topic == "quit-application-granted") {  
          // We're shutting down, so check to see if we were flagged  
          // for uninstall - if we were, then cleanup here  
          if (this._uninstall) {  
            // Do your cleanup stuff here  
            // such as deleting preferences, servicepane nodes,  
            // lists, libraries, etc.
    
            // remove service pane stuff
            var sps = Cc['@songbirdnest.com/servicepane/service;1']
                        .getService(Ci.sbIServicePaneService);
            var birdplaydarFolder = sps.getNode("urn:playdar");
            sps.removeNode(birdplaydarFolder);

            // for the time being, leave the Playdar library because
            // other add-ons might be using it. Need to develop a system
            // to track what extensions are using the sbIPlaydarService
            // so the last one can remove the library when it is uninstalled.
   
            dump("Uninstalled!\n");  
          }  
          this.unregister();  
        }  
      },  
   
      register : function() {  
        var observerService = Cc["@mozilla.org/observer-service;1"]  
                                .getService(Ci.nsIObserverService);  
        observerService.addObserver(this, "em-action-requested", false);  
        observerService.addObserver(this, "quit-application-granted", false);  
      },
  
      unregister : function() {  
        var observerService = Cc["@mozilla.org/observer-service;1"]  
                                .getService(Ci.nsIObserverService);  
        observerService.removeObserver(this, "em-action-requested");  
        observerService.removeObserver(this, "quit-application-granted");
      }  
    };

    myUninstallObserver.register();
    
  },
 
};

window.addEventListener("load", function(e) {
    Birdplaydar.Controller.onLoad(e); }, false);
window.addEventListener("unload", function(e) { 
    Birdplaydar.Controller.onUnLoad(e); }, false);
