import { AutomationEvents, EVENT_NAMES } from "./automation";
import { UIElement, waitForElement, checkElement, hideCheckElementContainer, wait } from "./ui-utils"
import {v4 as uuidv4} from 'uuid';


interface ActionContext {
  url: string,
  beforeHTML: string,
  beforeInputValues: Object,
  afterHTML: string,
  afterInputValues: Object,
  startTimestamp: string,
  endTimestamp: string
}

abstract class AbstractAction {
  status: string
  error: string
  id: string
  context: ActionContext

  constructor () {
    this.status = 'waiting'
    this.error = ''
    this.id = uuidv4()
    this.context = {
      beforeHTML: '',
      beforeInputValues: {},
      afterInputValues: {},
      afterHTML: '',
      url: '',
      startTimestamp: '',
      endTimestamp: ''
    }
  }

  abstract getDescription() : string

  abstract getJSON() : Object

  protected abstract executeAction() : Promise<any>
  protected abstract resetAction() : void

  reset () {
    this.status = 'waiting'
    this.error = ''
    this.resetAction()
  }

  private getInputValuesFromPage() {
    const inputsMap: any = {}
    const inputs = document.querySelectorAll('input')
    inputs.forEach((input, index) => {
      const id = `value-id-${index}`
      input.setAttribute('input-id', id);
      inputsMap[id] = input.value
    })
    return inputsMap
  } 

  async execute () {
    try {
      this.status = 'running'
      this.context.beforeInputValues = this.getInputValuesFromPage()
      this.context.beforeHTML = document.body.innerHTML
      await this.notifyActionUpdated()
      await this.executeAction()
      this.status = 'success'
      this.error = ''
    } catch (e: any) {
      this.status = 'error'
      this.error = e.message
      throw new Error('Error in Action ' + this.getDescription() + '. Message: ' + e.message)
    } finally {
      this.context.afterInputValues = this.getInputValuesFromPage()
      this.context.afterHTML = document.body.innerHTML
      await this.notifyActionUpdated()
    }
  }

  async notifyActionUpdated () {
    AutomationEvents.dispatch(EVENT_NAMES.ACTION_UPDATE, {
      action: this.getJSON(),
    })
  }
}

class Action extends AbstractAction {
  name: string
  stepsFn: (params?: any) => void
  steps: Array<AbstractAction>
  params: any
  index: number

  constructor (name: string, steps: (params?: any) => void) {
    super()
    this.name = name
    this.stepsFn = steps
    this.steps = []
    this.index = 0
  }

  getDescription () {
    return this.name
  }

  compileSteps () {
    super.reset()
    this.stepsFn(this.params)
  }

  stepsToJSON () {
    return this.steps.reduce((acc: Array<Object>, curr: AbstractAction) => {
      acc.push(curr.getJSON())
      return acc
    }, [])
  }

  getJSON () {
    return {
      id: this.id,
      type: 'Action',
      description: this.getDescription(),
      params: this.params,
      steps: this.stepsToJSON(),
      context: this.context,
      status: this.status,
      error: this.error
    }
  }

  resetAction () {
    this.steps.length = 0
    this.index = 0
  }

  async continue () {
    if (this.index < this.steps.length) {
      const action = this.steps[this.index]
      try {
        await wait(1000)
        await action.execute()
        this.index++
      } catch (e) {
        throw e
      }
      await this.continue()
    }
  }

  async executeAction () {
    this.index = 0
    await this.continue()
  }

  setParams (params?: any) {
    this.params = params
  }

  addStep (action: AbstractAction) {
    this.steps.push(action)
  }

}

abstract class ActionOnElement extends AbstractAction {
  uiElement: UIElement
  element: HTMLElement | null

  constructor (uiElement: UIElement) {
    super()
    this.uiElement = uiElement
    this.element = null
  }

  getElementName () {
    return this.uiElement.getElementName()
  }

  protected abstract executeActionOnElement() : void

  async executeAction () {
    try {
      this.element = await waitForElement(this.uiElement) as HTMLElement
      this.element?.setAttribute("test-id", this.getElementName());
      await checkElement(this.element, this.getElementName())
      this.executeActionOnElement()
      await hideCheckElementContainer()
    } catch (e: any) {
      throw new Error(e.message)
    }
  }

  resetAction () {
    this.element = null
  }

}

class ClickAction extends ActionOnElement {

  constructor (uiElement: UIElement) {
    super(uiElement)
  }

