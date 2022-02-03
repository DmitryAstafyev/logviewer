// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session, DataSource } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { createSampleFile, finish } from './common';
import { getLogger } from '../src/util/logging';

const PCAPNG_EXAMPLE_FILE: string = '/storage/projects/esrlabs/logs-examples/test.pcapng';

describe('Assign', function () {
    it('Test 1. Assign and grab content (text)', function (done) {
        const logger = getLogger('Assign. Test 1');
        Session.create()
            .then((session: Session) => {
                // Set provider into debug mode
                session.debug(true, 'Assign. Test 1');
                const stream = session.getStream();
                if (stream instanceof Error) {
                    finish(session, done, stream);
                    return;
                }
                const events = session.getEvents();
                if (events instanceof Error) {
                    finish(session, done, events);
                    return;
                }
                const tmpobj = createSampleFile(
                    5000,
                    logger,
                    (i: number) => `some line data: ${i}\n`,
                );
                stream
                    .observe(DataSource.asTextFile(tmpobj.name))
                    .catch(finish.bind(null, session, done));
                let grabbing: boolean = false;
                events.StreamUpdated.subscribe((rows: number) => {
                    if (rows === 0 || grabbing) {
                        return;
                    }
                    grabbing = true;
                    stream
                        .grab(500, 7)
                        .then((result: IGrabbedElement[]) => {
                            logger.debug('result of grab was: ' + JSON.stringify(result));
                            expect(result.map((i) => i.content)).toEqual([
                                'some line data: 500',
                                'some line data: 501',
                                'some line data: 502',
                                'some line data: 503',
                                'some line data: 504',
                                'some line data: 505',
                                'some line data: 506',
                            ]);
                            finish(session, done);
                        })
                        .catch((err: Error) => {
                            finish(
                                session,
                                done,
                                new Error(`Fail to grab data due error: ${err.message}`),
                            );
                        });
                });
            })
            .catch((err: Error) => {
                finish(
                    undefined,
                    done,
                    new Error(`Fail to create session due error: ${err.message}`),
                );
            });
    });

    it('Test 2. Assign and grab content (pcapng)', function (done) {
        const logger = getLogger('Assign. Test 2');
        Session.create()
            .then((session: Session) => {
                // Set provider into debug mode
                session.debug(true, 'Assign. Test 2');
                const stream = session.getStream();
                if (stream instanceof Error) {
                    finish(session, done, stream);
                    return;
                }
                const events = session.getEvents();
                if (events instanceof Error) {
                    finish(session, done, events);
                    return;
                }
                stream
                    .observe(DataSource.asPcapFile(PCAPNG_EXAMPLE_FILE))
                    .catch(finish.bind(null, session, done));
                let grabbing: boolean = false;
                events.StreamUpdated.subscribe((rows: number) => {
                    if (rows < 100 || grabbing) {
                        return;
                    }
                    grabbing = true;
                    stream
                        .grab(1, 10)
                        .then((result: IGrabbedElement[]) => {
                            expect(result.length).toEqual(10);
                            logger.debug('result of grab was: ' + JSON.stringify(result));
                            finish(session, done);
                        })
                        .catch((err: Error) => {
                            finish(
                                session,
                                done,
                                new Error(`Fail to grab data due error: ${err.message}`),
                            );
                        });
                });
            })
            .catch((err: Error) => {
                finish(
                    undefined,
                    done,
                    new Error(`Fail to create session due error: ${err.message}`),
                );
            });
    });
});
