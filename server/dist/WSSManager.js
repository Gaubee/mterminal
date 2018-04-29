"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Websocket = require("ws");
const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const HEARTBEAT = 1000;
const AUTO_CLOSE_TI_SYMBOL = Symbol("auto remove wss by HEARTBEAT check");
const PROCESS_NAME_SYMBOL = Symbol("process name");
Error.prototype['toJSON'] = function () {
    return { message: this.message };
};
const MIME_map = {
    "*": "text/plain",
    ".html": "text/html",
    ".js": "application/x-javascript",
    ".css": "text/css",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
};
class WSSManager {
    constructor(options = {}) {
        this.port = 4510;
        this.cache_logs_line = 0;
        this.http_server = http.createServer();
        this._wss_cache = new Map();
        if (options.port && Number.isFinite(options.port)) {
            this.port = options.port | 0;
        }
        if (options.cache_logs_line && Number.isFinite(options.cache_logs_line)) {
            this.cache_logs_line = options.cache_logs_line | 0;
        }
        this.http_server.on("request", (request, response) => {
            var res_body;
            var res_error;
            try {
                const pathname = url.parse(request.url).pathname || "";
                if (pathname === "/api/wss") {
                    response.setHeader("Content-Type", "application/json");
                    res_body = {
                        list: [...this._wss_cache.entries()].map(([key, { wss }]) => {
                            return {
                                path: `/wss/${key}`,
                                process_name: wss[PROCESS_NAME_SYMBOL],
                            };
                        })
                    };
                }
                else if (pathname === "/" || pathname.startsWith("/dist/")) {
                    let static_path = pathname.substr(5) || "/";
                    if (static_path === "/") {
                        static_path = "/index.html";
                    }
                    const filepath = path.join(__dirname, '../../public/dist', static_path);
                    if (!fs.existsSync(filepath)) {
                        throw new Error(`file: ${static_path} is no found.`);
                    }
                    const file_extend = filepath.substr(filepath.lastIndexOf('.'));
                    const mime = MIME_map[file_extend] || MIME_map["*"];
                    response.setHeader("Content-Type", mime);
                    res_body = fs.createReadStream(filepath);
                }
            }
            catch (err) {
                res_error = err;
            }
            finally {
                if (res_error) {
                    response.statusCode = 500;
                }
                else if (!res_body) {
                    response.statusCode = 404;
                }
                if (res_body instanceof fs.ReadStream) {
                    res_body.pipe(response);
                }
                else {
                    response.end(JSON.stringify(res_error || res_body));
                }
            }
        });
        this.http_server.on("upgrade", (request, socket, head) => {
            try {
                const pathname = url.parse(request.url).pathname || "";
                if (!pathname.startsWith("/wss/")) {
                    throw new Error("wrong path");
                }
                const pahtname_key = pathname.substr(5);
                if (!pahtname_key) {
                    throw new Error("wrong path");
                }
                const { wss } = this.autoGet(pahtname_key);
                wss.handleUpgrade(request, socket, head, (ws) => {
                    wss.emit('connection', ws);
                });
            }
            catch (err) {
                socket.destroy();
            }
        });
        this.http_server.listen(this.port);
        console.log(`http server listen in: http://localhost:${this.port}`);
    }
    autoGet(key, auto_create = true) {
        var res = this._wss_cache.get(key);
        if (!res && auto_create) {
            /// 启动websocket服务提供给前端
            const wss = new Websocket.Server({
                noServer: true,
            });
            const cache_logs = [];
            wss.on("connection", (socket) => {
                for (let log of cache_logs) {
                    socket.send(log.toString());
                }
            });
            res = {
                cache_logs,
                wss,
            };
            this._wss_cache.set(key, res);
        }
        return res;
    }
    /**
     * 心跳，不断激活wss的可用性，一旦心跳停止触发，wss服务将会自动停止
     * @param key
     * @param process_name
     */
    heartbeat(key, process_name) {
        const { wss } = this.autoGet(key);
        wss[PROCESS_NAME_SYMBOL] = process_name;
        clearTimeout(wss[AUTO_CLOSE_TI_SYMBOL]);
        wss[AUTO_CLOSE_TI_SYMBOL] = setTimeout(() => {
            this.remove(key);
            // 使用心跳包两倍的时间来监控服务是否存在
        }, HEARTBEAT * 2);
    }
    sendMsg(key, str_msg) {
        // 生成并获取wss服务
        const { cache_logs, wss } = this.autoGet(key);
        // 数据添加到缓冲区，同时维护缓冲区的长度
        cache_logs.push(str_msg);
        while (cache_logs.length > this.cache_logs_line) {
            cache_logs.shift();
        }
        // 向已连接的客户端发送数据
        wss.clients.forEach(socket => {
            socket.send(str_msg);
        });
    }
    has(key) {
        return this._wss_cache.has(key);
    }
    remove(key) {
        var res = this._wss_cache.get(key);
        if (res) {
            res.wss.close();
            this._wss_cache.delete(key);
        }
    }
}
exports.WSSManager = WSSManager;
