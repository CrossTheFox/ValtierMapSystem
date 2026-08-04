import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { linkMentionsInText } from "./linkWikiMentions.js";

const ENTITIES = [
    { id: "e1", title: "Zorgun" },
    { id: "e2", title: "Casa Margalous" },
    { id: "e3", title: "Oni" },
];

describe("linkMentionsInText", () => {
    it("links known titles to mention tokens", () => {
        const out = linkMentionsInText("Zorgun habla con Oni", ENTITIES);
        assert.equal(out, "@[Zorgun](e1) habla con @[Oni](e3)");
    });

    it("prefers longer titles over shorter prefixes", () => {
        const out = linkMentionsInText("Casa Margalous reúne consejo", ENTITIES);
        assert.equal(out, "@[Casa Margalous](e2) reúne consejo");
        assert.ok(!out.includes("@[Casa]("));
    });

    it("leaves already-linked mentions untouched", () => {
        const input = "@[Zorgun](e1) y Oni";
        const out = linkMentionsInText(input, ENTITIES);
        assert.equal(out, "@[Zorgun](e1) y @[Oni](e3)");
    });

    it("leaves unknown titles as plain text", () => {
        const out = linkMentionsInText("Theron llega a Galathia", ENTITIES);
        assert.equal(out, "Theron llega a Galathia");
    });

    it("handles empty / null-ish input", () => {
        assert.equal(linkMentionsInText("", ENTITIES), "");
        assert.equal(linkMentionsInText(null, ENTITIES), "");
        assert.equal(linkMentionsInText("Zorgun", []), "Zorgun");
    });
});
