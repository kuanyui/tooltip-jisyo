import { MyStorage, storageManager, TypedMsg } from "./common";

browser.runtime.onMessage.addListener((_ev: any) => {
    const ev = _ev as TypedMsg
    const reply = (r: TypedMsg) => Promise.resolve(r)
    switch (ev.type) {
        case 'query':
            return
    }
})

const STORAGE: MyStorage = storageManager.getDefaultData()





browser.pageAction.onClicked.addListener(function (tab) {
})

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {

    }
});

// Storage
console.log('[background] first time to get config from storage')
storageManager.getData().then((obj) => {
    Object.assign(STORAGE, obj.enabledEngines)
})

storageManager.onDataChanged((changes) => {
    console.log('[background] storage changed!', changes)
    STORAGE.enabledEngines = changes.enabledEngines.newValue
})
