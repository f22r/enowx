/* enowx plugin JS bridge — a tiny helper so plugin UIs can talk to their own
   sidecar and to the enowx dashboard API.
   Include with: <script src="/plugin-kit/kit.js" defer></script>

   Available as window.enowx:
     enowx.pluginId              -> this plugin's id (from the URL)
     enowx.self(path, opts)      -> fetch the plugin's OWN endpoint (relative)
     enowx.api(path, opts)       -> fetch the enowx dashboard API (/api/...),
                                    carrying the dashboard session (same-origin)
*/
(function () {
  var m = location.pathname.match(/^\/plugins\/([^/]+)/);
  var pluginId = m ? m[1] : "";
  var base = "/plugins/" + pluginId + "/";

  async function self(path, opts) {
    var url = base + String(path).replace(/^\//, "");
    var r = await fetch(url, opts);
    return r;
  }

  async function api(path, opts) {
    var url = "/api/" + String(path).replace(/^\/?(api\/)?/, "");
    var r = await fetch(url, Object.assign({ credentials: "same-origin" }, opts || {}));
    if (!r.ok) throw new Error("enowx api " + r.status);
    var ct = r.headers.get("content-type") || "";
    return ct.indexOf("application/json") >= 0 ? r.json() : r.text();
  }

  window.enowx = { pluginId: pluginId, self: self, api: api };
})();
