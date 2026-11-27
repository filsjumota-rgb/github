"use strict";
// Affiche le contact défini dans config.js (pages CGU et confidentialité)
(function () {
  var c = (window.TRESSES_CONFIG || {}).contact;
  if (c) document.getElementById("contact").textContent = c;
  else document.getElementById("contact-line").hidden = true;
})();
