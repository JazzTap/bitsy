// This approach requires the initializeWasm export not yet found in the stable 1.2.1 release [of automerge].
// import * as AutomergeRepo from "https://esm.sh/@automerge/automerge-repo@2.0.0-alpha.14/slim?bundle-deps"

import * as AutomergeRepo from "https://esm.sh/@automerge/react@2.1.0/slim?bundle-deps"
await AutomergeRepo.initializeWasm(
  fetch("https://esm.sh/@automerge/automerge/dist/automerge.wasm")
)

import { IndexedDBStorageAdapter } from "https://esm.sh/@automerge/automerge-repo-storage-indexeddb@2.1.0?bundle-deps"
import { BrowserWebSocketClientAdapter } from "https://esm.sh/@automerge/automerge-repo-network-websocket@2.1.0?bundle-deps"
// import { MessageChannelNetworkAdapter } from "https://esm.sh/@automerge/automerge-repo-network-messagechannel@2.0.0-alpha.14?bundle-deps"

export const updateText = AutomergeRepo.updateText

export async function attachServer(debug = false) {
    // Then set up an automerge repo (loading with our annoying WASM hack)
    const repo = new AutomergeRepo.Repo({
        storage: new IndexedDBStorageAdapter(),
        network: [new BrowserWebSocketClientAdapter("wss://3e61543e22d8.ngrok-free.app")],
    })
    let handle

    const params = new URLSearchParams(window.location.search);
    if (!params.get('instance')) {
        handle = repo.create()
        handle.change(doc => { doc.bitsy = "put source code here!" })
        // doc = handle.doc()

        let res = handle.url.split(':')[1]
        if (debug) console.log('created new instance:', res)
        params.set('instance', res)

        // update url slug: https://stackoverflow.com/a/56777426
        history.pushState({}, '', `${location.pathname}?${params.toString()}${location.hash}`)
    }
    else {
        handle = await repo.find('automerge:' + params.get('instance'))
        // doc = (await handle).doc() // VERIFY
        if (debug) console.log('attached to instance:', params.get('instance'))
    }
    return {repo, handle}
}
