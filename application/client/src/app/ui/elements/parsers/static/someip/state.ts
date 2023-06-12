import { File } from '@platform/types/files';
import { bridge } from '@service/bridge';
import { Base } from '../../state';

import * as SomeIp from '@platform/types/observe/parser/someip';

export class State extends Base<SomeIp.IConfiguration> {

    public fibex: File[] = [];

    public from(configuration: SomeIp.IConfiguration) {
        this.configuration = configuration;
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

}
