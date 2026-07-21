import { defineConfig } from "vite"
import wasm from "vite-plugin-wasm"
import topLevelAwait from "vite-plugin-top-level-await"

export default defineConfig({
    root: "editor/",
    plugins: [
        wasm(),
        topLevelAwait(),
    ],
    build: {
        target: "esnext",
    },
    esbuild: {
        target: "esnext",
    },
    server: {
    watch: {
        ignored: ["**/generated/**"],
        },
    },

    optimizeDeps: {
        esbuildOptions: {
            target: "esnext",
        },
        exclude: ["@automerge/automerge", "@automerge/automerge-wasm", "ws"],
        include: [
            "@automerge/react/slim",
            "@automerge/automerge-repo-storage-indexeddb",
            "@automerge/automerge-repo-network-websocket",

        ],
        holdUntilCrawlEnd: true,
    },
    worker: {
        format: "es",
        plugins: () => [wasm(), topLevelAwait()],
    },
})
