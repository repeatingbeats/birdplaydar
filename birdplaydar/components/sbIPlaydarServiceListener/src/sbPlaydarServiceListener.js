
/*
 * Implementation of sbIPlaydarServiceListener XPCOM component 
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
const DESCRIPTION = "Playdar Service Listener";
const CID         = Components.ID("1c761454-b795-418e-8497-4ece9d20107f");
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

  QueryInterface: XPCOMUtils.generateQI([Ci.sbIPlaydarServiceListener]), 
  // ---- end boilerplate

  onStat : function(detected) {

  },

  onResults : function(response,finalAnswer) {

  },

};

function NSGetModule(compMgr, fileSpec){
  return XPCOMUtils.generateModule([sbIPlaydarServiceListener]);
}

