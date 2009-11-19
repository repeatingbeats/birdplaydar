
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
 
};

window.addEventListener("load", function(e) {
    Birdplaydar.Controller.onLoad(e); }, false);
window.addEventListener("unload", function(e) { 
    Birdplaydar.Controller.onUnLoad(e); }, false);
