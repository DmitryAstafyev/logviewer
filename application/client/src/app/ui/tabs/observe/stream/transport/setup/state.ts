import { Subject } from '@platform/env/subscription';

import * as Stream from '@platform/types/observe/origin/stream/index';

export class State extends Stream.Configuration {
    public SOURCE = Stream.Source;
    protected readonly history: Map<Stream.Source, Stream.IDeclaration> = new Map();

    public source: Stream.Source;
    public updated: Subject<void> = new Subject();

    constructor(configuration: Stream.IConfiguration) {
        super(configuration, Stream.Configuration);
        this.source = Stream.getAliasByConfiguration(configuration);
    }

    public destroy() {
        this.updated.destroy();
    }

    public from(configuration: Stream.IConfiguration) {
        this.history.set(this.instance.alias(), this.instance.get());
        this.change().byConfiguration(configuration);
        this.source = Stream.getAliasByConfiguration(configuration);
        this.updated.emit();
    }

    public switch(source: Stream.Source) {
        this.history.set(this.instance.alias(), this.instance.get());
        this.change().byDeclaration(Stream.getByAlias(source, this.history.get(source)));
        this.source = source;
        this.updated.emit();
    }
}
