import { IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';

import * as Parsers from '@platform/types/observe/parser/index';

export class State {
    protected ref!: IlcInterface & ChangesDetector;

    constructor(public configuration: Parsers.Configuration) {}

    public bind(ref: IlcInterface & ChangesDetector) {
        this.ref = ref;
    }

    public change(configuration: Parsers.Configuration) {
        this.configuration = configuration;
    }
}
