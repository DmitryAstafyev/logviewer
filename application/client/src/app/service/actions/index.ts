import * as FileDlt from './file.dlt';
import * as FileText from './file.text';
import * as FilePcap from './file.pcapng';
import * as FilePcapLegacy from './file.pcap';
import * as FileParserPlugin from './file.parserPlugin';
import * as FileAny from './file.any';
import * as FolderDlt from './folder.dlt';
import * as FolderText from './folder.text';
import * as FolderPcap from './folder.pcapng';
import * as FolderPcapLegacy from './folder.pcap';
import * as FolderParserPlugin from './folder.parserPlugin';
import * as FolderAny from './folder.any';
import * as UdpDlt from './udp.dlt';
import * as UdpParserPlugin from './udp.parserPlugin';
import * as TcpDlt from './tcp.dlt';
import * as TcpParserPlugin from './tcp.parserPlugin';
import * as SerialText from './serial.text';
import * as SerialParserPlugin from './serial.parserPlugin';
import * as StdoutText from './stdout.text';
import * as About from './about';
import * as JumpTo from './jumpto';
import * as FindInSearch from './find';
import * as Updates from './updates';
import * as Settings from './settings';
import * as Exit from './exit';
import * as Help from './help';
import * as ExportSession from './export.session.state';
import * as ImportSession from './import.session.state';
import * as ThemeDark from './theme.dark';
import * as ThemeLight from './theme.light';
import * as PluginsManager from './plugins_manager';
import * as StdoutPlugin from './stdout.plugin';

import { Base } from './action';

export * as FileDlt from './file.dlt';
export * as FileText from './file.text';
export * as FilePcap from './file.pcapng';
export * as FilePcapLegacy from './file.pcap';
export * as FileParserPlugin from './file.parserPlugin';
export * as FileAny from './file.any';
export * as FolderDlt from './folder.dlt';
export * as FolderText from './folder.text';
export * as FolderPcap from './folder.pcapng';
export * as FolderPcapLegacy from './folder.pcap';
export * as FolderParserPlugin from './folder.parserPlugin';
export * as FolderAny from './folder.any';
export * as UdpDlt from './udp.dlt';
export * as UdpParserPlugin from './udp.parserPlugin';
export * as TcpDlt from './tcp.dlt';
export * as TcpParserPlugin from './tcp.parserPlugin';
export * as SerialText from './serial.text';
export * as SerialParserPlugin from './serial.parserPlugin';
export * as StdoutText from './stdout.text';
export * as About from './about';
export * as JumpTo from './jumpto';
export * as FindInSearch from './find';
export * as Updates from './updates';
export * as Settings from './settings';
export * as Exit from './exit';
export * as Help from './help';
export * as ExportSession from './export.session.state';
export * as ImportSession from './import.session.state';
export * as ThemeDark from './theme.dark';
export * as ThemeLight from './theme.light';
export * as PluginsManager from './plugins_manager';
export * as StdoutPlugin from './stdout.plugin';

export { Base } from './action';

export const all = [
    [FileDlt.ACTION_UUID, FileDlt.Action],
    [FileText.ACTION_UUID, FileText.Action],
    [FilePcap.ACTION_UUID, FilePcap.Action],
    [FilePcapLegacy.ACTION_UUID, FilePcapLegacy.Action],
    [FileParserPlugin.ACTION_UUID, FileParserPlugin.Action],
    [FileAny.ACTION_UUID, FileAny.Action],
    [FolderDlt.ACTION_UUID, FolderDlt.Action],
    [FolderText.ACTION_UUID, FolderText.Action],
    [FolderPcap.ACTION_UUID, FolderPcap.Action],
    [FolderPcapLegacy.ACTION_UUID, FolderPcapLegacy.Action],
    [FolderParserPlugin.ACTION_UUID, FolderParserPlugin.Action],
    [FolderAny.ACTION_UUID, FolderAny.Action],
    [UdpDlt.ACTION_UUID, UdpDlt.Action],
    [UdpParserPlugin.ACTION_UUID, UdpParserPlugin.Action],
    [TcpDlt.ACTION_UUID, TcpDlt.Action],
    [TcpParserPlugin.ACTION_UUID, TcpParserPlugin.Action],
    [SerialText.ACTION_UUID, SerialText.Action],
    [SerialParserPlugin.ACTION_UUID, SerialParserPlugin.Action],
    [StdoutText.ACTION_UUID, StdoutText.Action],
    [About.ACTION_UUID, About.Action],
    [JumpTo.ACTION_UUID, JumpTo.Action],
    [FindInSearch.ACTION_UUID, FindInSearch.Action],
    [Updates.ACTION_UUID, Updates.Action],
    [Settings.ACTION_UUID, Settings.Action],
    [Help.ACTION_UUID, Help.Action],
    [Exit.ACTION_UUID, Exit.Action],
    [ExportSession.ACTION_UUID, ExportSession.Action],
    [ImportSession.ACTION_UUID, ImportSession.Action],
    [ThemeDark.ACTION_UUID, ThemeDark.Action],
    [ThemeLight.ACTION_UUID, ThemeLight.Action],
    [PluginsManager.ACTION_UUID, PluginsManager.Action],
    [StdoutPlugin.ACTION_UUID, StdoutPlugin.Action],
];

export function getActionByUuid(uuid: string): Base | undefined {
    const action = all.find((d) => d[0] === uuid);
    return action === undefined ? undefined : new (action[1] as { new (): Base })();
}
