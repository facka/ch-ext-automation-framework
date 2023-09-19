import { AutomationEvents, EVENT_NAMES } from "./automation";
import { UIElement, checkElement, hideCheckElementContainer, wait } from "./ui-utils"
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
      await AbstractAction.notifyActionUpdated(this)
      console.log('Action: ', this.getDescription())
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
      await AbstractAction.notifyActionUpdated(this)
    }
  }

  static async notifyActionUpdated (action: AbstractAction) {
    AutomationEvents.dispatch(EVENT_NAMES.ACTION_UPDATE, {
      action: action.getJSON(),
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
        await wait(200)
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
  tries: number

  constructor (uiElement: UIElement) {
    super()
    this.uiElement = uiElement
    this.element = null
    this.tries = 0
  }

  getElementName () {
    return this.uiElement.getElementName()
  }

  updateTries (tries: number) {
    this.tries = tries
  }

  getJSON () {
    return {
      id: this.id,
      element: this.getElementName(),
      description: this.getDescription(),
      status: this.status,
      error: this.error,
      context: this.context,
      tries: this.tries
    }
  }

  protected abstract executeActionOnElement() : void

  /**
   * 
   * @param uiElement
   * @param delay of each try. Defaults to 1 second
   */
  static waitForElement (currentAction: ActionOnElement, uiElement: UIElement, delay: number = 1000, maxTries = 10): Promise<HTMLElement> {
    const elementName = uiElement.getElementName()
    return new Promise(async (resolve, reject) => {
      
      // retry function 
      const retry = async (parentElement: HTMLElement | null, delay = 1000, index = 0) => {
        console.groupCollapsed(`tries ${index}/${maxTries}`)
        currentAction.updateTries(index)
        await AbstractAction.notifyActionUpdated(currentAction)
        if (index === maxTries) {
          console.groupEnd()
          reject(new Error(`UI Element ${elementName || 'UNKNNOWN'} not found after 10 tries`))
        } else {
          const elem = uiElement.selector(parentElement, uiElement.postProcess)
          if (elem) {
            console.groupEnd()
            console.log('Element found = ', elem)
            resolve(elem)
          } else {
            console.groupEnd()
            await wait(delay)
            await retry(parentElement, delay, ++index)
          }
        }
      }

      console.group('Looking for Element: ' + elementName);

      let parentElement: HTMLElement | null = null
      if (uiElement.parent) {
        console.groupCollapsed('Look for Parent ', uiElement.parent.getElementName())
        try {
          parentElement = await ActionOnElement.waitForElement(currentAction, uiElement.parent)
          console.groupEnd()
          console.log('using parent element: ', parentElement)
        } catch (e) {
          console.groupEnd()
          reject(new Error(`Parent ${uiElement.parent.getElementName()} of UI Element ${uiElement.name || 'UNKNNOWN'} not found`))
        }
      }

      await retry(parentElement, delay)
      console.groupEnd()
    })
  }

  async executeAction () {
    try {
      this.element = await ActionOnElement.waitForElement(this, this.uiElement) as HTMLElement
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
      ...super.getJSON(),
      type: 'Click',
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
      ...super.getJSON(),
      type: 'AssertTextIsAction',
      value: this.text,
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
      ...super.getJSON(),
      type: 'AssertContainsText',
      value: this.text,
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
      ...super.getJSON(),
      type: 'AssertValueIsAction',
      value: this.value,
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
      ...super.getJSON(),
      type: 'AssertExistsAction',
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
      ...super.getJSON(),
      type: 'Select',
      value: this.value,
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
      ...super.getJSON(),
      type: 'Type',
      value: this.value,
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
      ...super.getJSON(),
      type: 'TypePassword',
      value: this.value,
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
      ...super.getJSON(),
      type: 'PressEscKey',
    }
  }
}

class PressDownKeyAction extends ActionOnElement {
  constructor (uiElement: UIElement) {
    super(uiElement)
  }

  protected executeActionOnElement () {
    this.element?.dispatchEvent(
      new KeyboardEvent("keydown", {
        altKey: false,
        code: "Down",
        ctrlKey: false,
        isComposing: false,
        key: "Down",
        location: 0,
        metaKey: false,
        repeat: false,
        shiftKey: false,
        which: 40,
        charCode: 0,
        keyCode: 40,
      })
    )
  }

  getDescription () {
    return `Press Down key in ${this.getElementName()}`
  }

  getJSON () {
    return {
      ...super.getJSON(),
      type: 'PressDownKey',
    }
  }
}

class PressTabKeyAction extends ActionOnElement {
  constructor (uiElement: UIElement) {
    super(uiElement)
  }

  protected executeActionOnElement () {
    this.element?.dispatchEvent(
      new KeyboardEvent("keydown", {
        altKey: false,
        code: "Tab",
        ctrlKey: false,
        isComposing: false,
        key: "Tab",
        location: 0,
        metaKey: false,
        repeat: false,
        shiftKey: false,
        which: 9,
        charCode: 0,
        keyCode: 9,
      })
    )
  }

  getDescription () {
    return `Press Tab key in ${this.getElementName()}`
  }

  getJSON () {
    return {
      ...super.getJSON(),
      type: 'PressTabKey',
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
      ...super.getJSON(),
      type: 'SaveValue',
      memorySlotName: this.memorySlotName,
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
  PressDownKeyAction,
  PressTabKeyAction,
  AssertTextIsAction,
  AssertContainsTextAction,
  AssertValueIsAction,
  AssertExistsAction,
  SaveValueAction,
}