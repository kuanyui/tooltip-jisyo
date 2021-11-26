import { TypedMsg, storageManager, safeFetchHtml, dict_t, createDebounceFunction, REGEXP_LATIN } from "./common"
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
    /** Should not include book name */
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

type dict_mount_element_class_t = `dict_${dict_t}`

class DictManager  {
    domParser: DOMParser = new window.DOMParser()
    instance: Instance | undefined
    private parseDom(docUrl: string, html: string): Document {
        const u = new URL(docUrl)
        const domain = u.origin
        const doc = this.domParser.parseFromString(html, 'text/html')
        var base = doc.createElement('base')
        base.href = domain
        doc.head.appendChild(base)
        // console.log('DOM.URL', doc.URL)
        doc.querySelectorAll('a').forEach(a => {
            a.setAttribute('target', '_blank')  // Force open with new tab
            const rawHref = a.getAttribute('href')
            // console.log('RAW HREF ===', rawHref)
            if (!rawHref) { return }
            if (rawHref.startsWith('/') && !rawHref.startsWith('//')) {
                a.href = domain + rawHref
            }
        })
        if (docUrl.includes('weblio')) {
            console.log('document.body =', doc.body)
        }
        return doc
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
        popperEl.append(scrollArea)
        popperEl.append(arrowEl)
        const allClass: dict_mount_element_class_t[] = ['dict_goo_jj', 'dict_weblio_jj', 'dict_weblio_ejje', 'dict_weblio_cjjc']
        for (const className of allClass) {
            const dictEl = document.createElement('div')
            dictEl.className = className
            scrollArea.append(dictEl)
        }
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
        el = this.getDictElemInTooltip('goo_jj')
        if (el) { el.innerText = '' }
        el = this.getDictElemInTooltip('weblio_jj')
        if (el) { el.innerText = '' }
        el = this.getDictElemInTooltip('weblio_cjjc')
        if (el) { el.innerText = '' }
        el = this.getDictElemInTooltip('weblio_ejje')
        if (el) { el.innerText = '' }
    }
    private getDictElemInTooltip(dictId: dict_t): HTMLElement | undefined {
        const rootEl = document.getElementById(TOOLTIP_ID)
        if (!rootEl) { return }
        const className: dict_mount_element_class_t = `dict_${dictId}`
        return rootEl.getElementsByClassName(className).item(0)! as HTMLElement
    }
    private genWordRef(section: DefinitionSection): HTMLElement {
        const h = document.createElement('h5')
        h.innerText = section.source.bookName
        const a = document.createElement('a')
        a.innerText = '[参照]'
        a.href = section.source.wordLink
        a.style.float = 'right'
        h.append(a)
        return h
    }
    public async openTooltipForQuery(posEl: Element | VirtualElement, queryWord: string) {
        this.clearResult()
        this.createTooltipElement(posEl)
        if (queryWord.match(REGEXP_LATIN)) {
            this.fetchEnglish(queryWord)
        } else {
            this.fetchEnglish(queryWord)
            this.fetchJapanese(queryWord)
        }
    }
    private async fetchEnglish(queryWord: string) {
        this.fetchWeblioEJJE(queryWord).then(arr => {
            console.log('[result][weblio] sections ===', arr)
            const mountPoint = this.getDictElemInTooltip('weblio_ejje')
            if (!mountPoint) { return }
            for (const section of arr) {
                mountPoint.append(this.genWordRef(section))
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
    private async fetchJapanese(queryWord: string) {
        this.fetchWeblioJJ(queryWord).then(arr => {
            console.log('[result][weblio] sections ===', arr)
            const mountPoint = this.getDictElemInTooltip('weblio_jj')
            if (!mountPoint) { return }
            for (const section of arr) {
                mountPoint.append(this.genWordRef(section))
                mountPoint.append(section.sectionElement)
                mountPoint.append(document.createElement('hr'))
            }
            if (this.instance) {
                this.instance.forceUpdate()
            } else {
                console.warn('not found popper instance')
            }
        })
        this.fetchWeblioCJJC(queryWord).then(arr => {
            console.log('[result][weblio] sections ===', arr)
            const mountPoint = this.getDictElemInTooltip('weblio_cjjc')
            if (!mountPoint) { return }
            for (const section of arr) {
                mountPoint.append(this.genWordRef(section))
                mountPoint.append(section.sectionElement)
                mountPoint.append(document.createElement('hr'))
            }
            if (this.instance) {
                this.instance.forceUpdate()
            } else {
                console.warn('not found popper instance')
            }
        })
        this.fetchGooJJ(queryWord).then(arr => {
            console.log('[result][goo] sections ===', arr)
            const mountPoint = this.getDictElemInTooltip('goo_jj')
            if (!mountPoint) { return }
            for (const section of arr) {
                mountPoint.append(this.genWordRef(section))
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
    private async fetchWeblioJJ(queryWord: string): Promise<DefinitionSection[]> {
        // NOTE: It seems under Android, fetch() + User-Agent headers doesn't work.
        // But on desktop Firefox, User-Agent header works.
        // So decide to support Weblio of both mobile and desktop versions.
        const q = encodeURI(queryWord)
        const wordUrl = `https://www.weblio.jp/content/${q}`
        const res = await safeFetchHtml(wordUrl)
        if (!res.ok) { return [] }
        const html: string = res.d
        const dom = this.parseDom(wordUrl, html)
        const sectionList: DefinitionSection[] = []
        dom.querySelectorAll('.Wkpja script').forEach(e => e.remove())
        dom.querySelectorAll('.Wkpja .footNote').forEach(e => e.remove())
        dom.querySelectorAll('.Wkpja .footNoteB').forEach(e => e.remove())
        dom.querySelectorAll('.Wkpja table.navbox').forEach(e => e.remove())
        dom.querySelectorAll('.Wkpja .wikiBCts').forEach(e => e.remove())
        dom.querySelectorAll('.Wkpja br + br').forEach(x=>x.remove())
        let nodes = dom.querySelectorAll('.kijiWrp')  // desktop version
        if (nodes.length) {
            console.log('[weblio] (desktop) fetched nodes', nodes)
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
        nodes = dom.querySelectorAll('.division2')   // mobile version
        if (nodes.length) {
            console.log('[weblio] (mobile) fetched nodes', nodes)
            nodes.forEach((el) => {
                const oriHeaderEl = el.querySelector('.ttlArea h2') as HTMLElement | null
                if (!oriHeaderEl) { return }
                const bookName = oriHeaderEl.innerText.replaceAll('\n', '')
                const bookLinkEl = el.querySelector('.ttlArea .lgDict') as HTMLLinkElement | null
                if (!bookLinkEl) { return }
                const bookLink = bookLinkEl.href
                const sectionEl = el.querySelector('.subDivision')
                if (!sectionEl) { return }
                sectionEl.querySelectorAll('h3').forEach((oriH) => {
                    const h2 = document.createElement('h2')
                    h2.innerText = oriH.innerText
                    oriH.after(h2)
                    oriH.remove()
                })
                sectionList.push({
                    source: {
                        wordLink: wordUrl,
                        bookName: bookName,
                        bookLink: bookLink,
                    },
                    sectionElement: sectionEl
                })
            })
            return sectionList
        }
        console.log('[weblio_jj] not found any nodes...')
        return sectionList
    }
    private async fetchWeblioEJJE(queryWord: string): Promise<DefinitionSection[]> {
        // NOTE: It seems under Android, fetch() + User-Agent headers doesn't work.
        // But on desktop Firefox, User-Agent header works.
        // So decide to implement mobile version only.
        const q = encodeURI(queryWord)
        const wordUrl = `https://ejje.weblio.jp/content/${q}`
        const res = await safeFetchHtml(wordUrl)
        if (!res.ok) { return [] }
        const html: string = res.d
        const dom = this.parseDom(wordUrl, html)
        const sectionList: DefinitionSection[] = []
        let nodes = dom.querySelectorAll('.kijiWrp')  // desktop version
        nodes = dom.querySelectorAll('.division2')   // mobile version
        if (nodes.length) {
            console.log('[weblio_ejje] (mobile) fetched nodes', nodes)
            nodes.forEach((el) => {
                const oriHeaderEl = el.querySelector('.ttlArea h2') as HTMLElement | null
                if (!oriHeaderEl) { return }
                const bookName = oriHeaderEl.innerText.replaceAll('\n', '')
                const bookLink = wordUrl
                const sectionEl = el.querySelector('.subDivision')
                if (!sectionEl) { return }
                sectionEl.querySelectorAll('h3').forEach((oriH) => {
                    const h2 = document.createElement('h2')
                    h2.innerText = oriH.innerText
                    oriH.after(h2)
                    oriH.remove()
                })
                sectionList.push({
                    source: {
                        wordLink: wordUrl,
                        bookName: bookName,
                        bookLink: bookLink,
                    },
                    sectionElement: sectionEl
                })
            })
            return sectionList
        }
        console.log('[weblio_ejje] not found any nodes...')
        return sectionList
    }
    private async fetchWeblioCJJC(queryWord: string): Promise<DefinitionSection[]> {
        // NOTE: It seems under Android, fetch() + User-Agent headers doesn't work.
        // But on desktop Firefox, User-Agent header works.
        // So decide to implement mobile version only.
        const q = encodeURI(queryWord)
        const wordUrl = `https://cjjc.weblio.jp/content/${q}`
        const res = await safeFetchHtml(wordUrl)
        if (!res.ok) { return [] }
        const html: string = res.d
        const dom = this.parseDom(wordUrl, html)
        const sectionList: DefinitionSection[] = []
        let nodes = dom.querySelectorAll('.kijiWrp')  // desktop version
        nodes = dom.querySelectorAll('.division2')   // mobile version
        if (nodes.length) {
            console.log('[weblio] (mobile) fetched nodes', nodes)
            nodes.forEach((el) => {
                const headerEl = el.querySelector('.ttlArea h2') as HTMLElement | null
                if (!headerEl) { return }
                const bookName = headerEl.innerText.replaceAll('\n', '')
                if (bookName === '白水社 中国語辞典') { return }
                const bookLinkEl = el.querySelector('.ttlArea .lgDict') as HTMLLinkElement | null
                if (!bookLinkEl) { return }
                const bookLink = bookLinkEl.href
                const sectionEl = el.querySelector('.subDivision')
                if (!sectionEl) { return }
                sectionEl.querySelectorAll('h3').forEach((oriH) => {
                    const h2 = document.createElement('h2')
                    h2.innerText = oriH.innerText
                    oriH.after(h2)
                    oriH.remove()
                })
                sectionList.push({
                    source: {
                        wordLink: wordUrl,
                        bookName: bookName,
                        bookLink: bookLink,
                    },
                    sectionElement: sectionEl
                })
            })
            return sectionList
        }
        console.log('[weblio] not found any nodes...')
        return sectionList
    }
    private async fetchGooJJ(queryWord: string): Promise<DefinitionSection[]> {
        const q = encodeURI(queryWord)
        const wordUrl = `https://dictionary.goo.ne.jp/word/${q}`
        const res = await safeFetchHtml(wordUrl)
        if (!res.ok) { return [] }
        const html: string = res.d
        const dom = this.parseDom(wordUrl, html)
        const titleEl = dom.querySelector('.basic_title h1') as HTMLElement
        if (!titleEl) { return [] }
        titleEl.querySelectorAll('.meaning').forEach(el => el.remove())
        const meanEl = dom.querySelector('.meaning_area')
        if (!meanEl) { return [] }
        const relatedWordsEl = dom.querySelector('.related_words_box')
        const mergedEl = document.createElement('div')
        const h2 = document.createElement('h2')
        h2.innerText = titleEl.innerText.replaceAll('\n', '')
        mergedEl.append(h2)
        mergedEl.append(meanEl)
        if (relatedWordsEl) {
            mergedEl.append(relatedWordsEl)
        }
        const sectionList: DefinitionSection[] = []
        sectionList.push({
            source: {
                wordLink: wordUrl,
                bookName: 'goo 辞書',
                bookLink: wordUrl
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
