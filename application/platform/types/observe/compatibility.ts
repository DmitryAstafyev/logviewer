import * as Parser from './parser';
import * as Stream from './origin/stream/index';
import * as Origin from './origin/index';
import * as File from './types/file';

export const Streams: {
    [key: string]: Stream.Reference[];
} = {
    [Parser.Dlt.Configuration.alias()]: [
        // Supported streams
        Stream.Tcp.Configuration,
        Stream.Udp.Configuration,
    ],
    [Parser.SomeIp.Configuration.alias()]: [
        // Supported streams
        Stream.Udp.Configuration,
    ],
    [Parser.Text.Configuration.alias()]: [
        // Supported streams
        Stream.Serial.Configuration,
        Stream.Process.Configuration,
    ],
};

export const Files: {
    [key: string]: File.FileType[];
} = {
    [Parser.Dlt.Configuration.alias()]: [
        // Supported file types
        File.FileType.Binary,
        File.FileType.PcapNG,
    ],
    [Parser.SomeIp.Configuration.alias()]: [
        // Supported file types
        File.FileType.PcapNG,
    ],
    [Parser.Text.Configuration.alias()]: [
        // Supported file types
        File.FileType.Text,
    ],
};

export const SDESupport: {
    [key: string]: boolean;
} = {
    [Origin.Context.File]: false,
    [Origin.Context.Concat]: false,
    [Stream.Source.Process]: true,
    [Stream.Source.Serial]: true,
    [Stream.Source.Tcp]: false,
    [Stream.Source.Udp]: false,
};
