// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.

/**
 * Represents the result of a command execution.
 * At the core level, this type is used for all commands invoked within an `UnboundSession`.
 * It is only used to indicate the successful completion or interruption of a command.
 */
export type CommandOutcomeBool = { Finished: boolean } | 'Cancelled';

/**
 * Represents the result of a command execution.
 * At the core level, this type is used for all commands invoked within an `UnboundSession`.
 * It is only used to indicate the successful completion or interruption of a command.
 */
export type CommandOutcomeDltStatisticInfoResult = { Finished: DltStatisticInfo } | 'Cancelled';

/**
 * Represents the result of a command execution.
 * At the core level, this type is used for all commands invoked within an `UnboundSession`.
 * It is only used to indicate the successful completion or interruption of a command.
 */
export type CommandOutcomeFoldersScanningResult = { Finished: FoldersScanningResult } | 'Cancelled';

/**
 * Represents the result of a command execution.
 * At the core level, this type is used for all commands invoked within an `UnboundSession`.
 * It is only used to indicate the successful completion or interruption of a command.
 */
export type CommandOutcomeOptionalString = { Finished: string | null } | 'Cancelled';

/**
 * Represents the result of a command execution.
 * At the core level, this type is used for all commands invoked within an `UnboundSession`.
 * It is only used to indicate the successful completion or interruption of a command.
 */
export type CommandOutcomeProfilesResult = { Finished: ProfileList } | 'Cancelled';

/**
 * Represents the result of a command execution.
 * At the core level, this type is used for all commands invoked within an `UnboundSession`.
 * It is only used to indicate the successful completion or interruption of a command.
 */
export type CommandOutcomeSerialPortsList = { Finished: SerialPortsList } | 'Cancelled';

/**
 * Represents the result of a command execution.
 * At the core level, this type is used for all commands invoked within an `UnboundSession`.
 * It is only used to indicate the successful completion or interruption of a command.
 */
export type CommandOutcomeString = { Finished: string } | 'Cancelled';

/**
 * Represents the result of a command execution.
 * At the core level, this type is used for all commands invoked within an `UnboundSession`.
 * It is only used to indicate the successful completion or interruption of a command.
 */
export type CommandOutcomeVoid = 'Finished' | 'Cancelled';

/**
 * Represents the result of a command execution.
 * At the core level, this type is used for all commands invoked within an `UnboundSession`.
 * It is only used to indicate the successful completion or interruption of a command.
 */
export type CommandOutcomei64 = { Finished: number } | 'Cancelled';

export type DltLevelDistribution = {
    non_log: number;
    log_fatal: number;
    log_error: number;
    log_warning: number;
    log_info: number;
    log_debug: number;
    log_verbose: number;
    log_invalid: number;
};

export type DltStatisticInfo = {
    app_ids: Array<[string, DltLevelDistribution]>;
    context_ids: Array<[string, DltLevelDistribution]>;
    ecu_ids: Array<[string, DltLevelDistribution]>;
    contained_non_verbose: boolean;
};

/**
 * Represents a folder entity in the file system.
 */
export type FolderEntity = {
    /**
     * The name of the entity (file or folder).
     */
    name: string;
    /**
     * The full path of the entity.
     */
    fullname: string;
    /**
     * The type of the entity (e.g., file, directory, symbolic link).
     */
    kind: FolderEntityType;
    /**
     * Optional detailed information about the entity.
     */
    details: FolderEntityDetails | null;
};

/**
 * Contains detailed information about a folder entity.
 */
export type FolderEntityDetails = {
    /**
     * The name of the file or folder.
     */
    filename: string;
    /**
     * The full path to the file or folder.
     */
    full: string;
    /**
     * The directory path containing the file or folder.
     */
    path: string;
    /**
     * The base name of the file or folder.
     */
    basename: string;
    /**
     * The file extension, if applicable.
     */
    ext: string;
};

/**
 * Represents the type of a folder entity in the file system.
 */
export enum FolderEntityType {
    BlockDevice = 'BlockDevice',
    CharacterDevice = 'CharacterDevice',
    Directory = 'Directory',
    FIFO = 'FIFO',
    File = 'File',
    Socket = 'Socket',
    SymbolicLink = 'SymbolicLink',
}

/**
 * Represents the result of scanning a folder.
 */
export type FoldersScanningResult = {
    /**
     * A list of folder entities found during the scan.
     */
    list: Array<FolderEntity>;
    /**
     * Indicates whether the maximum length of results was reached.
     */
    max_len_reached: boolean;
};

export type Profile = {
    /**
     * Suggested name of shell. For unix based systems it will be name of executable file,
     * like "bash", "fish" etc. For windows it will be names like "GitBash", "PowerShell"
     * etc.
     */
    name: string;
    /**
     * Path to executable file of shell
     */
    path: string;
    /**
     * List of environment variables. Because extracting operation could take some time
     * by default `envvars = None`. To load data should be used method `load`, which will
     * make attempt to detect environment variables.
     */
    envvars: Map<string, string>;
    /**
     * true - if path to executable file of shell is symlink to another location.
     */
    symlink: boolean;
};

/**
 * Represents a list of serial ports.
 *
 * This structure contains a vector of strings, where each string represents the name
 * or identifier of a serial port available on the system.
 */
export type ProfileList = Array<Profile>;

/**
 * Represents a list of serial ports.
 *
 * This structure contains a vector of strings, where each string represents the name
 * or identifier of a serial port available on the system.
 */
export type SerialPortsList = Array<string>;