/**
 * Copyright (c) 2014 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Implements the attach method, that attaches the terminal to a WebSocket stream.
 */

/// <reference path="node_modules/xterm/typings/xterm.d.ts"/>
import { Terminal } from 'xterm';
export interface IAttachAddonTerminal extends Terminal {
    __socket?: WebSocket;
    __attachSocketBuffer?: string;
    __getMessage?(ev: MessageEvent): void;
    __flushBuffer?(): void;
    __pushToBuffer?(data: string): void;
    __sendData?(...args: any[]): void;
}


/**
 * Attaches the given terminal to the given socket.
 *
 * @param term The terminal to be attached to the given socket.
 * @param socket The socket to attach the current terminal.
 * @param bidirectional Whether the terminal should send data to the socket as well.
 * @param buffered Whether the rendering of incoming data should happen instantly or at a maximum
 * frequency of 1 rendering per 10ms.
 */
export function attach(term: Terminal, socket: WebSocket, bidirectional: boolean, buffered: boolean): void {
    const addonTerminal = <IAttachAddonTerminal>term;
    bidirectional = (typeof bidirectional === 'undefined') ? true : bidirectional;
    addonTerminal.__socket = socket;

    addonTerminal.__flushBuffer = () => {
        addonTerminal.__attachSocketBuffer && addonTerminal.write(addonTerminal.__attachSocketBuffer);
        addonTerminal.__attachSocketBuffer = undefined;
    };

    addonTerminal.__pushToBuffer = (data: string) => {
        if (addonTerminal.__attachSocketBuffer) {
            addonTerminal.__attachSocketBuffer += data;
        } else {
            addonTerminal.__attachSocketBuffer = data;
            setTimeout(addonTerminal.__flushBuffer, 10);
        }
    };

    let myTextDecoder;

    addonTerminal.__getMessage = function (ev: MessageEvent): void {
        let str;

        if (typeof ev.data === 'object') {
            if (!myTextDecoder) {
                myTextDecoder = new TextDecoder();
            }
            if (ev.data instanceof ArrayBuffer) {
                str = myTextDecoder.decode(ev.data);
                displayData(str);
            } else {
                let fileReader = new FileReader();

                fileReader.addEventListener('load', () => {
                    str = myTextDecoder.decode(this.result);
                    displayData(str);
                });
                fileReader.readAsArrayBuffer(ev.data);
            }
        } else if (typeof ev.data === 'string') {
            displayData(ev.data);
        } else {
            throw Error(`Cannot handle "${typeof ev.data}" websocket message.`);
        }
    };

    /**
    * Push data to buffer or write it in the terminal.
    * This is used as a callback for FileReader.onload.
    *
    * @param str String decoded by FileReader.
    * @param data The data of the EventMessage.
    */
    function displayData(str?: string, data?: string): void {
        const pdata = (str || data) as string;
        if (buffered) {
            addonTerminal.__pushToBuffer && addonTerminal.__pushToBuffer(pdata);
        } else {
            addonTerminal.write(pdata);
            addonTerminal.write
        }
    }

    addonTerminal.__sendData = (data: string) => {
        if (socket.readyState !== 1) {
            return;
        }
        socket.send(data);
    };

    socket.addEventListener('message', addonTerminal.__getMessage);

    if (bidirectional) {
        addonTerminal.on('data', addonTerminal.__sendData);
    }

    socket.addEventListener('close', () => detach(addonTerminal, socket));
    socket.addEventListener('error', () => detach(addonTerminal, socket));
}

/**
 * Detaches the given terminal from the given socket
 *
 * @param term The terminal to be detached from the given socket.
 * @param socket The socket from which to detach the current terminal.
 */
export function detach(term: Terminal, socket: WebSocket): void {
    const addonTerminal = <IAttachAddonTerminal>term;
    addonTerminal.__sendData && addonTerminal.off('data', addonTerminal.__sendData);

    const the_socket = (typeof socket === 'undefined') ? addonTerminal.__socket : socket;

    if (the_socket) {
        the_socket.removeEventListener('message', addonTerminal.__getMessage as any);
    }

    delete addonTerminal.__socket;
}


export function apply(terminalConstructor: typeof Terminal): void {
    /**
     * Attaches the current terminal to the given socket
     *
     * @param socket The socket to attach the current terminal.
     * @param bidirectional Whether the terminal should send data to the socket as well.
     * @param buffered Whether the rendering of incoming data should happen instantly or at a maximum
     * frequency of 1 rendering per 10ms.
     */
    (<any>terminalConstructor.prototype).attach = function (socket: WebSocket, bidirectional: boolean, buffered: boolean): void {
        attach(this, socket, bidirectional, buffered);
    };

    /**
     * Detaches the current terminal from the given socket.
     *
     * @param socket The socket from which to detach the current terminal.
     */
    (<any>terminalConstructor.prototype).detach = function (socket: WebSocket): void {
        detach(this, socket);
    };
}