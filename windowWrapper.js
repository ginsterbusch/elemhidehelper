/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

let {Aardvark} = require("aardvark");
let {Prefs} = require("prefs");
let {KeySelector} = require("keySelector");

let key = undefined;

function getMenuItem()
{
  // Randomize URI to work around bug 719376
  let stringBundle = Services.strings.createBundle("chrome://elemhidehelper/locale/global.properties?" + Math.random());
  let result = [stringBundle.GetStringFromName("selectelement.label"), stringBundle.GetStringFromName("stopselection.label")];

  getMenuItem = function() result;
  return getMenuItem();
}

exports.WindowWrapper = WindowWrapper;
function WindowWrapper(wnd, elementMarkerClass)
{
  this.window = wnd;
  this.browser = this.E("abp-hooks").getBrowser();

  this.popupShowingHandler = this.popupShowingHandler.bind(this);
  this.popupHidingHandler = this.popupHidingHandler.bind(this);
  this.keyPressHandler = this.keyPressHandler.bind(this);
  this.toggleSelection = this.toggleSelection.bind(this);
  this.hideTooltips = this.hideTooltips.bind(this);
  this.stopSelection = this.stopSelection.bind(this);

  this.E("ehh-elementmarker").firstElementChild.setAttribute("class", elementMarkerClass);

  this.init();
}
WindowWrapper.prototype =
{
  window: null,
  browser: null,

  init: function()
  {
    this.window.addEventListener("popupshowing", this.popupShowingHandler, false);
    this.window.addEventListener("popuphiding", this.popupHidingHandler, false);
    this.window.addEventListener("keypress", this.keyPressHandler, false);
    this.window.addEventListener("blur", this.hideTooltips, true);
    this.browser.addEventListener("select", this.stopSelection, false);
  },

  shutdown: function()
  {
    this.window.removeEventListener("popupshowing", this.popupShowingHandler, false);
    this.window.removeEventListener("popuphiding", this.popupHidingHandler, false);
    this.window.removeEventListener("keypress", this.keyPressHandler, false);
    this.window.removeEventListener("blur", this.hideTooltips, true);
    this.browser.removeEventListener("select", this.stopSelection, false);
  },

  E: function(id)
  {
    let doc = this.window.document;
    this.E = function(id) doc.getElementById(id);
    return this.E(id);
  },

  key: undefined,

  popupShowingHandler: function(event)
  {
    let popup = event.target;
    if (!/^(abp-(?:toolbar|status|menuitem)-)popup$/.test(popup.id))
      return;

    let enabled = Aardvark.canSelect(this.browser);
    let running = (enabled && this.browser == Aardvark.browser);

    let [labelStart, labelStop] = getMenuItem();
    let item = popup.ownerDocument.createElement("menuitem");
    item.setAttribute("label", running ? labelStop : labelStart);
    item.setAttribute("class", "elemhidehelper-item");
    if (!enabled)
      item.setAttribute("disabled", "true");

    if (typeof key == "undefined")
      this.configureKey(event.currentTarget);
    item.setAttribute("acceltext", KeySelector.getTextForKey(key));

    item.addEventListener("command", this.toggleSelection, false);

    let insertBefore = null;
    for (let child = popup.firstChild; child; child = child.nextSibling)
      if (/-options$/.test(child.id))
        insertBefore = child;
    popup.insertBefore(item, insertBefore);
  },

  popupHidingHandler: function(event)
  {
    let popup = event.target;
    if (!/^(abp-(?:toolbar|status|menuitem)-)popup$/.test(popup.id))
      return;

    let items = popup.getElementsByClassName("elemhidehelper-item");
    if (items.length)
      items[0].parentNode.removeChild(items[0]);
  },

  keyPressHandler: function(event)
  {
    if (typeof key == "undefined")
      this.configureKey(event.currentTarget);

    if (KeySelector.matchesKey(event, key))
    {
      event.preventDefault();
      this.toggleSelection();
    }
  },

  configureKey: function(window)
  {
    key = new KeySelector(window).selectKey(Prefs.selectelement_key);
  },

  hideTooltips: function()
  {
    if (Aardvark.window == this.window)
      Aardvark.hideTooltips();
  },

  toggleSelection: function()
  {
    if (this.browser == Aardvark.browser)
      this.stopSelection();
    else
      this.startSelection();
  },

  startSelection: function()
  {
    Aardvark.start(this);
  },

  stopSelection: function()
  {
    Aardvark.quit();
  }
};