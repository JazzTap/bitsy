import * as AutomergeRepo from "@automerge/react/slim"
import automergeWasmUrl from "@automerge/automerge/automerge.wasm?url"
await AutomergeRepo.initializeWasm( fetch(automergeWasmUrl) )

import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb"
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket"

import { Resources } from "../generated/resources.js"
import { Store } from "../store.js"

export const DEBUG_LOCAL = true
export const serverURL = DEBUG_LOCAL ? "http://localhost:3030" : "https://duck-composed-closely.ngrok-free.app"

export const updateText = AutomergeRepo.updateText
export let userId = Store.get('multiplayer_bitsy_user_id')
if (!userId) {
    userId = uuidv4();
    Store.set('multiplayer_bitsy_user_id', userId)
}

export async function attachServer(debug = false) {
    // Then set up an automerge repo (loading with our annoying WASM hack)
    const repo = new AutomergeRepo.Repo({
        storage: new IndexedDBStorageAdapter(),
        network: [new BrowserWebSocketClientAdapter(serverURL)],
    })
    const params = new URLSearchParams(window.location.search);

    let handle
    let instanceRaw = params.get('instance') || Store.get('multiplayer_bitsy_pending_instance')
    let instance = instanceRaw
    let instanceName

    const headers = { "Content-Type": "application/json", }
    if (instanceRaw) {
        // try handle lookup by instance slug
        let req = await fetchOrElse(`${serverURL}/api/handle`, {
            method: "POST",
            headers,
            body: JSON.stringify({"iid": instanceRaw})
        })
        let res = (await req.json()).result
        if (res) {
            instance = res
            instanceName = instanceRaw
        }
        console.log(instance)

        // otherwise, try handle lookup by raw identifier
        try {
            handle = await repo.find('automerge:' + instance)
        }
        catch (e) {
            console.log("Couldn't look up instance. Defaulting to new instance.")
        }
    }
    if (debug && handle) console.log('attached to instance:', instanceRaw)

    if (!handle) {
        // if there's no matching handle, spin up a new session
	    var defaultData = Resources["defaultGameData.bitsy"]; // too much clutter from orphaned instances

        while (true) {
            // HACK: generate new slugs until we discover a free one
            instanceName = generateSlug();
            let req = await fetchOrElse(`${serverURL}/api/handle`, {
                method: "POST",
                headers,
                body: JSON.stringify({"iid": instanceName})
            })
            let res = (await req.json()).result
            if (!res)
                break;
        }

        handle = repo.create()
        handle.change(doc => {
            doc.bitsy = defaultData;
            doc.mutex = {};
            doc.mutex[userId] = 'none';
            doc.instance = instanceName; // assign instance slug
        })

        let res = handle.url.split(':')[1]
        params.set('instance', res)
        if (debug) console.log('created new instance:', res)

        // tell the server our instance slug
        fetchOrElse(`${serverURL}/api/assign`, {method: "POST", headers,
            body: JSON.stringify({"handle": res, "iid": instanceName})})
    }
    else {
        instanceName = handle.doc().instance;

        let loc = {...handle.doc().mutex}
        // append my userId to the mutex. userId should be unique across all clients
        loc[userId] = 'none'
        handle.change(doc => { doc.mutex = loc; })
        
        let res = handle.url.split(':')[1]
        params.set('instance', res)
    }
    // update url: https://stackoverflow.com/a/56777426
    history.pushState({}, '', `${location.pathname}?${params.toString()}${location.hash}`)
    
    Store.set("instance_name", instanceName)
    console.log("got instance name: " + instanceName)
    return {repo, handle}
}

// @broofa https://stackoverflow.com/questions/105034/how-do-i-create-a-guid-uuid/2117523#2117523
function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  );
}

