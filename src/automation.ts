import { 
  AbstractAction,
  Action,
  ActionOnElement,
  ClickAction,
  AssertTextIsAction,
  AssertContainsTextAction,
  AssertValueIsAction,
  AssertExistsAction,
  SelectAction,
  TypeAction,
  TypePasswordAction,
  SaveValueAction,
} from './actions'
import { UIElement, hideCheckElementContainer } from "./ui-utils"

const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const today = new Date()
const today1 = new Date()
const today2 = new Date()
const today3 = new Date()
const tomorrow = formatDate(new Date(today1.setDate(today1.getDate() + 1)))
const nextWeek = formatDate(new Date(today2.setDate(today2.getDate() + 7)))
const nextMonth = formatDate(new Date(today3.setMonth(today3.getMonth() + 1)))

const DateUtils = {
  today: formatDate(today),
  tomorrow,
  nextWeek,
  nextMonth,
}

class AutomationCompiler {
  static currentAction: Action

  static compileAction (action: Action) {
    const previousAction = AutomationCompiler.currentAction
    AutomationCompiler.currentAction = action
    action.compileSteps()
    AutomationCompiler.currentAction = previousAction
  }

  static addAction (action: AbstractAction) {
    AutomationCompiler.currentAction.addStep(action)
  }

  static init (startAction: Action) {
    AutomationCompiler.currentAction = startAction
    startAction.compileSteps()
  }
}

enum EVENT_NAMES {
  START = 'start',
  END = 'end',
  ACTION_UPDATE = 'action-update',
  SAVE_VALUE = 'save-value'
}

type AutomationEventHandlerType = ((action?: any) => void)

class EventDispatcher {
  events: Map<EVENT_NAMES, Array<AutomationEventHandlerType>>

  constructor() {
    this.events = new Map()
  }

  on(eventName: EVENT_NAMES, callback: AutomationEventHandlerType) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, [])
    }
    this.events.get(eventName)?.push(callback)
  }

  off(eventName: EVENT_NAMES, callback: AutomationEventHandlerType) {
    if (this.events.has(eventName) ) {
      this.events.set(eventName, this.events.get(eventName)?.filter((cb: AutomationEventHandlerType) => cb !== callback) || [])
    }
  }

  dispatch(eventName: EVENT_NAMES, data: any) {
    if (this.events.has(eventName) ) {
      this.events.get(eventName)?.forEach((callback: AutomationEventHandlerType) => {
        callback(data)
      })
    }
  }
}

const AutomationEvents = new EventDispatcher()


class AutomationRunner {
  static running = false

  static async start (startAction: Action) {
    AutomationRunner.running = true
    AutomationCompiler.init(startAction)
    AutomationEvents.dispatch(EVENT_NAMES.START, {
      action: startAction?.getJSON(),
    })

    try {
      await startAction?.execute()
    } catch (e: any) {
      await hideCheckElementContainer()
      console.error(`🤖 Error running task ${startAction.getDescription()}. Reason: ${e.message}`)
    }
    AutomationRunner.running = false
    AutomationEvents.dispatch(EVENT_NAMES.END, {})
  }  
}

const Task = (id: string, steps: (params?: any) => void) => {
  return (params?: any) => {
    const action = new Action(id, steps)
    action.setParams(params)
    if (!AutomationRunner.running) {
      AutomationRunner.start(action)
    } else {
      AutomationCompiler.addAction(action)
      AutomationCompiler.compileAction(action)
    }
  }
}

const Click = (uiElement: UIElement) => {
  const action = new ClickAction(uiElement)
  AutomationCompiler.addAction(action)
}

const Assert = (uiElement: UIElement) => {
  return {
    textIs: (text: string) => {
      const action = new AssertTextIsAction(uiElement, text)
      AutomationCompiler.addAction(action)
    },
    containsText: (text: string) => {
      const action = new AssertContainsTextAction(uiElement, text)
      AutomationCompiler.addAction(action)
    },
    valueIs: (value: string) => {
      const action = new AssertValueIsAction(uiElement, value)
      AutomationCompiler.addAction(action)
    },
    exists: () => {
      const action = new AssertExistsAction(uiElement)
      AutomationCompiler.addAction(action)
    }
  }
}

const Select = (value: string) => {
  return {
    in: (uiElement: UIElement) => {
      const action = new SelectAction(uiElement, value)
      AutomationCompiler.addAction(action)
    }
  }
}

const Type = (value: string) => {
  return {
    in: (uiElement: UIElement) => {
      const action = new TypeAction(uiElement, value)
      AutomationCompiler.addAction(action)
    }
  }
}

const ClearValue = () => {
  return {
    in: (uiElement: UIElement) => {
      const action = new TypeAction(uiElement, '')
      AutomationCompiler.addAction(action)
    }
  }
}

const TypePassword = (value: string) => {
  return {
    in: (uiElement: UIElement) => {
      const action = new TypePasswordAction(uiElement, value)
      AutomationCompiler.addAction(action)
    }
  }
}

const SaveValue = (uiElement: UIElement) => {
  return {
    in: (memorySlotName: string) => {
      const action = new SaveValueAction(uiElement, memorySlotName)
      AutomationCompiler.addAction(action)
    }
  }
}


// TODO add wait action     

export {
  Task,
  Click,
  Assert,
  Select,
  Type,
  TypePassword,
  ClearValue,
  SaveValue,
  DateUtils,
  AutomationEvents,
  EVENT_NAMES,
}
