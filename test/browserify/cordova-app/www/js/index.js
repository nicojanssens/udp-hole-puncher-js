'use strict'

document.addEventListener('deviceready', onDeviceReady, false)

function onDeviceReady() {
  console.log('READY')
}

// var app = {
//     initialize: function() {
//         this.bindEvents();
//     },
//     bindEvents: function() {
//         document.addEventListener('deviceready', this.onDeviceReady, false);
//     },
//     onDeviceReady: function() {
//         app.receivedEvent('deviceready');
//     },
//     // Update DOM on a Received Event
//     receivedEvent: function(id) {
//         var parentElement = document.getElementById(id);
//         var listeningElement = parentElement.querySelector('.listening');
//         var receivedElement = parentElement.querySelector('.received');
//
//         listeningElement.setAttribute('style', 'display:none;');
//         receivedElement.setAttribute('style', 'display:block;');
//
//         console.log('Received Event: ' + id);
//     }
// };
//
// app.initialize();
