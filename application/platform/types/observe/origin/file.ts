import { error } from '../../../log/utils';
import { Configuration as Base, ConfigurationStaticDesc } from '../configuration';
import { Context, SourceUuid } from './index';
import { OriginDetails, IOriginDetails, IList } from '../description';
import { filename, basefolder } from '../../../env/str';
import { Statics } from '../../../env/decorators';
import { unique } from '../../../env/sequence';

import * as str from '../../../env/str';
import * as Types from '../types';
import * as Parser from '../parser';
import * as Sde from '../sde';

export type IConfiguration = [SourceUuid, Types.File.FileType, Types.File.FileName];

@Statics<ConfigurationStaticDesc<IConfiguration, Context>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Context>
    implements OriginDetails, Sde.Support, Parser.Support
{
    static desc(): IList {
        return {
            major: `File`,
            minor: 'Local File',
            icon: 'file',
        };
    }

    static alias(): Context {
        return Context.File;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        try {
            if (configuration instanceof Array && configuration.length === 3) {
                str.asNotEmptyString(
                    configuration[0],
                    `SourceUuid isn't found: ${configuration[0]}`,
                );
                str.asNotEmptyString(
                    configuration[2],
                    `Origin.FileName isn't found: ${configuration[2]}`,
                );
                if (Types.File.getFileTypeFrom(configuration[1]) instanceof Error) {
                    throw new Error(`Invalid Origin.FileType: ${configuration[1]}`);
                }
            } else {
                throw new Error(
                    `Source "${Context.File}" should be represented as an array, len = 3.`,
                );
            }
            return configuration;
        } catch (e) {
            return new Error(error(e));
        }
    }

    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return [unique(), Types.File.FileType.Text, ''];
    }

    public set(): {
        filename(filename: string): Configuration;
        type(type: Types.File.FileType): Configuration;
    } {
        return {
            filename: (filename: string): Configuration => {
                this.configuration[2] = filename;
                return this;
            },
            type: (type: Types.File.FileType): Configuration => {
                this.configuration[1] = type;
                return this;
            },
        };
    }

    public filename(): string {
        return this.configuration[2];
    }

    public filetype(): Types.File.FileType {
        return this.configuration[1];
    }

    public desc(): IOriginDetails {
        return {
            major: filename(this.configuration[2]),
            minor: basefolder(this.configuration[2]),
            icon: 'insert_drive_file',
            state: {
                running: 'tail',
                stopped: '',
            },
        };
    }

    public isSdeSupported(): boolean {
        return false;
    }

    public getSupportedParsers(): Parser.Reference[] {
        switch (this.configuration[1]) {
            case Types.File.FileType.Binary:
                return [Parser.Dlt.Configuration, Parser.SomeIp.Configuration];
            case Types.File.FileType.PcapNG:
                return [Parser.Dlt.Configuration, Parser.SomeIp.Configuration];
            case Types.File.FileType.Text:
                return [Parser.Text.Configuration];
        }
    }
}