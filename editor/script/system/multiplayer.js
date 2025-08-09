// This approach requires the initializeWasm export not yet found in the stable 1.2.1 release [of automerge].
// import * as AutomergeRepo from "https://esm.sh/@automerge/automerge-repo@2.0.0-alpha.14/slim?bundle-deps"

import * as AutomergeRepo from "https://esm.sh/@automerge/react@2.2.0/slim?bundle-deps"
await AutomergeRepo.initializeWasm( fetch("https://esm.sh/@automerge/automerge@3.1.1/dist/automerge.wasm") )

import { IndexedDBStorageAdapter } from "https://esm.sh/@automerge/automerge-repo-storage-indexeddb@2.1.0?bundle-deps"
import { BrowserWebSocketClientAdapter } from "https://esm.sh/@automerge/automerge-repo-network-websocket@2.1.0?bundle-deps"
// import { MessageChannelNetworkAdapter } from "https://esm.sh/@automerge/automerge-repo-network-messagechannel@2.0.0-alpha.14?bundle-deps"

import { Resources } from "../generated/resources.js"
import { Store } from "../store.js"

export const updateText = AutomergeRepo.updateText
export let userId = Store.get('multiplayer_bitsy_user_id')

export async function attachServer(debug = false) {
    // Then set up an automerge repo (loading with our annoying WASM hack)
    const repo = new AutomergeRepo.Repo({
        storage: new IndexedDBStorageAdapter(),
        network: [new BrowserWebSocketClientAdapter("wss://b3f48d869b5c.ngrok-free.app/")],
    })
    const params = new URLSearchParams(window.location.search);

    let handle
    if (params.get('instance')) {
        handle = await repo.find('automerge:' + params.get('instance'))
        if (debug) console.log('attached to instance:', params.get('instance'))
    }

    // if there's no session here, spin one up
    if (!handle) {
	    var defaultData = Resources["defaultGameData.bitsy"]; // too much clutter from orphaned instances

        handle = repo.create()
        handle.change(doc => { doc.bitsy = defaultData; doc.mutex = {}; doc.mutex[userId] = 'none' })

        let res = handle.url.split(':')[1]
        if (debug) console.log('created new instance:', res)
        params.set('instance', res)

        // update url slug: https://stackoverflow.com/a/56777426
        history.pushState({}, '', `${location.pathname}?${params.toString()}${location.hash}`)
    }
    else {
        let res = {...handle.doc().mutex}
        res[userId] = 'none'
        handle.change(doc => { doc.mutex = res; })
        if (debug) console.log(res)
    }
    
    if (!userId) {
        userId = uuidv4();
        Store.set('multiplayer_bitsy_user_id', userId)
    }
    return {repo, handle}
}

// @broofa https://stackoverflow.com/questions/105034/how-do-i-create-a-guid-uuid/2117523#2117523
function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  );
}
