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

Birdplaydar.Test = {

  run : function() {
  
    var test = this;

    // make sure we actually have a singleton, even if using createInstance()
    this.svcA = Cc['@repeatingbeats.com/playdar/playdar-service;1']
                 .getService(Ci.sbIPlaydarService);
    this.listenerA = this.makeSimplePlaydarListener();
    this.cidA = this.svcA.registerClient(this.listenerA,true);
   
    window.setTimeout(function() { test.run2(test) },3000);
  },
  
  run2 : function(test) {
    
    test.svcB = Cc['@repeatingbeats.com/playdar/playdar-service;1']
                 .createInstance(Ci.sbIPlaydarService);
    test.listB = test.svcB.getClientList(test.cidA);
    dump("\ncidA: " + test.cidA + "\nlistB cid: " +
         test.listB.getProperty(SBProperties.GUID) + "\n");


    // attempt resolution
    test.listListenerA = test.makeSimpleListListener();
    test.svcA.addClientListListener(test.cidA,test.listListenerA,false,
      LibraryUtils.mainLibrary.LISTENER_FLAGS_ITEMADDED |
      LibraryUtils.mainLibrary.LISTENER_FLAGS_AFTERITEMREMOVED)
    test.svcA.resolve(test.cidA,'The Hold Steady','','Sweet Payne');
  
    window.setTimeout(function() {test.run3(test)},10000);
    
  },

  run3 : function(test) {
    
    // make the list visible
    test.svcA.showClientListInServicePane(test.cidA,'testA');
    window.setTimeout(function() {test.run4(test)},6000);
  },

  run4 : function(test) {
  
    // unregister and clear it all
    test.svcA.unregisterClient(test.cidA,true,true);
    window.setTimeout(function() {test.run5(test)},6000);
  },

  run5 : function(test) {

    // register three clients, two with shown tracks and one hidden
    test.svc = Cc['@repeatingbeats.com/playdar/playdar-service;1']
                 .getService(Ci.sbIPlaydarService);

    test.listenerC = test.makeSimplePlaydarListener();
    test.cidC = test.svc.registerClient(test.listenerC,false);
    test.listenerD = test.makeSimplePlaydarListener();
    test.cidD = test.svc.registerClient(test.listenerD,false);
    test.listenerE = test.makeSimplePlaydarListener();
    test.cidE = test.svc.registerClient(test.listenerE,true);
    window.setTimeout(function() {test.run6(test)},2000);
  },

  run6 : function(test) {

    // resolve on all three clients
    test.svc.showClientListInServicePane(test.cidC,"testC");
    test.svc.showClientListInServicePane(test.cidD,"testD");
    test.svc.resolve(test.cidC,'The National','','Fake Empire');
    test.svc.resolve(test.cidD,'Animal Collective','','Banshee Beat');
    test.svc.resolve(test.cidE,'The Hold Steady','','Positive');
    window.setTimeout(function() {test.run7(test)},15000);
  },

  run7 : function(test) {

    // set the first track on list E to be not hidden
    var listE = test.svc.getClientList(test.cidE);
    var trackE = listE.getItemByIndex(0);
    trackE.setProperty(SBProperties.hidden,"0");

    window.setTimeout(function() {test.run8(test)},8000);
  }, 

  run8 : function(test) {

    // enumerate the library before we start unregistering things
    var listener = {
      onEnumerationBegin : function(list) {
        dump("\n\n-----dumping playdar library -----\n");
      },
      onEnumeratedItem : function(list,item,i) {
        if (item.getProperty(SBProperties.isList) == "1") {
          dump("\nplaylist with GUID: " + item.getProperty(SBProperties.GUID) +
               " has " + item.length + " tracks");
        } else {
          dump("\nTRACK:" +
             "\ntrackName: " + item.getProperty(SBProperties.trackName) +
             "\nalbumName: " + item.getProperty(SBProperties.albumName) +
             "\nartistName: " + item.getProperty(SBProperties.artistName) +
             "\nhidden: " + item.getProperty(SBProperties.hidden) +
             "\ncontentURL: " + item.getProperty(SBProperties.contentURL));
        }
      },
      onEnumerationEnd : function(list,code) {
        dump("\n\n----- finished dumping playdar library -----\n\n");
      }
    };
    test.svc.playdarLibrary.enumerateAllItems(listener);
    // unregister list C but keep all tracks and the playlist
    test.svc.unregisterClient(this.cidC,false,false);

    // unregister list D, keeping the tracks but losing the list
    test.svc.unregisterClient(this.cidD,true,false);

    // unregister list E, keeping only the unhidden tracks
    test.svc.unregisterClient(this.cidE,true,false,true);

    // take a look at what is left in the playdar library

    var listener = {
      onEnumerationBegin : function(list) {
        dump("\n\n-----dumping playdar library -----\n");
      },
      onEnumeratedItem : function(list,item,i) {
        if (item.getProperty(SBProperties.isList) == "1") {
          dump("\nplaylist with GUID: " + item.getProperty(SBProperties.GUID) +
               " has " + item.length + " tracks");
        } else {
          dump("\nTRACK:" +
             "\ntrackName: " + item.getProperty(SBProperties.trackName) +
             "\nalbumName: " + item.getProperty(SBProperties.albumName) +
             "\nartistName: " + item.getProperty(SBProperties.artistName) +
             "\nhidden: " + item.getProperty(SBProperties.hidden) +
             "\ncontentURL: " + item.getProperty(SBProperties.contentURL));
        }
      },
      onEnumerationEnd : function(list,code) {
        dump("\n\n----- finished dumping playdar library -----\n\n");
      }
    };
    test.svc.playdarLibrary.enumerateAllItems(listener);
  },

  makeSimplePlaydarListener : function() {

    return {
      clientID : null,
      onStat : function(detected) {
        if (detected) {
          dump("\nplaydar detected for client: " + this.clientID);
        } else {
          dump("\nplaydar not detected for client: " + this.clientID);
        }
      },
      onResults : function(response,finalAnswer) {
        dump("\nplaydar results for client: " + this.clientID +
             "\n\tresponse: " + response +
             "\n\tfinalAnswer: " + finalAnswer);
      }
    };
  },

  makeSimpleListListener : function() {
    return {
      onItemAdded : function(list,item,i) {
        dump("\nadded item to list with guid: " +
             list.getProperty(SBProperties.GUID) +
             "\ntrackName: " + item.getProperty(SBProperties.trackName) +
             "\nalbumName: " + item.getProperty(SBProperties.albumName) +
             "\nartistName: " + item.getProperty(SBProperties.artistName) +
             "\nhidden: " + item.getProperty(SBProperties.hidden) +
             "\ncontentURL: " + item.getProperty(SBProperties.contentURL));
      },
      onAfterItemRemoved : function(list,item,i) {
        dump("\nremoved item from list with guid: " +
             list.getProperty(SBProperties.GUID) +
             "\ntrackName: " + item.getProperty(SBProperties.trackName) +
             "\nalbumName: " + item.getProperty(SBProperties.albumName) +
             "\nartistName: " + item.getProperty(SBProperties.artistName) +
             "\nhidden: " + item.getProperty(SBProperties.hidden) +
             "\ncontentURL: " + item.getProperty(SBProperties.contentURL));
      },
    };
  },

}
