import { EditorView, WidgetType } from "@codemirror/view";
import { indentUnit } from "@codemirror/language";
import { getCorelib, type CorelibField } from "../chord-corelib";
import { editField, findBlock, listOf, listToText, literalOf, quote, toExpression, valueOf } from "./parse";
import type { BlockLocation, Statement } from "./parse";
import { controlSelector, fieldLabels } from "./block-form.constants";
import { dismissBlock, neverShowHandler } from "./state";

interface FieldView {
    field: CorelibField;
    value: string;
}

interface FormRoot extends HTMLElement {
    form: BlockFormWidget;
    lastRow?: HTMLElement;
    syncers: Array<(value: string) => void>;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
};

const fieldSelector = ".cm-block-form-field";

const marginFor = (view: EditorView, indent: number) => `${6 + indent * view.defaultCharacterWidth}px`;

export class BlockFormWidget extends WidgetType {
    constructor(
        readonly open: number,
        readonly name: string,
        readonly fields: FieldView[],
        readonly indent: number,
    ) {
        super();
    }

    eq(other: BlockFormWidget) {
        return this.open === other.open && this.indent === other.indent && this.name === other.name
            && this.fields.length === other.fields.length
            && this.fields.every((f, i) => f.field === other.fields[i].field && f.value === other.fields[i].value);
    }

    ignoreEvent() {
        return true;
    }

    get estimatedHeight() {
        return 96 + this.fields.length * 30;
    }

    updateDOM(dom: HTMLElement, view: EditorView) {
        const root = dom.firstElementChild as FormRoot | null;
        if (!root) return false;
        const same = root.form && root.form.open === this.open && root.form.fields.length === this.fields.length
            && root.form.fields.every((f, i) => f.field === this.fields[i].field);
        if (!same) return false;

        root.form = this;
        dom.style.paddingLeft = marginFor(view, this.indent);
        this.fields.forEach((f, i) => root.syncers[i](f.value));
        view.requestMeasure();
        return true;
    }

    toDOM(view: EditorView) {
        const root = Object.assign(el("div", "cm-block-form"), { form: this, syncers: [] as Array<(value: string) => void> });

        const header = el("div", "cm-block-form-header");
        header.append(el("i", "bi bi-ui-checks-grid cm-block-form-icon"), el("span", "cm-block-form-title", this.name));

        const close = el("button", "cm-block-form-close");
        close.type = "button";
        close.title = "Cerrar (Esc)";
        close.setAttribute("aria-label", "Cerrar el formulario");
        close.tabIndex = -1;
        close.append(el("i", "bi bi-x-lg"));
        close.addEventListener("click", () => this.dismiss(view));
        header.append(close);

        const grid = el("div", "cm-block-form-grid");
        this.fields.forEach((item, index) => grid.append(this.row(view, root, item, index)));

        const footer = el("div", "cm-block-form-footer");
        const never = view.state.facet(neverShowHandler);
        if (never) {
            const hide = el("button", "cm-block-form-never", "No volver a mostrar");
            hide.type = "button";
            hide.addEventListener("click", never);
            footer.append(hide);
        }
        const confirm = el("button", "cm-block-form-confirm");
        confirm.type = "button";
        confirm.append(el("span", "", "Confirmar"), el("i", "bi bi-arrow-return-left"));
        confirm.addEventListener("click", () => this.leave(view, "after"));
        footer.append(confirm);

        root.append(header, grid, footer);
        root.addEventListener("keydown", (event) => this.navigate(view, root, event));

        const outer = el("div", "cm-block-form-outer");
        outer.style.paddingLeft = marginFor(view, this.indent);
        outer.append(root);
        return outer;
    }

    private dismiss(view: EditorView) {
        view.dispatch({ effects: dismissBlock.of(null) });
        view.focus();
    }

    private leave(view: EditorView, side: "before" | "after") {
        const text = view.state.doc.toString();
        const block = findBlock(text, this.open + 1, getCorelib());
        const known = block && block.open === this.open;
        const anchor = side === "before" ? this.open : known ? (block.close === null ? text.length : block.close + 1) : view.state.selection.main.head;
        view.dispatch({ selection: { anchor }, scrollIntoView: true });
        view.focus();
    }

    private navigate(view: EditorView, root: FormRoot, event: KeyboardEvent) {
        const key = event.key;
        if (key === "Escape") {
            event.preventDefault();
            this.dismiss(view);
            return;
        }
        if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) return;
        if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;

        const target = event.target as HTMLElement;
        const rows = Array.from(root.querySelectorAll<HTMLElement>(fieldSelector));
        const rowOf = rows.find((row) => row.contains(target));
        const never = root.querySelector<HTMLElement>(".cm-block-form-never");
        const confirm = root.querySelector<HTMLElement>(".cm-block-form-confirm")!;
        const backwards = key === "ArrowUp" || key === "ArrowLeft";
        const side = backwards ? "before" : "after";

