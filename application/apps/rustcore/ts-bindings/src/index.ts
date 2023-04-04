import { v4 } from 'uuid';
import { setUuidGenerator } from 'platform/env/sequence';

import * as Units from './util/units';
import * as Interfaces from './interfaces/index';
import * as Events from 'platform/env/subscription';

export { CancelablePromise, PromiseExecutor, ICancelablePromise } from 'platform/env/promise';
export {
    TFileOptions,
    IFileOptionsDLT,
    EFileOptionsRequirements,
} from './api/executors/session.stream.observe.executor';
export {
    Session,
    Observe,
    SessionSearch,
    SessionStream,
    ISessionEvents,
    IProgressEvent,
    IProgressState,
    IEventMapUpdated,
    IEventMatchesUpdated,
    IEventIndexedMapUpdated,
    ISearchValuesUpdated,
} from './api/session';

export { Jobs } from './api/jobs';

export {
    IGrabbedElement,
    IExtractDTFormatOptions,
    IExtractDTFormatResult,
    IResultSearchElement,
    IMapEntity,
    IMatchEntity,
    IFilter,
    IFilterFlags,
    IGrabbedContent,
} from './interfaces/index';

export * as dlt from './native/native.dlt';
export * as files from './native/native.files';
export * as tools from './native/native.tools';
export * as serial from './native/native.serial';
export * as regex from './native/native.regex';
export * as shells from './native/native.shells';

export { Units, Events, Interfaces };

setUuidGenerator(v4);
import { ProgressTrackerNoType } from "./native/native";
export function createTracker() : any|Error {
    console.log(ProgressTrackerNoType);
    const tracker = new ProgressTrackerNoType();
    try {
        tracker.init((event: any) => {
            console.log("Progress Tracker:: event " + event);
        });
        return tracker;
    } catch(error) {
        console.log(error);
        return new Error(error as string);
    }

}