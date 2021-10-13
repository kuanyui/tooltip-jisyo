export type dict_t = 'weblio' | 'goo'
export type tooltip_pos_t = 'top' | 'bottom'
export interface MyStorage {
    enabledEngines: dict_t[],
    tooltipSize: {
        width: string,
        height: string,
    },
    tooltipPos: tooltip_pos_t,
    /** milliseconds */
    showButtonDelay: number
}

export type TypedMsg =
    { type: 'query', data: string }

export function deepCopy<T>(x: T): T {
    return JSON.parse(JSON.stringify(x))
}


class StorageManager {
    area: browser.storage.StorageArea
    constructor() {
        // Firefox for Android (90) doesn't support `sync` area yet,
        // so write a fallback for it.
        if (browser.storage.sync) {
            this.area = browser.storage.sync
        } else {
            this.area = browser.storage.local
        }
    }
    getDefaultData(): MyStorage {
        return {
            enabledEngines: ["weblio", "goo"],
            tooltipSize: {
                width: '500px',
                height: '500px',
            },
            tooltipPos: 'top',
            showButtonDelay: 200,
        }
    }
    setData(d: Partial<MyStorage>): void {
        this.area.set(deepCopy(d))
    }
    getData (): Promise<MyStorage> {
        return this.area.get().then((_d) => {
            const d = _d as unknown as MyStorage
            // Too lazy to do migration ....
            if (
                d.enabledEngines === undefined ||
                d.tooltipSize.height === undefined ||
                d.tooltipSize.width === undefined
            ) {
                const defaultValue = storageManager.getDefaultData()
                storageManager.setData(defaultValue)
                return defaultValue
            }
            return d
        }).catch((err) => {
            console.error('Error when getting settings from browser.storage:', err)
            return storageManager.getDefaultData()
        })
    }
    onDataChanged(cb: (changes: browser.storage.ChangeDict) => void) {
        browser.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'sync' || areaName === 'local') {
                cb(changes)
            }
        })
    }
}
export const storageManager = new StorageManager()

export function sleep(ms: number): Promise<boolean> {
    return new Promise((resolve) => {
        window.setTimeout(() => resolve(true), ms)
    })
}

interface SafeResponseSuccess<T> {
    ok: true,
    d: T
}
interface SafeResponseFailed {
    ok: false,
    err: string
}

type SafeResponse<T> = SafeResponseSuccess<T> | SafeResponseFailed
export function safeFetchHtml(url: string, opts?: RequestInit): Promise<SafeResponse<string>> {
    const abortCtrl = new AbortController()
    if (!opts) {
        opts = {
            mode: "cors",
            method: "get"
        }
    }
    // NOTE: This seems works only under Desktop Firefox.
    const headers = new Headers({
        // 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:83.0) Gecko/20100101 Firefox/83.0'
        'User-Agent': 'Mozilla/5.0 (Android 11; Mobile; rv:83.0) Gecko/83.0 Firefox/83.0'
    })
    opts.headers = headers
    opts.signal = abortCtrl.signal
    const raceResult = Promise.race([
        fetch(url, opts).then(r => {
            return r
        }).catch((err) => {
            if (err && err.type === 'aborted') {  // aborted by AbortController
                return 'Timeout, fetch aborted.'
            }
            console.log('[safeFetch] error, retry.', err)
            return err.message as string
        }),
        sleep(8000).then(_ => null)
    ])
    return raceResult.then(async (r) => {
        if (r === null) {
            abortCtrl.abort()
            return {
                ok: false,
                err: 'aborted',
            }
        } else if (typeof r === 'string') {
            return {
                ok: false,
                err: r,
            }
        } else {
            return {
                ok: true,
                d: await r.text(),
            }
        }
    })
}

export function createDebounceFunction <F extends () => any> (callback: F, duration: number): () => any {
    let timeoutId: number
    return () => {
        clearTimeout(timeoutId)
        timeoutId = window.setTimeout(() => {
            callback()
            timeoutId = -1
        }, duration)
    }
}
