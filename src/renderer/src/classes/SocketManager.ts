
    // src/renderer/src/classes/SocketManager.ts
    import { io, type Socket } from 'socket.io-client';

    export class SocketManager {
    private _socket: Socket | null = null;

    connect(jwt: string) {
        const socket = io('http://localhost:3900', {
            transports: ['websocket'],
            auth: { token: jwt },
        });
        this._socket = socket;
        return socket;
    }

    disconnect() {
        this._socket?.disconnect();
    }

    // Typed wrapper: event + listener
    on(event: string, listener: (...args: any[]) => void) {
        this._socket?.on(event, listener);
    }

    // Typed wrapper: emit(event, ...args)
    emit(event: string, ...args: any[]) {
        this._socket?.emit(event, ...args);
    }

    off(event: string, listener?: (...args: any[]) => void) {
        if (!this._socket) return;
        if (listener) this._socket.off(event, listener);
        else this._socket.off(event);
    }

    get connected() {
        return this._socket?.connected ?? false;
    }

    get raw(): Socket | null {
        return this._socket;
    }
    }
