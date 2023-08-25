import { UIElement } from './ui-utils'

const SelectorBuilder = (query: string, filterFn?: (value: HTMLElement, index: number, array: readonly HTMLElement[]) => Boolean) => {
  const selector = (root = document, postProcess?: (elem: HTMLElement) => HTMLElement) => {
    root = root || document
    const elementsFound: HTMLElement[] = []
    root.querySelectorAll(query).forEach((e: Element) => {
      elementsFound.push(e as HTMLElement)
    })
    let elemFound
    if (filterFn) {
      elemFound = elementsFound.filter(filterFn)[0]
    } else {
      elemFound = elementsFound[0]
    }
    if (postProcess) {
      elemFound = postProcess(elemFound)
    }
    return elemFound
  }
  return selector
}

const selectorIdentifier = (selector: any, parent: UIElement | null, postProcessFn?: (elem: HTMLElement) => (HTMLElement | null)) => ({
  /**
   * Sets the UI element identifier
   * @param uiElementId 
   * @returns 
   */
  as: (uiElementId: string) => {
    return new UIElement(uiElementId, selector, parent, postProcessFn)
  }
})

const postProcessResponse = (selector: any, parent: UIElement | null) => ({
  ...selectorIdentifier(selector, null),
  /**
   * Tansform the UI element that will be returned
   * @param postProcessFn 
   * @returns 
   */
  postProcess: (postProcessFn: (elem: HTMLElement) => (HTMLElement | null)) => ({
    ...selectorIdentifier(selector, null, postProcessFn)
  })
})

const selectorFilterResponse = (selector: any) => ({
  ...selectorIdentifier(selector, null),
  childOf: (parent: UIElement) => ({
    ...postProcessResponse(selector, parent)
  }),
  /**
   * Tansform the UI element that will be returned
   * @param postProcessFn 
   * @returns 
   */
  postProcess: (postProcessFn: (elem: HTMLElement) => (HTMLElement | null)) => ({
    ...selectorIdentifier(selector, null, postProcessFn)
  })
})

const selectorFilter = (query: string) => {
  return {
    where: (filterFn?: (value: HTMLElement, index: number, array: readonly HTMLElement[]) => Boolean) => {
      return selectorFilterResponse(SelectorBuilder(query, filterFn))
    }
  }
}

const DIV = selectorFilter('div')

const BUTTON = selectorFilter('button')

const INPUT = selectorFilter('input')

const TEXTAREA = selectorFilter('textarea')

const ELEMENT = (htmlTag: string) => {
  return selectorFilter(htmlTag)
}

const classIs = (className: string) => {
  return (elem: HTMLElement) => elem.className == className
}

const innerTextIs = (text: string) => {
  return (elem: HTMLElement) => elem.innerText.trim() == text
}

const innerTextContains = (text: string) => {
  return (elem: HTMLElement) => elem.innerText.trim().includes(text)
}

const titleIs = (text: string) => {
  return (elem: HTMLElement) => elem.title == text
}

const placeholderIs = (text: string) => {
  return (elem: HTMLElement) => (elem as HTMLInputElement).placeholder === text
}

const isFirstElement = () => {
  return (elem: HTMLElement, index: number) => index === 0
}

const elementIndexIs = (index: number) => {
  return (elem: HTMLElement, elemIndex: number) => elemIndex === index
}

const firstChildTextIs = (text: string) => {
  return (elem: HTMLElement) => (elem?.firstChild as HTMLInputElement).innerText.trim() === text
}

const is = {
  DIV,
  BUTTON,
  INPUT,
  TEXTAREA,
  ELEMENT,
}

export {
  SelectorBuilder,
  is,
  classIs,
  innerTextIs,
  innerTextContains,
  titleIs,
  placeholderIs,
  isFirstElement,
  elementIndexIs,
  firstChildTextIs
}