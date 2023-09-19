class UIElement {
  name: string
  selector: (parent?: HTMLElement | null,  postProcessFn?: (elem: HTMLElement) => (HTMLElement | null)) => HTMLElement | null
  parent: UIElement | null
  postProcess?: ((elem: HTMLElement) => (HTMLElement | null))

  constructor (name: string, selector: () => HTMLElement | null, parent?: UIElement | null, postProcessFn?: (elem: HTMLElement) => (HTMLElement | null)) {
    this.name = name
    this.selector = selector
    this.parent = parent || null
    this.postProcess = postProcessFn
  }

  getElementName (): string {
    let parent = ''
    if (this.parent) {
      parent = ' in ' + this.parent.getElementName()
    }
    return `${this.name}${parent}`
  }
}

const wait = (timeout = 2000) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(null)
    }, timeout)
  })
}

const updateStyle = (elem: HTMLElement, props: any) => {
  const propsList = Object.entries(props).map(([key, value]) => ({
    key,
    value
  }))
  propsList.forEach((styleItem: any) => {
    const {key, value} = styleItem
    elem.style[key] = value
  })
}

const devToolsMessageContainer = document.createElement('DIV')
const body = document.body
devToolsMessageContainer.id = 'dev-tools-message-container'
devToolsMessageContainer.style.width = '500px'
devToolsMessageContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
devToolsMessageContainer.style.color = 'white'
// devToolsMessageContainer.style.border = '1px solid black'
// devToolsMessageContainer.style['border-radius'] = '5px'
devToolsMessageContainer.style.position = 'fixed'
devToolsMessageContainer.style.bottom = '10px'
devToolsMessageContainer.style.right = '10px'
devToolsMessageContainer.style.fontFamily = 'monospace'
devToolsMessageContainer.style.zIndex = '9999'
body.appendChild(devToolsMessageContainer)

/**
 * 
 * @param message @deprecated
 */
const logAction = async (message: string) => {
  const messageElem = document.createElement('DIV')
  messageElem.innerText = message
  messageElem.style.padding = '3px 10px'
  messageElem.style.opacity = '1'
  messageElem.style.transition = 'opacity 1s'
  devToolsMessageContainer.appendChild(messageElem)
  setTimeout(() => {
    messageElem.style.opacity = '0'
  }, 4000)
  setTimeout(() => {
    devToolsMessageContainer.removeChild(messageElem)
  }, 5000)
  await wait(1000)
}

const devToolsCheckElementContainer = document.createElement('DIV')
devToolsCheckElementContainer.id = 'dev-tools-check-element-container'
devToolsCheckElementContainer.style.width = '100%'
devToolsCheckElementContainer.style.height = document.body.clientHeight+'px'
devToolsCheckElementContainer.style.position = 'absolute'
devToolsCheckElementContainer.style.top = '0px'
devToolsCheckElementContainer.style.left = '0px'
devToolsCheckElementContainer.style.zIndex = '9990'
devToolsCheckElementContainer.style.display = 'none'
devToolsCheckElementContainer.style.opacity = '0'
devToolsCheckElementContainer.style.transition = 'opacity .5s'
body.appendChild(devToolsCheckElementContainer)

const createDarkLayerElement = () => {
  const elem = document.createElement('DIV')
  elem.style.zIndex = '9991'
  elem.style.backgroundColor = 'rgba(0,0,0,0.3)'
  elem.style.position = 'absolute'
  devToolsCheckElementContainer.appendChild(elem)
  return elem
}

const darkLayerLeft = createDarkLayerElement()
const darkLayerTop = createDarkLayerElement()
const darkLayerRight = createDarkLayerElement()
const darkLayerBottom = createDarkLayerElement()
const currentCheckElem = document.createElement('DIV')
devToolsCheckElementContainer.appendChild(currentCheckElem)

