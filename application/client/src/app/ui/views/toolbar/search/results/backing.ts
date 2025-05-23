import { Session } from '@service/session';
import { IRowsPacket, Service } from '@elements/scrollarea/controllers/service';
import { Range, IRange } from '@platform/types/range';
import { Owner, RowSrc } from '@schema/content/row';
import { GrabbedElement } from '@platform/types/bindings/miscellaneous';
import { Nature } from '@platform/types/content';

const SCROLLAREA_SERVICE = 'search_scroll_area_service';

async function getRowFrom(
    session: Session,
    element: GrabbedElement,
    elements: GrabbedElement[],
    index: number,
): Promise<RowSrc> {
    const row: RowSrc = {
        position: element.pos,
        content: element.content,
        session: session,
        owner: Owner.Search,
        source:
            typeof element.source_id === 'string'
                ? parseInt(element.source_id, 10)
                : element.source_id,
        nature: new Nature(element.nature),
    };
    if (!row.nature.seporator) {
        return row;
    }
    if (index > 0 && index < elements.length - 1) {
        row.nature.hidden = elements[index + 1].pos - elements[index - 1].pos;
        return row;
    }
    const around = await session.indexed.getIndexesAround(element.pos);
    if (around.before !== undefined && around.after !== undefined) {
        row.nature.hidden = around.after - around.before;
    } else {
        row.nature.hidden =
            around.before !== undefined
                ? element.pos - around.before
                : around.after !== undefined
                ? around.after - element.pos
                : 0;
    }
    return row;
}
function getRows(session: Session, range: Range | IRange): Promise<IRowsPacket> {
    return new Promise((resolve, reject) => {
        session.indexed
            .grab(range)
            .then(async (elements) => {
                const rows = [];
                for (let i = 0; i < elements.length; i += 1) {
                    rows.push(await getRowFrom(session, elements[i], elements, i));
                }
                resolve({ rows, range });
            })
            .catch(reject);
    });
}

export function getScrollAreaService(session: Session): Service {
    const restored = session.storage.get<Service>(SCROLLAREA_SERVICE);
    if (restored === undefined) {
        const service = new Service({
            getRows: (range: Range) => {
                return getRows(session, range);
            },
            setFrame: (range: Range) => {
                getRows(session, range)
                    .then((packet) => {
                        service.setRows(packet);
                    })
                    .catch((err: Error) => {
                        throw new Error(`Fail get indexed chunk: ${err.message}`);
                    });
            },
            getLen: (): number => {
                return session.indexed.len();
            },
            getItemHeight: (): number => {
                return 16;
            },
        });
        service.setLen(session.indexed.len());
        return service;
    } else {
        restored.setLen(session.indexed.len());
        return restored;
    }
}

export function setScrollAreaService(session: Session, service: Service) {
    session.storage.set(SCROLLAREA_SERVICE, service);
}
