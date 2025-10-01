# bitsy (v8.12, + multiplayer editor)

~ a little engine for little games, worlds, and stories ~

## make a game with bitsy

```
git submodule update --init
cd automerge-repo-sync-server
npm install
cd ..
npm install
npm run client && server
```
Open the client at `localhost:8080`. Server runs on `localhost:3000` by default.
If using Powershell instead of Bash, substitute `npm run dev`.

The address bar will now have your instance string, e.g.  
`http://localhost:8080/?instance=4CDQ9qsgqS4bQ1gfxUwFhy8q5WHX`  
Copy this address to another client to join the shared session.

Or, use the public multiplayer-bitsy server.
```
git checkout public-demo
npm install --only=prod
npm run client
```

## credits 
[bitsy](https://github.com/le-doux/bitsy) by Adam LeDoux and contributors  
[Automerge CRDT](https://github.com/automerge/automerge) by Ink & Switch folks  

Check out Anna Anthropy's [itsy bitsy exercises](https://w.itch.io/itsy-bitsy-exercises) on Itch.  