        const go = (element: HTMLElement | null | undefined) => {
            element?.focus();
            if (element instanceof HTMLInputElement) element.select();
        };
        const firstControl = (row: HTMLElement | undefined) => row?.querySelector<HTMLElement>(controlSelector);

        if (rowOf) {
            if (target instanceof HTMLInputElement && (key === "ArrowLeft" || key === "ArrowRight")) {
                const { selectionStart, selectionEnd, value } = target;
                if (selectionStart !== selectionEnd || selectionEnd !== (backwards ? 0 : value.length)) return;
            }

            event.preventDefault();
            root.lastRow = rowOf;

            if (key === "ArrowUp" || key === "ArrowDown") {
                const next = rows[rows.indexOf(rowOf) + (backwards ? -1 : 1)];
                if (next) go(firstControl(next));
                else this.leave(view, side);
                return;
            }

            const siblings = Array.from(rowOf.querySelectorAll<HTMLElement>(controlSelector));
            const step = siblings[siblings.indexOf(target) + (backwards ? -1 : 1)];
            if (step) go(step);
            else if (!backwards) go(confirm);
            else if (never) go(never);
            else this.leave(view, "before");
            return;
        }

        event.preventDefault();
        const toField = () => go(firstControl(root.lastRow ?? rows[0]));
        if (target === confirm) {
            if (backwards) toField();
            else this.leave(view, "after");
        } else if (target === never) {
            if (key === "ArrowLeft") this.leave(view, "before");
            else toField();
        }
    }

    private commit(view: EditorView, field: CorelibField, value: string) {
        const text = view.state.doc.toString();
        const block = findBlock(text, this.open + 1, getCorelib());
        if (!block || block.open !== this.open) return;

        const edit = editField(text, block, field, value, view.state.facet(indentUnit));
        if (edit) view.dispatch({ changes: edit, userEvent: "input.blockform" });
    }

    private row(view: EditorView, root: FormRoot, { field, value }: FieldView, index: number) {
        const wrapper = el("label", "cm-block-form-field");
        const label = el("span", "cm-block-form-label", fieldLabels[field.keys[0]] ?? field.keys[0]);
        if (field.required) label.append(el("span", "cm-block-form-required", " *"));
        wrapper.append(label);

        const current = () => root.form.fields[index].value;

        const built = field.kind === "mappedList" && field.values ? this.chips(view, field, field.values, value, current)
            : field.kind === "mappedLiteral" && field.values ? this.select(view, field, field.values, value)
            : this.input(view, field, value, current);
        wrapper.append(built.element);
        root.syncers.push(built.sync);
        return wrapper;
    }

    private input(view: EditorView, field: CorelibField, value: string, current: () => string) {
        const input = el("input", "cm-block-form-input");
        input.value = value;
        input.placeholder = field.kind === "list" ? '[ "uno", "dos" ]' : "texto o expresión";
        input.spellcheck = false;
        const apply = () => {
            const next = toExpression(input.value);
            if (next !== current().trim()) this.commit(view, field, next);
        };
        input.addEventListener("change", apply);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") apply();
        });
        return { element: input, sync: (next: string) => { if (document.activeElement !== input) input.value = next; } };
    }

    private select(view: EditorView, field: CorelibField, values: string[], value: string) {
        const select = el("select", "cm-block-form-input");
        const fill = (raw: string) => {
            select.replaceChildren();
            const current = literalOf(raw);
            const options = [...values];
            if (raw.trim() && (current === null || !values.includes(current))) options.push(raw.trim());
            for (const [optionValue, label] of [["", "—"], ...options.map((o) => [o, o])]) {
                const option = el("option", "", label);
                option.value = optionValue;
                select.append(option);
            }
            select.value = current !== null && values.includes(current) ? current : raw.trim();
        };
        fill(value);
        select.addEventListener("change", () => {
            const picked = select.value;
            this.commit(view, field, !picked ? "" : values.includes(picked) ? quote(picked) : picked);
        });
        return { element: select, sync: fill };
    }

    private chips(view: EditorView, field: CorelibField, values: string[], value: string, current: () => string) {
        const box = el("div", "cm-block-form-chips");
        const chips = values.map((option) => {
            const chip = el("button", "cm-block-form-chip", option);
            chip.type = "button";
            chip.addEventListener("click", () => {
                const selected = new Set(listOf(current()));
                const next = selected.has(option) ? values.filter((v) => v !== option && selected.has(v)) : values.filter((v) => v === option || selected.has(v));
                this.commit(view, field, listToText(next));
            });
            box.append(chip);
            return chip;
        });
        const sync = (raw: string) => {
            const selected = new Set(listOf(raw));
            chips.forEach((chip, i) => {
                chip.classList.toggle("is-on", selected.has(values[i]));
                chip.setAttribute("aria-pressed", String(selected.has(values[i])));
            });
        };
        sync(value);
        return { element: box, sync };
    }
}

export const fieldViews = (text: string, statements: Statement[], block: BlockLocation): FieldView[] =>
    block.definition.fields.map((field) => ({ field, value: valueOf(text, statements.find((s) => s.field === field)) }));