  protected executeActionOnElement () {
    return this.element?.click()
  }

  getDescription () {
    return 'Click in ' + this.getElementName()
  }

  getJSON () {
    return {
      id: this.id,
      element: this.getElementName(),
      type: 'Click',
      description: this.getDescription(),
      status: this.status,
      error: this.error,
      context: this.context,
    }
  }
}

class AssertTextIsAction extends ActionOnElement {
  text: string

  constructor (uiElement: UIElement, text: string) {
    super(uiElement)
    this.text = text
  }

  protected executeActionOnElement () {
    const textIsEqual = this.element?.innerText === this.text
    if (!textIsEqual) {
      throw new Error(`Text in element ${this.getElementName()} is not '${this.text}'`)
    }
  }

  getDescription () {
    return `Assert that text in ${this.getElementName()} is '${this.text}'`
  }

  getJSON () {
    return {
      id: this.id,
      element: this.getElementName(),
      type: 'AssertTextIsAction',
      value: this.text,
      description: this.getDescription(),
      status: this.status,
      error: this.error,
      context: this.context,
    }
  }
}

class AssertContainsTextAction extends ActionOnElement {
  text: string

  constructor (uiElement: UIElement, text: string) {
    super(uiElement)
    this.text = text
  }

  protected executeActionOnElement () {
    const containsText = this.element?.innerText.includes(this.text)
    if (!containsText) {
      throw new Error(`Text in element ${this.getElementName()} doesn't contain '${this.text}'`)
    }
  }

  getDescription () {
    return `Assert that ${this.getElementName()} contains '${this.text}'`
  }

  getJSON () {
    return {
      id: this.id,
      element: this.getElementName(),
      type: 'AssertContainsText',
      value: this.text,
      description: this.getDescription(),
      status: this.status,
      error: this.error,
      context: this.context,
    }
  }
}

class AssertValueIsAction extends ActionOnElement {
  value: string | boolean | number | Date

  constructor (uiElement: UIElement, value: string | boolean | number | Date) {
    super(uiElement)
    this.value = value
  }

  protected executeActionOnElement () {
    const valueIsEqual = (this.element as HTMLInputElement).value === this.value
    if (!valueIsEqual) {
      throw new Error(`Value in element ${this.getElementName()} is not '${this.value}'`)
    }
  }

  getDescription () {
    return `Assert that value in ${this.getElementName()} is '${this.value}'`
  }

  getJSON () {
    return {
      id: this.id,
      element: this.getElementName(),
      type: 'AssertValueIsAction',
      value: this.value,
      description: this.getDescription(),
      status: this.status,
      error: this.error,
      context: this.context,
    }
  }
}

class AssertExistsAction extends ActionOnElement {

  constructor (uiElement: UIElement) {
    super(uiElement)
  }

  protected executeActionOnElement () {
    const exists = !!this.element
    if (!exists) {
      throw new Error(`Element ${this.getElementName()} doesn't exist`)
    }
  }

  getDescription () {
    return `Assert that ${this.getElementName()} exists`
  }

  getJSON () {
    return {
      id: this.id,
      element: this.getElementName(),
      type: 'AssertExistsAction',
      description: this.getDescription(),
      status: this.status,
      error: this.error,
      context: this.context,
    }
  }
}

class SelectAction extends ActionOnElement {
  value: string

  constructor (uiElement: UIElement, value: string) {
    super(uiElement)
    this.value = value
  }

  protected executeActionOnElement () {
    let inputElem = this.element as HTMLInputElement
    if (this.element?.tagName !== 'INPUT' && this.element?.tagName !== 'SELECT' && this.element?.tagName !== 'TEXTAREA') {
      inputElem = this.element?.querySelectorAll('input')[0] as HTMLInputElement
      if (!inputElem) {
        throw new Error('Input element not found. Not able to type value in element ' + this.getElementName())
      }
    } // allows to type in wrapper elements which contain input elem
    inputElem.value = this.value
    inputElem.dispatchEvent(new Event('change'));
  }

  getDescription () {
    return `Select value '${this.value}' in ${this.getElementName()}`
  }

  getJSON () {
    return {
      id: this.id,
      element: this.getElementName(),
      type: 'Select',
      value: this.value,
      description: this.getDescription(),
      status: this.status,
      error: this.error,
      context: this.context,
    }
  }
}

class TypeAction extends ActionOnElement {
  value: string

  constructor (uiElement: UIElement, value: string) {
    super(uiElement)
    this.value = value
  }

