import { TypedMsg, storageManager, safeFetchHtml, dict_t, createDebounceFunction } from "./common"
import { arrow, createPopper, Instance, popper, VirtualElement } from '@popperjs/core'
// import tippy from 'tippy.js';
const BTN_ID = 'tooltipJisyo_btn'
const TOOLTIP_ID = 'tooltipJisyo_tooltip'

interface DefinitionSection {
    /** For example, 大辞林、小学館 */
    source: {
        wordLink: string,
        bookName: string,
        bookLink: string
    }
    sectionElement: Element
}

browser.runtime.onMessage.addListener((_ev: any) => {
    const ev = _ev as TypedMsg
    const reply = (r: TypedMsg) => Promise.resolve(r)
    if (ev.type === 'query') {
        const res: TypedMsg = { type: ev.type, data: '' }
        console.log('send to background~', res)
        return Promise.resolve(res)
    }
})


function getFloatBtn(): HTMLElement {
    const existedEl = document.getElementById(BTN_ID)
    if (existedEl) { return existedEl}
    const el = document.createElement('div')
    el.id = BTN_ID
    el.innerText = '辞書'
    el.style.display = 'block'
    el.style.position = 'absolute'
    el.style.zIndex = '99999999999999999'
    el.style.padding = '8px'
    el.style.backgroundColor = '#cc4444'
    el.style.color = '#ffffff'
    el.style.borderColor = '#440000'
    el.style.borderStyle = 'solid'
    el.style.borderWidth = '1px'
    el.style.cursor = 'pointer'
    el.style.overflowY = 'auto'
    return el
}

function initSelectionEventHandler() {
    // selectionchange is often triggered before button clicked, so add a timeout
    const selectionEvtHandler = () => {
        const floatBtn = getFloatBtn()
        const selection = document.getSelection()
        if (!selection) {
            floatBtn.remove()
            console.log('[DEBUG] no selection, remove button')
            return
        }
        let text = selection.toString()
        // console.log('selection changed!', text)
        if (!text) {
            console.log('[DEBUG] no text, remove button')
            floatBtn.remove()
            return
        }
        console.log('text changed ==>', text)
        let range = selection.getRangeAt(selection.rangeCount - 1)
        let rect = range.getBoundingClientRect()
        floatBtn.style.top = `calc(${window.scrollY + rect.top}px + 48px)`
        floatBtn.style.left = `calc(${rect.left}px + calc(${rect.width}px / 2) - 40px)`
        floatBtn.onclick = (ev) => {
            ev.stopPropagation()
            const virtualEl = {
                getBoundingClientRect: () => {
                    return rect
                }
            }
            console.log('[SUCCESS] float btn clicked')
            dictMan.openTooltipForQuery(virtualEl, text)
        }
            document.body.appendChild(floatBtn)
    }
    const debouncedSelectionEvtHandler = createDebounceFunction(selectionEvtHandler, 300)
    document.addEventListener('selectionchange', () => {
        debouncedSelectionEvtHandler()
    })
}


