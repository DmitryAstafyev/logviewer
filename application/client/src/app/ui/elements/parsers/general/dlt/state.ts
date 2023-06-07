import { File } from '@platform/types/files';
import { Timezone } from '@elements/timezones/timezone';
import { bridge } from '@service/bridge';
import { components } from '@env/decorators/initial';
import { IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';

import * as Dlt from '@platform/types/observe/parser/dlt';

export class State {
    protected ref!: IlcInterface & ChangesDetector;

    public readonly LOG_LEVELS: { value: Dlt.LogLevel; caption: string }[] = [
        { value: Dlt.LogLevel.Fatal, caption: 'Fatal' },
        { value: Dlt.LogLevel.Error, caption: 'Error' },
        { value: Dlt.LogLevel.Warn, caption: 'Warn' },
        { value: Dlt.LogLevel.Info, caption: 'Info' },
        { value: Dlt.LogLevel.Debug, caption: 'Debug' },
        { value: Dlt.LogLevel.Verbose, caption: 'Verbose' },
    ];
    public fibex: File[] = [];
    public timezone: Timezone | undefined;
    public logLevel: Dlt.LogLevel = Dlt.LogLevel.Verbose;

    constructor(public configuration: Dlt.IConfiguration) {}

    public from(configuration: Dlt.IConfiguration) {
        this.configuration = configuration;
    }

    public bind(ref: IlcInterface & ChangesDetector) {
        this.ref = ref;
    }

    public addFibexFile() {
        bridge
            .files()
            .select.custom('xml')
            .then((files: File[]) => {
                files = files.filter((added) => {
                    return (
                        this.fibex.find((exist) => exist.filename === added.filename) === undefined
                    );
                });
                this.fibex = this.fibex.concat(files);
            })
            .catch((err: Error) => {
                this.ref.log().error(`Fail to open xml (fibex) file(s): ${err.message}`);
            });
    }

    public removeFibex(file: File) {
        this.fibex = this.fibex.filter((f) => f.filename !== file.filename);
    }

    public timezoneSelect() {
        const subscription = this.ref
            .ilc()
            .services.ui.popup.open({
                component: {
                    factory: components.get('app-elements-timezone-selector'),
                    inputs: {
                        selected: (timezone: Timezone): void => {
                            this.timezone = timezone;
                        },
                    },
                },
                closeOnKey: 'Escape',
                width: 350,
                uuid: 'app-elements-timezone-selector',
            })
            .subjects.get()
            .closed.subscribe(() => {
                subscription.unsubscribe();
            });
    }
}
