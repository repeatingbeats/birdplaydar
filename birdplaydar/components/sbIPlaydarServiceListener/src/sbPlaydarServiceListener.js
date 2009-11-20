/*
 * sbIPlaydarServiceListener - empty implementation for component registration
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
const DESCRIPTION = "Playdar Service Listener";
const CID         = "{1c761454-b795-418e-8497-4ece9d20107f}";
const CONTRACTID  = "@repeatingbeats.com/playdar/playdar-service-listener;1";

// XPCOM component constructor
function sbIPlaydarServiceListener() {
};

sbIPlaydarServiceListener.prototype.constructor = sbIPlaydarServiceListener;

sbIPlaydarServiceListener.prototype = {

  // XPCOM details
  classDescription: DESCRIPTION,
  classID:  Components.ID(CID),
  contractID:  CONTRACTID,

  QueryInterface : XPCOMUtils.generateQI([Ci.sbIPlaydarServiceListener]),

  cid : null,
  
  onStat : function(aDetected) {

  },

  onResults : function(aResponse,aFinalAnswer) {

  }

};

function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule([sbIPlaydarServiceListener]);
}