  protected executeActionOnElement () {
    let inputElem = this.element as HTMLInputElement
    if (this.element?.tagName !== 'INPUT' && this.element?.tagName !== 'SELECT' && this.element?.tagName !== 'TEXTAREA') {
      inputElem = this.element?.querySelectorAll('input')[0] as HTMLInputElement
      if (!inputElem) {
        throw new Error('Input element not found. Not able to type value in element ' + this.getElementName())
      }
    } // allows to type in wrapper elements which contain input elem
    inputElem.value = this.value
    inputElem.dispatchEvent(new Event('change'));
    inputElem.dispatchEvent(new Event('keyup'));
  }

  getDescription () {
    return `Type value '${this.value}' in ${this.getElementName()}`
  }

  getJSON () {
    return {
      id: this.id,
      element: this.getElementName(),
      type: 'Type',
      value: this.value,
      description: this.getDescription(),
      status: this.status,
      error: this.error,
      context: this.context,
    }
  }
}

class TypePasswordAction extends ActionOnElement {
  value: string

  constructor (uiElement: UIElement, value: string) {
    super(uiElement)
    this.value = value
  }

  protected executeActionOnElement () {
    let inputElem = this.element as HTMLInputElement
    if (this.element?.tagName !== 'INPUT' && this.element?.tagName !== 'SELECT' && this.element?.tagName !== 'TEXTAREA') {
      inputElem = this.element?.querySelectorAll('input')[0] as HTMLInputElement
      if (!inputElem) {
        throw new Error('Input element not found. Not able to type value in element ' + this.getElementName())
      }
    } // allows to type in wrapper elements which contain input elem
    inputElem.value = this.value
    inputElem.dispatchEvent(new Event('change'));
  }

  getDescription () {
    return `Type a password in ${this.getElementName()}`
  }

  getJSON () {
    return {
      id: this.id,
      element: this.getElementName(),
      type: 'TypePassword',
      value: this.value,
      description: this.getDescription(),
      status: this.status,
      error: this.error,
      context: this.context,
    }
  }
}

class PressEscKeyAction extends ActionOnElement {
  constructor (uiElement: UIElement) {
    super(uiElement)
  }

  protected executeActionOnElement () {
    this.element?.dispatchEvent(
      new KeyboardEvent("keydown", {
        altKey: false,
        code: "Escape",
        ctrlKey: false,
        isComposing: false,
        key: "Escape",
        location: 0,
        metaKey: false,
        repeat: false,
        shiftKey: false,
        which: 27,
        charCode: 0,
        keyCode: 27,
      })
    )
  }

  getDescription () {
    return `Press Esc key in ${this.getElementName()}`
  }

  getJSON () {
    return {
      id: this.id,
      element: this.getElementName(),
      type: 'PressEscKey',
      description: this.getDescription(),
      status: this.status,
      error: this.error,
      context: this.context,
    }
  }
}

class SaveValueAction extends ActionOnElement {
  memorySlotName: string

  constructor (uiElement: UIElement, memorySlotName: string) {
    super(uiElement)
    this.memorySlotName = memorySlotName
  }

  protected executeActionOnElement () {
    let inputElem = this.element as HTMLInputElement
    if (this.element?.tagName !== 'INPUT' && this.element?.tagName !== 'SELECT' && this.element?.tagName !== 'TEXTAREA') {
      inputElem = this.element?.querySelectorAll('input')[0] as HTMLInputElement
      if (!inputElem) {
        throw new Error('Input element not found. Not able to save value from element ' + this.getElementName())
      }
    } // allows to type in wrapper elements which contain input elem
    AutomationEvents.dispatch(EVENT_NAMES.SAVE_VALUE, {
      memorySlotName: this.memorySlotName,
      value: inputElem.value
    })
  }

  getDescription () {
    return `Save value of ${this.getElementName()} in ${this.memorySlotName}`
  }

  getJSON () {
    return {
      id: this.id,
      element: this.getElementName(),
      type: 'SaveValue',
      memorySlotName: this.memorySlotName,
      description: this.getDescription(),
      status: this.status,
      error: this.error,
      context: this.context,
    }
  }
}

export {
  AbstractAction,
  Action,
  ActionOnElement,
  ClickAction,
  SelectAction,
  TypeAction,
  TypePasswordAction,
  PressEscKeyAction,
  AssertTextIsAction,
  AssertContainsTextAction,
  AssertValueIsAction,
  AssertExistsAction,
  SaveValueAction,
}