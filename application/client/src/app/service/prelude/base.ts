import { ParserName, FileType, Parser } from '@platform/types/observe';
import { Source, SourceDefinition } from '@platform/types/transport';

export class Prelude {
    protected readonly required: {
        parser: ParserName | undefined;
        filename: string | undefined;
        transport: Source | undefined;
        concat: string[] | undefined;
        filetype: FileType | undefined;
    } = {
        parser: undefined,
        filename: undefined,
        transport: undefined,
        concat: undefined,
        filetype: undefined,
    };
    protected readonly optional: {
        transport: SourceDefinition | undefined;
        parser: Parser | undefined;
    } = {
        transport: undefined,
        parser: undefined,
    };

    public filename(filename: string): Prelude {
        this.required.filename = filename;
        this.required.concat = undefined;
        this.required.transport = undefined;
        return this;
    }

    public concat(files: string[]): Prelude {
        this.required.filename = undefined;
        this.required.concat = files;
        this.required.transport = undefined;
        return this;
    }

    public source(transport: Source): Prelude {
        this.required.filename = undefined;
        this.required.concat = undefined;
        this.required.filetype = undefined;
        this.required.transport = transport;
        return this;
    }

    public filetype(filetype: FileType): Prelude {
        this.required.filetype = filetype;
        this.required.transport = undefined;
        return this;
    }

    public parser(parser: ParserName | Parser): Prelude {
        // this.required.parser = parser;
        return this;
    }
}
