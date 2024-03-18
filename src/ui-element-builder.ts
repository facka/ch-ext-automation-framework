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

let document: Document

const setDocument = (doc: Document) => {
  document = doc
}

const SelectorBuilder = (query: string, filterFn?: (value: HTMLElement, index: number, array: readonly HTMLElement[]) => Boolean) => {
  const selector = (root = document, postProcess?: (elem: HTMLElement) => HTMLElement) => {
    root = root || document
    console.log('Searching elem from Root = ', root)
    const elementsFound: HTMLElement[] = []
    root.querySelectorAll<HTMLElement>(query).forEach((e: HTMLElement) => {
      if (e.style.display !== 'none' ) {
        elementsFound.push(e)
      }
    })
    let elemFound
    if (filterFn) {
      console.log('Applying filter ', filterFn)
      console.log('  -- to ' + elementsFound.length + 'elements')
      elemFound = elementsFound.filter(filterFn)[0]
    } else {
      elemFound = elementsFound[0]
    }
    if (elemFound && postProcess) {
      console.log('Apply post process to = ', elemFound)
      elemFound = postProcess(elemFound)
    }
    console.log('Return elem = ', elemFound)
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
  ...selectorIdentifier(selector, parent),
  /**
   * Tansform the UI element that will be returned
   * @param postProcessFn 
   * @returns 
   */
  postProcess: (postProcessFn: (elem: HTMLElement) => (HTMLElement | null)) => ({
    ...selectorIdentifier(selector, parent, postProcessFn)
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

const identifiedBy = (id: string) => {
  return selectorFilterResponse(SelectorBuilder('#'+id))
}

const ELEMENT = (htmlTag: string) => {
  return selectorFilter(htmlTag)
}

const classIs = (className: string) => {
  return (elem: HTMLElement) => elem.className == className
}

const classIncludes = (className: string) => {
  return (elem: HTMLElement) => elem.className.split(' ').includes(className)
}

const innerTextIs = (text: string) => {
  return (elem: HTMLElement) => {
    return elem.textContent?.trim() == text
  }
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

const and = (conditions: any[]) => {
  return (elem: HTMLElement, elemIndex: number) => {
    let response = true
    let i = 0
    while (response && i < conditions.length) {
      response = response && conditions[i](elem, elemIndex)
      i++
    }
    return response
  }
}

const is = {
  DIV,
  BUTTON,
  INPUT,
  TEXTAREA,
  ELEMENT,
  identifiedBy,
}

export {
  setDocument,
  UIElement,
  SelectorBuilder,
  is,
  classIs,
  classIncludes,
  innerTextIs,
  innerTextContains,
  titleIs,
  placeholderIs,
  isFirstElement,
  elementIndexIs,
  firstChildTextIs,
  and
}