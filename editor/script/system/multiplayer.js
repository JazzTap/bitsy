// This approach requires the initializeWasm export not yet found in the stable 1.2.1 release [of automerge].
// import * as AutomergeRepo from "https://esm.sh/@automerge/automerge-repo@2.0.0-alpha.14/slim?bundle-deps"

import * as AutomergeRepo from "https://esm.sh/@automerge/react@2.2.0/slim?bundle-deps"
await AutomergeRepo.initializeWasm( fetch("https://esm.sh/@automerge/automerge@3.1.1/dist/automerge.wasm") )

import { IndexedDBStorageAdapter } from "https://esm.sh/@automerge/automerge-repo-storage-indexeddb@2.1.0?bundle-deps"
import { BrowserWebSocketClientAdapter } from "https://esm.sh/@automerge/automerge-repo-network-websocket@2.1.0?bundle-deps"
// import { MessageChannelNetworkAdapter } from "https://esm.sh/@automerge/automerge-repo-network-messagechannel@2.0.0-alpha.14?bundle-deps"

// import {Resources} from "../generated/resources.js"

export const updateText = AutomergeRepo.updateText

export async function attachServer(debug = false) {
    // Then set up an automerge repo (loading with our annoying WASM hack)
    const repo = new AutomergeRepo.Repo({
        storage: new IndexedDBStorageAdapter(),
        network: [new BrowserWebSocketClientAdapter("ws://localhost:3030/")],
    })
    let handle

    const params = new URLSearchParams(window.location.search);
    if (!params.get('instance')) {
	    // var defaultData = Resources["defaultGameData.bitsy"]; // too much clutter from orphaned instances

        handle = repo.create()
        handle.change(doc => { doc.bitsy = null; })

        let res = handle.url.split(':')[1]
        if (debug) console.log('created new instance:', res)
        params.set('instance', res)

        // update url slug: https://stackoverflow.com/a/56777426
        history.pushState({}, '', `${location.pathname}?${params.toString()}${location.hash}`)
    }
    else {
        handle = await repo.find('automerge:' + params.get('instance'))
        if (debug) console.log('attached to instance:', params.get('instance'))
    }
    return {repo, handle}
}