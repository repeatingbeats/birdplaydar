/*
 * Controller script for Birdplaydar
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
 * Portions of this source were derived fom the Songbird Concerts add-on
 * Copyright (c) 2008, Pioneers of the Inevitable, Inc.
 * 
 * See LICENSE in the top level folder for more information.
 */



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
      alert(controller.strings.getString("versionString"));
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

  /*
   * Borrowed from here:
   *
   * http://wiki.songbirdnest.com/index.php?title=Developer/Recipe_Book/Extensions_and_Core/Uninstall&highlight=uninstall
   */
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
