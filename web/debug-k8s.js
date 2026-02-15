console.log("NODE_PATH:", process.env.NODE_PATH);
console.log("Module paths:", module.paths);

try {
  // detailed debug of module resolution
  const k8s = require("@kubernetes/client-node");
  console.log("Successfully loaded @kubernetes/client-node");
  
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  const api = kc.makeApiClient(k8s.CustomObjectsApi);

  async function run() {
    try {
      console.log("Listing cluster custom objects...");
      const response = await api.listClusterCustomObject({
          group: "gitship.io",
          version: "v1alpha1",
          plural: "gitshipapps",
      });
      // console.log("Response keys:", Object.keys(response));
      // Handle both response formats
      const data = response.body ?? response;
      // console.log("Data keys:", Object.keys(data || {}));
      
      const items = (data || {}).items;
      console.log("Items found:", items ? items.length : "undefined");
      if (items) items.forEach(i => console.log(" - " + i.metadata.name + " (" + i.metadata.namespace + ")"));
    } catch (err) {
      console.error("Error:", err.message);
      if (err.body) console.error("Error body:", JSON.stringify(err.body));
    }
  }
  run();

} catch (e) {
  console.error("Failed to load module:", e);
  console.log("Checking /custom-deps...");
  const fs = require('fs');
    if (fs.existsSync('/custom-deps')) {
        console.log("/custom-deps exists.");
        if (fs.existsSync('/custom-deps/node_modules')) {
            console.log("/custom-deps/node_modules exists. Contents:");
            console.log(fs.readdirSync('/custom-deps/node_modules'));
        }
    } else {
        console.log("/custom-deps does NOT exist.");
    }
}
