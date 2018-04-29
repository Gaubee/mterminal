import { Terminal } from 'xterm';
import "babel-polyfill";
import * as fit from 'xterm/dist/addons/fit';
import * as search from 'xterm/dist/addons/search';
import * as fullscreen from 'xterm/dist/addons/fullscreen';
import * as WebfontLoader from 'xterm-webfont';
import * as attach from './attach';
import { ColLayout, Layout, LAYOUT_INFO_SYMBOL, LayoutAbleItem } from './Layout';
Terminal.applyAddon(fit);
Terminal.applyAddon(search);
Terminal.applyAddon(fullscreen);
Terminal.applyAddon(WebfontLoader);
Terminal.applyAddon(attach);

interface TerminalWithPlugin extends Terminal, LayoutAbleItem {
    fit: () => void
    fullscreen: () => void
    attach: (socket: WebSocket) => void
}


class TerminalManager {
    constructor(public wrapper: HTMLElement) {
        window['tm'] = this;
    }
    layout: Layout<TerminalWithPlugin> = new ColLayout<TerminalWithPlugin>();
    private _tm = new Map<string, TerminalWithPlugin>()
    get(dom_id: string): TerminalWithPlugin
    get(dom_id: string, auto_create: true): TerminalWithPlugin
    get(dom_id: string, auto_create: false): TerminalWithPlugin | undefined
    get(dom_id: string, auto_create = true) {
        let term = this._tm.get(dom_id);
        if (!term && auto_create) {
            term = window["term_" + (this._tm.size + 1)] = new Terminal({ fontFamily: 'Roboto Mono' }) as TerminalWithPlugin;
            term[LAYOUT_INFO_SYMBOL] = {
                id: dom_id,
                scale: 1,
                width: "auto",
                height: "auto",
                col_index: 0,
                row_index: 0,
                visiable: true,
            }
            let dom = this.wrapper.querySelector("#" + dom_id);
            if (!dom) {
                dom = document.createElement("div");
                dom.id = dom_id;
                dom.classList.add("terminal");
                this.wrapper.appendChild(dom);
            }
            term.open(dom as HTMLElement);
            term.fit();
            this._tm.set(dom_id, term);
            this.layout.add(term);
            this.resize();
        }
        return term as TerminalWithPlugin;
    }
    delete(dom_id: string) {
        const term = this._tm.get(dom_id);
        if (!term) {
            return;
        }
        this._tm.delete(dom_id);
        term.destroy();
        this.layout.remove(term);
        this.resize();
    }
    resize() {
        const layoutmap = this.layout.calcLauyout(this.wrapper.clientWidth, this.wrapper.clientHeight);
        for (let term of this._tm.values()) {
            const dom = term['_parent'];
            const layout_info = term[LAYOUT_INFO_SYMBOL];
            const layout_bound = layoutmap.get(layout_info.id);
            if (layout_bound) {
                dom.style.transform = `scale(${layout_info.scale})`;
                dom.style.transformOrigin = "0 0";
                dom.style.width = layout_bound.width / layout_info.scale + "px";
                dom.style.height = layout_bound.height / layout_info.scale + "px";
                dom.style.top = layout_bound.top + "px";
                dom.style.left = layout_bound.left + "px";
                term.fit();
            } else {
                dom.style.display = "none";
            }
        }
    }
}
///
const ready_do = () => {
    const ATTACHED_TERM_SYMBOL = Symbol("attached terminal");
    const fetch_api = async () => {
        const { list } = await fetch("/api/wss").then(res => res.json());
        list.forEach(config_item => {
            const term = tm.get(config_item.process_name);
            if (!term[ATTACHED_TERM_SYMBOL]) {
                term[ATTACHED_TERM_SYMBOL] = true;
                const socket = new WebSocket(`ws://${location.host}${config_item.path}`);
                term.attach(socket);
                // 注册缩放功能
                term.attachCustomKeyEventHandler((e) => {
                    console.log(config_item.process_name, e.keyCode, e.key);

                    if (e.key === '-' || e.key === '=' || e.key === '0') {//-
                        const layout_info = term[LAYOUT_INFO_SYMBOL];
                        if (e.key === '-') {
                            layout_info.scale *= 0.95;
                        } else if (e.key === '=') {
                            layout_info.scale /= 0.95;
                        } else {
                            layout_info.scale = 1;
                        }
                        tm.resize();
                        // Do nothing
                        return true;
                    }
                    return false;
                });
                // 注册销毁事件
                socket.addEventListener("close", () => {
                    tm.delete(config_item.process_name);
                });
            }
        });
        setTimeout(fetch_api, 1000);
    };

    const tm = new TerminalManager(document.getElementById("t-wrapper") as HTMLDivElement);
    fetch_api();

    window.addEventListener("resize", () => {
        tm.resize();
    });
}
if (document.readyState !== "complete") {
    window.addEventListener("DOMContentLoaded", ready_do);
} else {
    ready_do();
}
