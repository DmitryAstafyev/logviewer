import { error } from '../../../log/utils';
import { Configuration as Base, ConfigurationStaticDesc } from '../configuration';
import { OriginDetails, IOriginDetails, IList } from '../description';
import { Configuration as ConfigurationFile } from './file';
import { Context, SourceUuid } from './index';
import { basefolder } from '../../../env/str';
import { Statics } from '../../../env/decorators';

import * as Types from '../types';
import * as Parser from '../parser';
import * as Sde from '../sde';

export type IConfiguration = [SourceUuid, Types.File.FileType, Types.File.FileName][];

@Statics<ConfigurationStaticDesc<IConfiguration, Context>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Context>
    implements OriginDetails, Sde.Support, Parser.Support
{
    static desc(): IList {
        return {
            major: `Files`,
            minor: 'Local Files',
            icon: 'files',
        };
    }

    static alias(): Context {
        return Context.Concat;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        try {
            if (!(configuration instanceof Array) || configuration.length === 0) {
                throw new Error(
                    `Source "${Context.Concat}" should be represented as a not empty array.`,
                );
            } else {
                configuration.forEach((file) => {
                    // If file settings are not correct it will throw an error
                    new ConfigurationFile(file);
                });
            }
            return configuration;
        } catch (e) {
            return new Error(error(e));
        }
    }

    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return [];
    }

    public desc(): IOriginDetails {
        const first = this.get()[0];
        return {
            major: `Concating ${this.get().length} files`,
            minor: first !== undefined ? basefolder(first[2]) : '',
            icon: 'insert_drive_file',
            state: {
                running: 'processing',
                stopped: '',
            },
        };
    }

    public isSdeSupported(): boolean {
        return false;
    }

    public getSupportedParsers(): Parser.Reference[] {
        if (this.get().length === 0) {
            throw new Error(`No available files for concat operation; fail to get list of parsers`);
        }
        switch (this.get()[0][1]) {
            case Types.File.FileType.Binary:
                return [Parser.Dlt.Configuration, Parser.SomeIp.Configuration];
            case Types.File.FileType.PcapNG:
                return [Parser.Dlt.Configuration, Parser.SomeIp.Configuration];
            case Types.File.FileType.Text:
                return [Parser.Text.Configuration];
        }
    }
}
