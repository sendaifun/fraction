import { AnchorIdl, rootNodeFromAnchorWithoutDefaultVisitor } from "@codama/nodes-from-anchor";
import { renderVisitor as renderJavaScriptVisitor } from "@codama/renderers-js";
import { renderVisitor as renderJavaScriptUmiVisitor } from "@codama/renderers-js-umi";
import { renderVisitor as renderRustVisitor } from "@codama/renderers-rust";
import { visit } from "@codama/visitors-core";
import anchorIdl from "../target/idl/fraction.json";

async function generateClients() {
    const node = rootNodeFromAnchorWithoutDefaultVisitor(anchorIdl as AnchorIdl);

    const clients = [
        { type: "JS", dir: "clients/generated/js/src", renderVisitor: renderJavaScriptVisitor },
        { type: "Umi", dir: "clients/generated/umi/src", renderVisitor: renderJavaScriptUmiVisitor },
        { type: "Rust", dir: "clients/generated/rust/src", renderVisitor: renderRustVisitor }
    ];

    for (const client of clients) {
        try {
            await visit(
                node,
                await client.renderVisitor(client.dir)
            ); console.log(`Successfully generated ${client.type} client for directory: ${client.dir}!`);
        } catch (e) {
            console.error(`Error in ${client.renderVisitor.name}:`, e);
            throw e;
        }
    }
}

generateClients();