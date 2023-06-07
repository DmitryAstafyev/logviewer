import { State as UdpState } from './states/udp';
import { State as TcpState } from './states/tcp';
import { State as SerialState } from './states/serial';
import { State as ProcessState } from './states/process';
import { Subject } from '@platform/env/subscription';

import * as Stream from '@platform/types/observe/origin/stream/index';

export class State {
    public udp: UdpState | undefined;
    public tcp: TcpState | undefined;
    public serial: SerialState | undefined;
    public process: ProcessState | undefined;
    public alias: Stream.Alias = Stream.Alias.Tcp;
    public updated: Subject<void> = new Subject();

    private _backup: {
        udp: UdpState;
        tcp: TcpState;
        serial: SerialState;
        process: ProcessState;
    } = {
        udp: new UdpState(),
        tcp: new TcpState(),
        serial: new SerialState(),
        process: new ProcessState(),
    };

    constructor(alias?: Stream.Alias) {
        if (alias !== undefined) {
            this.alias = alias;
        }
        this.switch(this.alias);
    }

    public destroy() {
        this.updated.destroy();
    }

    public from(configuration: Stream.IConfiguration) {
        if (configuration[Stream.Alias.Udp] !== undefined) {
            this.udp = this._backup.udp;
            this.udp.from(configuration[Stream.Alias.Udp]);
            this.switch(Stream.Alias.Udp);
            return;
        }
        if (configuration[Stream.Alias.Tcp] !== undefined) {
            this.tcp = this._backup.tcp;
            this.tcp.from(configuration[Stream.Alias.Tcp]);
            this.switch(Stream.Alias.Tcp);
            return;
        }
        if (configuration[Stream.Alias.Serial] !== undefined) {
            this.serial = this._backup.serial;
            this.serial.from(configuration[Stream.Alias.Serial]);
            this.switch(Stream.Alias.Serial);
            return;
        }
        if (configuration[Stream.Alias.Process] !== undefined) {
            this.process = this._backup.process;
            this.process.from(configuration[Stream.Alias.Process]);
            this.switch(Stream.Alias.Process);
            return;
        }
    }

    public switch(alias?: Stream.Alias) {
        this._backup.udp = this.udp === undefined ? this._backup.udp : this.udp;
        this._backup.tcp = this.tcp === undefined ? this._backup.tcp : this.tcp;
        this._backup.serial = this.serial === undefined ? this._backup.serial : this.serial;
        this._backup.process = this.process === undefined ? this._backup.process : this.process;
        if (alias !== undefined) {
            this.alias = alias;
        }
        switch (alias === undefined ? this.alias : alias) {
            case Stream.Alias.Udp:
                this.udp = this._backup.udp;
                this.tcp = undefined;
                this.serial = undefined;
                this.process = undefined;
                break;
            case Stream.Alias.Tcp:
                this.tcp = this._backup.tcp;
                this.udp = undefined;
                this.serial = undefined;
                this.process = undefined;
                break;
            case Stream.Alias.Serial:
                this.serial = this._backup.serial;
                this.tcp = undefined;
                this.udp = undefined;
                this.process = undefined;
                break;
            case Stream.Alias.Process:
                this.process = this._backup.process;
                this.tcp = undefined;
                this.udp = undefined;
                this.serial = undefined;
                break;
        }
        this.updated.emit();
    }

    public configuration(): Stream.IConfiguration {
        return {
            [Stream.Alias.Udp]: this.udp?.accept().configuration(),
            [Stream.Alias.Tcp]: this.tcp?.accept().configuration(),
            [Stream.Alias.Process]: this.process?.accept().configuration(),
            [Stream.Alias.Serial]: this.serial?.accept().configuration(),
        };
    }
}