class DictManager  {
    domParser: DOMParser = new window.DOMParser()
    instance: Instance | undefined
    private parseDom(html: string): Document {
        return this.domParser.parseFromString(html, 'text/html')
    }
    private createTooltipElement(posEl: Element | VirtualElement) {
        const existedEl = document.getElementById(TOOLTIP_ID)
        if (existedEl) { return existedEl }
        const popperEl = document.createElement('div')
        popperEl.id = TOOLTIP_ID
        popperEl.setAttribute('role', 'tooltip')
        const arrowEl = document.createElement('div')
        arrowEl.className = 'arrow'
        arrowEl.dataset['popperArrow'] = 'true'
        const scrollArea = document.createElement('div')
        scrollArea.className = 'scrollArea'
        const gooEl = document.createElement('div')
        gooEl.className = 'dict_goo'
        const weblioEl = document.createElement('div')
        weblioEl.className = 'dict_weblio'
        popperEl.append(scrollArea)
        popperEl.append(arrowEl)
        scrollArea.append(gooEl)
        scrollArea.append(weblioEl)
        popperEl.addEventListener('click', (ev) => {
            ev.stopPropagation()
        })
        document.body.append(popperEl)
        this.instance = createPopper(posEl, popperEl, {
            placement: 'auto',
            modifiers: [
              {
                name: 'offset',
                options: {
                  offset: [0, 8],
                },
              },
            ],
        })
        window.setTimeout(() => {
            const destroyer = () => {
                const el = document.getElementById(TOOLTIP_ID)
                if (el) {
                    el.remove()
                }
                if (this.instance) {
                    this.instance.destroy()
                }
                document.body.removeEventListener('click', destroyer)
            }
            document.body.addEventListener('click', destroyer)
        }, 500)
    }
    private clearResult() {
        let el
        el = this.getDictElemInTooltip('goo')
        if (el) { el.innerText = '' }
        el = this.getDictElemInTooltip('weblio')
        if (el) { el.innerText = '' }
    }
    private getDictElemInTooltip(dictId: dict_t): HTMLElement | undefined {
        const rootEl = document.getElementById(TOOLTIP_ID)
        if (!rootEl) { return }
        const className = `dict_${dictId}`
        return rootEl.getElementsByClassName(className).item(0)! as HTMLElement
    }
    public async openTooltipForQuery(posEl: Element | VirtualElement, queryWord: string) {
        this.clearResult()
        this.createTooltipElement(posEl)
        this.fetchWeblio(queryWord).then(arr => {
            const mountPoint = this.getDictElemInTooltip('weblio')
            if (!mountPoint) { return }
            for (const section of arr) {
                const header = document.createElement('h6')
                header.innerText = section.source.bookName
                mountPoint.append(header)
                mountPoint.append(section.sectionElement)
                mountPoint.append(document.createElement('hr'))
            }
            if (this.instance) {
                this.instance.forceUpdate()
            } else {
                console.warn('not found popper instance')
            }
        })
        this.fetchGoo(queryWord).then(arr => {
            const mountPoint = this.getDictElemInTooltip('goo')
            if (!mountPoint) { return }
            for (const section of arr) {
                mountPoint.append(section.sectionElement)
                mountPoint.append(document.createElement('hr'))
            }
            if (this.instance) {
                this.instance.forceUpdate()
            } else {
                console.warn('not found popper instance')
            }
        })
    }
    private async fetchWeblio(queryWord: string): Promise<DefinitionSection[]> {
        const q = encodeURI(queryWord)
        const wordUrl = `https://www.weblio.jp/content/${q}`
        const res = await safeFetchHtml(wordUrl)
        if (!res.ok) { return [] }
        const html: string = res.d
        const dom = this.parseDom(html)
        const nodes = dom.querySelectorAll('.kijiWrp')
        console.log('fetched nodes', nodes)
        const sectionList: DefinitionSection[] = []
        nodes.forEach((el) => {
            const headerEl = selectNearestPreviousElementSibling(el, 'pbarT')
            if (!headerEl) { return }
            const a = headerEl.querySelector('.pbarTL a') as HTMLLinkElement
            sectionList.push({
                source: {
                    wordLink: wordUrl,
                    bookName: a.innerText,
                    bookLink: a.href
                },
                sectionElement: el
            })
        })
        return sectionList
    }
    private async fetchGoo(queryWord: string): Promise<DefinitionSection[]> {
        const q = encodeURI(queryWord)
        const wordUrl = `https://dictionary.goo.ne.jp/word/${q}`
        const res = await safeFetchHtml(wordUrl)
        if (!res.ok) { return [] }
        const html: string = res.d
        const dom = this.parseDom(html)
        const titleEl = dom.querySelector('.basic_title')
        if (!titleEl) { return [] }
        const meanEl = dom.querySelector('.meaning_area')
        if (!meanEl) { return [] }
        const relatedWordsEl = dom.querySelector('.related_words_box')
        const mergedEl = document.createElement('div')
        mergedEl.append(meanEl)
        if (relatedWordsEl) {
            mergedEl.append(relatedWordsEl)
        }
        const sectionList: DefinitionSection[] = []
        sectionList.push({
            source: {
                wordLink: wordUrl,
                bookName: titleEl.textContent || 'Unknown Dictionary',
                bookLink: ''
            },
            sectionElement: mergedEl
        })
        return sectionList
    }
}

const dictMan = new DictManager()

function selectNearestPreviousElementSibling(el: Element, className: string): Element | null {
    let ref = el.previousElementSibling
    while (ref) {
        if (ref.className.includes(className)) {
            return ref
        }
        ref = ref.previousElementSibling
    }
    return ref
}

initSelectionEventHandler()