import { Fragment, useContext } from "react";
import { CODEX_TYPES } from "../../../constants/wiki/archiveCodex";
import { scanMentions } from "../../../utils/archiveCodexText";
import { CodexTextContext } from "./codexTextContext";

/** Mock `md`: **bold** and *italic* only. */
function mdNodes(text, keyBase) {
    const out = [];
    const re = /\*\*([^*]+)\*\*|\*([^*\n]+)\*/g;
    let pos = 0;
    let m;
    let k = 0;
    while ((m = re.exec(text)) !== null) {
        if (m.index > pos) out.push(text.slice(pos, m.index));
        out.push(m[1] != null ? <b key={`${keyBase}-b${k++}`}>{m[1]}</b> : <i key={`${keyBase}-i${k++}`}>{m[2]}</i>);
        pos = m.index + m[0].length;
    }
    if (pos < text.length) out.push(text.slice(pos));
    return out;
}

function MentionChip({ m, onGo }) {
    const { isVeiled, external } = useContext(CodexTextContext);
    if (m.st === "br") {
        const ext = m.id && external ? external(m.id) : null;
        if (ext) {
            return (
                <a
                    className="mn"
                    style={{ "--c": ext.color }}
                    title={ext.title}
                    role="link"
                    tabIndex={0}
                    onClick={ext.onGo}
                    onKeyDown={(e) => { if (e.key === "Enter") ext.onGo(); }}
                >
                    {m.label || ext.label}
                </a>
            );
        }
        return <span className="mn br" title={`No existe ninguna ficha «${m.label}»`}>{m.label}</span>;
    }
    const f = m.ficha;
    const label = m.st === "lg" ? f.title : m.label;
    const T = CODEX_TYPES[f.entity_type];
    const veiled = !!isVeiled?.(f);
    return (
        <a
            className={`mn ${veiled ? "id-glitch" : ""}`}
            style={{ "--c": T?.color }}
            data-go={f.id}
            data-label={veiled ? label : undefined}
            title={`${T?.label || ""} · abrir ficha`}
            role="link"
            tabIndex={0}
            onClick={() => onGo(f.id)}
            onKeyDown={(e) => { if (e.key === "Enter") onGo(f.id); }}
        >
            {label}
        </a>
    );
}

export function CodexInline({ text, fichas, byId, onGo, keyBase = "t" }) {
    const src = String(text || "");
    const ms = scanMentions(src, fichas, byId);
    const out = [];
    let pos = 0;
    ms.forEach((m, i) => {
        out.push(<Fragment key={`${keyBase}-s${i}`}>{mdNodes(src.slice(pos, m.index), `${keyBase}-s${i}`)}</Fragment>);
        out.push(<MentionChip key={`${keyBase}-m${i}`} m={m} onGo={onGo} />);
        pos = m.index + m.length;
    });
    out.push(<Fragment key={`${keyBase}-end`}>{mdNodes(src.slice(pos), `${keyBase}-end`)}</Fragment>);
    return out;
}

/** Mock `richHtml`: blank-line blocks; `#` heading, `- ` list, else a paragraph with line breaks. */
export function CodexRich({ text, fichas, byId, onGo }) {
    const blocks = String(text || "").split(/\n{2,}/).filter((b) => b.trim());
    return blocks.map((b, i) => {
        const key = `b${i}`;
        if (/^#{1,4}\s/.test(b)) {
            return <h4 key={key}><CodexInline text={b.replace(/^#{1,4}\s/, "")} fichas={fichas} byId={byId} onGo={onGo} keyBase={key} /></h4>;
        }
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-•]\s/.test(l))) {
            return (
                <ul key={key}>
                    {lines.map((l, j) => (
                        <li key={`${key}-${j}`}><CodexInline text={l.replace(/^\s*[-•]\s/, "")} fichas={fichas} byId={byId} onGo={onGo} keyBase={`${key}-${j}`} /></li>
                    ))}
                </ul>
            );
        }
        return (
            <p key={key}>
                {lines.map((l, j) => (
                    <Fragment key={`${key}-${j}`}>
                        {j > 0 && <br />}
                        <CodexInline text={l} fichas={fichas} byId={byId} onGo={onGo} keyBase={`${key}-${j}`} />
                    </Fragment>
                ))}
            </p>
        );
    });
}