// skip POST if DEBUG_LOCAL says we're on localhost, since CORS will fail
function fetchOrElse(url, options) {
    if (DEBUG_LOCAL) { return {json: () => ({}) }; }
    return fetch(url, options)
}

 const generateSlug = () => {
    const randomAdverb = adverbs[Math.floor(Math.random() * adverbs.length)];
    const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${randomAdverb}-${randomAnimal}-${randomNoun}`;
};

const adverbs = [
    'happy', 'brave', 'calm', 'clever', 'eager', 'fierce', 'gentle', 'honest', 'jolly', 'keen', 'lively', 'modest',
    'natural', 'patient', 'quiet', 'steady', 'thoughtful', 'unique', 'wise', 'youthful', 'bold', 'bright', 'careful',
    'cheerful', 'daring', 'elegant', 'focused', 'friendly', 'graceful', 'humble', 'ideal', 'innocent', 'joyful',
    'kindly', 'logical', 'mighty', 'nimble', 'noble', 'orderly', 'peaceful', 'playful', 'precise', 'quick', 'radiant',
    'resilient', 'rustic', 'silent', 'stellar', 'subtle', 'tactful', 'tranquil', 'ultimate', 'valiant', 'vibrant',
    'vigilant', 'vivid', 'wild', 'witty', 'wonderful', 'zealous', 'active', 'agile', 'alert', 'animated', 'bashful',
    'bouncy', 'brilliant', 'bubbly', 'cosmic', 'dazzling', 'delicate', 'dynamic', 'electric', 'energetic', 'fluent',
    'gleaming', 'glorious', 'heroic', 'infinite', 'jovial', 'knowing', 'luminous', 'lyrical', 'magnetic',
    'mysterious', 'nocturnal', 'fluent', 'optimistic', 'fluent', 'electric', 'quirky', 'subtle', 'spirited',
    'sunny', 'rustic', 'urbane', 'upbeat', 'vivid', 'zesty']

const animals = [
  'groundhog', 'aardvark', 'badger', 'cheetah', 'dolphin', 'elephant', 'falcon', 'giraffe', 'hamster', 'iguana',
  'jaguar', 'koala', 'lemur', 'mongoose', 'narwhal', 'octopus', 'panda', 'quail', 'raccoon', 'seahorse',
  'tiger', 'urchin', 'viper', 'walrus', 'xerus', 'yak', 'zebra', 'alpaca', 'bison', 'capybara',
  'dingo', 'emu', 'fennec', 'gecko', 'heron', 'impala', 'jellyfish', 'kiwi', 'lynx', 'meerkat',
  'newt', 'ocelot', 'penguin', 'quokka', 'raven', 'sloth', 'toucan',   'urchin', 'vulture', 'wombat',
  'axolotl', 'bear', 'crane', 'dragonfly', 'eagle', 'flamingo', 'gazelle', 'hedgehog', 'ibis', 'jackal',
  'kestrel', 'leopard', 'macaw', 'nightingale', 'osprey', 'pelican', 'quail', 'reindeer', 'salamander', 'tapir',
  'owl', 'vicuna', 'wolverine', 'fox', 'yellowjacket', 'zorilla', 'antelope', 'butterfly', 'chameleon', 'dugong',
  'egret', 'firefly', 'gorilla', 'hummingbird', 'inchworm', 'jaybird', 'kangaroo', 'lobster', 'mantis', 'numbat',
  'otter', 'puffin', 'rabbit', 'rhino', 'starfish', 'tortoise', 'shark', 'vole', 'weasel', 'finch'
];

const nouns = ['highway', 'mountain', 'river', 'forest', 'ocean', 'desert', 'valley', 'canyon', 'island',
    'bridge', 'castle', 'tower', 'garden', 'meadow', 'field', 'lake', 'stream', 'waterfall', 'volcano',
    'glacier', 'temple', 'palace', 'fortress', 'lighthouse', 'harbor', 'village', 'pathway', 'tunnel', 'cavern',
    'crater', 'summit', 'plateau', 'ridge', 'cliff', 'shore', 'bay', 'lagoon', 'marsh', 'swamp', 'prairie', 'tundra',
    'savanna', 'jungle', 'reef', 'trench', 'basin', 'delta', 'peninsula', 'archipelago', 'atoll', 'dune', 'oasis',
    'geyser', 'spring', 'rapids', 'fjord', 'strait', 'channel', 'inlet', 'cove', 'peak', 'knoll', 'hill', 'slope',
    'gorge', 'ravine', 'bluff', 'mesa', 'butte', 'rock', 'boulder', 'stone', 'pebble', 'sand', 'dust', 'cloud', 'storm',
    'thunder', 'lightning', 'rainbow', 'sunrise', 'sunset', 'twilight', 'dawn', 'dusk', 'noon', 'midnight', 'eclipse',
    'comet', 'meteor', 'star', 'moon', 'galaxy', 'nebula', 'cosmos', 'horizon', 'zenith', 'void', 'abyss', 'sanctuary']