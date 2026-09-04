/** Host page’e yapıştırılan loader. currentScript origin’inden iframe açar. */
export function widgetLoaderScript(embedKey: string): string {
  const key = JSON.stringify(embedKey);
  return `(function(){
  var embedKey = ${key};
  var script = document.currentScript;
  if (!script || !script.src) return;
  var web = new URL(script.src).origin;
  var flag = "__sakus_webchat_" + embedKey;
  if (window[flag]) return;
  window[flag] = true;

  var frame = document.createElement("iframe");
  frame.title = "SAKUS sohbet";
  frame.id = "sakus-webchat-" + embedKey;
  frame.setAttribute("allow", "geolocation");
  frame.setAttribute("aria-label", "SAKUS sohbet");
  frame.src = web + "/embed/" + encodeURIComponent(embedKey) + "?host=" + encodeURIComponent(location.origin);
  frame.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "border:0",
    "background:transparent",
    "color-scheme:normal",
    "bottom:16px",
    "right:16px",
    "width:168px",
    "height:56px",
    "max-width:calc(100vw - 16px)",
    "max-height:calc(100vh - 16px)",
    "overflow:hidden"
  ].join(";");
  function mount(){
    (document.body || document.documentElement).appendChild(frame);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  window.addEventListener("message", function(ev){
    if (ev.origin !== web) return;
    var d = ev.data;
    if (!d || d.type !== "sakus-webchat" || d.embedKey !== embedKey) return;
    if (d.konum === "sol_alt") {
      frame.style.left = "16px";
      frame.style.right = "auto";
    } else {
      frame.style.right = "16px";
      frame.style.left = "auto";
    }
    if (d.width) frame.style.width = Math.ceil(d.width) + "px";
    if (d.height) frame.style.height = Math.ceil(d.height) + "px";
  });
})();`;
}