const checkElement = async (elem: HTMLElement, name: string) => {
  if (!elem) return
  const rect = elem.getBoundingClientRect()

  darkLayerLeft.style.left = '0px'
  darkLayerLeft.style.top = rect.top+'px'
  darkLayerLeft.style.width = (window.scrollX+rect.left)+'px'
  darkLayerLeft.style.height = rect.height+'px'

  const bodyBundingRect = body.getBoundingClientRect()

  darkLayerTop.style.left = window.scrollX+'px'
  darkLayerTop.style.top = '0px'
  darkLayerTop.style.width = '100%'
  darkLayerTop.style.height = (rect.top)+'px'

  darkLayerRight.style.left = (window.scrollX+rect.left+rect.width)+'px'
  darkLayerRight.style.top = rect.top+'px'
  darkLayerRight.style.width = (bodyBundingRect.width - (rect.left + rect.width))+'px'
  darkLayerRight.style.height = rect.height+'px'

  darkLayerBottom.style.left = window.scrollX+'px'
  darkLayerBottom.style.top = (rect.top+rect.height)+'px'
  darkLayerBottom.style.width = '100%'
  darkLayerBottom.style.height = (bodyBundingRect.height - (rect.top + rect.height))+'px'

  currentCheckElem.id = `dev-tools-current-check-elem-${name}`
  currentCheckElem.style.top = rect.top+'px'
  currentCheckElem.style.left = (window.scrollX+rect.left)+'px'
  currentCheckElem.style.height = rect.height+'px'
  currentCheckElem.style.width = rect.width+'px'
  currentCheckElem.style.boxShadow = '0px 0px 5px 2px lightgreen'
  currentCheckElem.style.position = 'absolute'
  currentCheckElem.style.zIndex = '9992'
  
  devToolsCheckElementContainer.style.display = 'block'
  devToolsCheckElementContainer.style.opacity = '1'
  await wait(500)
}

const hideCheckElementContainer = async () => {
  devToolsCheckElementContainer.style.opacity = '0'
  await wait(500)
  devToolsCheckElementContainer.style.display = 'none'
}

const contextViewerContainer = document.createElement('DIV')
contextViewerContainer.id = 'context-viewer-container'
updateStyle(contextViewerContainer, {
  width: '100%',
  height: document.body.clientHeight+'px',
  position: 'absolute',
  top: '0px',
  left: '0px',
  zIndex: '10000',
  display: 'none',
})
body.appendChild(contextViewerContainer)

const setInputValues = (html: HTMLElement, valuesMap: any) => {
  html.querySelectorAll('input').forEach((input: HTMLInputElement) => {
    const id = input.getAttribute('input-id') || ''
    input.value = valuesMap[id]
  })
}

const displayContext = (context: any) => {
  updateStyle(contextViewerContainer, {display: 'flex'})
  const contextViewerBefore = document.createElement('DIV')
  contextViewerBefore.id = 'context-viewer-before'
  updateStyle(contextViewerBefore, {
    flex: '50%',
    width: '100%',
    height: 'auto',
  })
  const contextViewerAfter = document.createElement('DIV')
  contextViewerAfter.id = 'context-viewer-after'
  updateStyle(contextViewerAfter, {
    flex: '50%',
    width: '100%',
    height: 'auto',
  })
  const beforeHTML = document.createElement('DIV')
  beforeHTML.innerHTML = context.beforeHTML
  setInputValues(beforeHTML, context.beforeInputValues)
  const afterHTML = document.createElement('DIV')
  afterHTML.innerHTML = context.afterHTML
  setInputValues(afterHTML, context.afterInputValues)
  contextViewerContainer.appendChild(contextViewerBefore)
  contextViewerBefore.appendChild(beforeHTML)
  setTimeout(() => {
    contextViewerContainer.removeChild(contextViewerBefore)
    contextViewerContainer.appendChild(contextViewerAfter)
    contextViewerAfter.appendChild(afterHTML)
    setTimeout(() => {
      contextViewerContainer.removeChild(contextViewerAfter)
      updateStyle(contextViewerContainer, {display: 'none'})
    }, 2000)
  }, 2000)
}

export {
  wait,
  logAction,
  UIElement,
  checkElement,
  hideCheckElementContainer,
  displayContext,
}
