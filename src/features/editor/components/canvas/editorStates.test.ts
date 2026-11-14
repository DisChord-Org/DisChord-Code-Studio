import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { history } from "@codemirror/commands";
import { saveEditorState, takeEditorState } from "./editorStates";

const stateOf = (doc: string) => EditorState.create({ doc, extensions: [history()] });

describe("editor state memory", () => {
    it("returns the saved state only when the text still matches", () => {
        saveEditorState("p", "a.chord", stateOf("hello"));
        expect(takeEditorState("p", "a.chord", "changed")).toBeNull();
    });

    it("hands a state back once and then forgets it", () => {
        saveEditorState("p", "b.chord", stateOf("hello"));
        expect(takeEditorState("p", "b.chord", "hello")).not.toBeNull();
        expect(takeEditorState("p", "b.chord", "hello")).toBeNull();
    });

    it("keeps files of different projects apart", () => {
        saveEditorState("one", "c.chord", stateOf("x"));
        expect(takeEditorState("two", "c.chord", "x")).toBeNull();
    });

    it("evicts the oldest entry past the limit", () => {
        for (let i = 0; i < 31; i++) saveEditorState("many", `f${i}.chord`, stateOf("x"));
        expect(takeEditorState("many", "f0.chord", "x")).toBeNull();
        expect(takeEditorState("many", "f30.chord", "x")).not.toBeNull();
    });
});
