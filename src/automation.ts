import { groupEnd } from 'console'
import { 
  AbstractAction,
  Action,
  ActionOnElement,
  ClickAction,
  AssertTextIsAction,
  AssertContainsTextAction,
  AssertValueIsAction,
  AssertExistsAction,
  AssertNotExistsAction,
  SelectAction,
  TypeAction,
  TypePasswordAction,
  PressEscKeyAction,
  PressDownKeyAction,
  PressTabKeyAction,
  SaveValueAction,
  WaitAction,
  WaitUntilElementRemovedAction,
} from './actions'
import { UIElement, hideCheckElementContainer } from "./ui-utils"
import { stat } from 'fs'

const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const setDateFromToday = (numberOfDays: number) => {
  const date = new Date()
  return formatDate(new Date(date.setDate(date.getDate() + numberOfDays)))
}

const setMonthFromToday = (numberOfMonths: number) => {
  const date = new Date()
  return formatDate(new Date(date.setMonth(date.getMonth() + numberOfMonths)))
}

const tomorrow = setDateFromToday(1)
const yesterday = setDateFromToday(-1)
const nextWeek = setDateFromToday(7)
const lastWeek = setDateFromToday(-7)
const nextMonth = setMonthFromToday(1)
const lastMonth = setMonthFromToday(-1)

const DateUtils = {
  today: formatDate(new Date()),
  tomorrow,
  nextWeek,
  nextMonth,
  yesterday,
  lastWeek,
  lastMonth
}

class AutomationCompiler {
  static currentAction: Action
  static isCompiling: boolean

  static compileAction (action: Action) {
    const previousAction = AutomationCompiler.currentAction
    AutomationCompiler.currentAction = action
    action.compileSteps()
    AutomationCompiler.currentAction = previousAction
  }

  static addAction (action: AbstractAction) {
    console.log('Add action: ', action.getDescription())
    AutomationCompiler.currentAction.addStep(action)
  }

  static init (startAction: Action) {
    AutomationCompiler.currentAction = startAction
    AutomationCompiler.isCompiling = true
    console.groupCollapsed('Compile: ' + startAction.getDescription())
    startAction.compileSteps()
    AutomationCompiler.isCompiling = false
    console.log('Compilation finished')
    console.groupEnd()
  }
}

enum EVENT_NAMES {
  START = 'start',
  END = 'end',
  ACTION_UPDATE = 'action-update',
  SAVE_VALUE = 'save-value',
  REGISTER_TEST = 'register-test',
  TEST_STARTED = 'test-started',
  TEST_PASSED = 'test-passed',
  TEST_FAILED = 'test-failed',
  TEST_END = 'test-end'
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

  dispatch(eventName: EVENT_NAMES, data?: any) {
    if (this.events.has(eventName) ) {
      this.events.get(eventName)?.forEach((callback: AutomationEventHandlerType) => {
        console.groupCollapsed('Dispatch Event: ' + eventName)
        console.log('Data: ', data)
        console.groupEnd()
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
    console.groupCollapsed('Start Action: ', startAction.getDescription())
    AutomationEvents.dispatch(EVENT_NAMES.START, {
      action: startAction?.getJSON(),
    })
    try {
      await startAction?.execute()
    } catch (e: any) {
      hideCheckElementContainer()
      console.error(`🤖 Error running task ${startAction.getDescription()}. Reason: ${e.message}`)
      throw e
    } finally {
      console.groupEnd()
      AutomationRunner.running = false
      AutomationEvents.dispatch(EVENT_NAMES.END, {})
    }
  }  
}

const TestsMap: any = {}

const Test = (id: string, steps: () => void) => {
  const action = new Action(id, steps)
  AutomationCompiler.init(action)
  const testCode = async () => {
    if (!AutomationRunner.running) {
      try {
        AutomationEvents.dispatch(EVENT_NAMES.TEST_STARTED, { action: action.getJSON() })
        await AutomationRunner.start(action)
        AutomationEvents.dispatch(EVENT_NAMES.TEST_PASSED, { id })
      } catch (e) {
        AutomationEvents.dispatch(EVENT_NAMES.TEST_FAILED, { id })
      } finally {
        AutomationEvents.dispatch(EVENT_NAMES.TEST_END, { id })
      }
    } else {
      throw new Error('Not able to run test while other test is running.')
    }
  }
  AutomationEvents.dispatch(EVENT_NAMES.REGISTER_TEST, { id, action: action.getJSON() })
  TestsMap[id] = testCode
}

const RunTest = (id: string) => {
  if (!TestsMap[id]) {
    throw new Error(`Test with id ${id} not found.`)
  } else {
    TestsMap[id]()
  }
}

const Task = (id: string, steps: (params?: any) => void) => {
  return async (params?: any) => {
    const action = new Action(id, steps)
    action.setParams(params)
    if (!AutomationRunner.running && !AutomationCompiler.isCompiling) {
      try {
        AutomationCompiler.init(action)
        await AutomationRunner.start(action)
      } catch (e) {
        console.log('Error running task ' + id)
      }
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
      AutomationCompiler.addAction(new AssertTextIsAction(uiElement, text))
    },
    containsText: (text: string) => {
      AutomationCompiler.addAction(new AssertContainsTextAction(uiElement, text))
    },
    valueIs: (value: string) => {
      AutomationCompiler.addAction(new AssertValueIsAction(uiElement, value))
    },
    exists: () => {
      AutomationCompiler.addAction(new AssertExistsAction(uiElement))
    },
    notExists: () => {
      AutomationCompiler.addAction(new AssertNotExistsAction(uiElement))
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

const PressEscKey = () => {
  return {
    in: (uiElement: UIElement) => {
      AutomationCompiler.addAction(new PressEscKeyAction(uiElement))
    }
  }
}

const PressDownKey = () => {
  return {
    in: (uiElement: UIElement) => {
      AutomationCompiler.addAction(new PressDownKeyAction(uiElement))
    }
  }
}

const PressTabKey = () => {
  return {
    in: (uiElement: UIElement) => {
      AutomationCompiler.addAction(new PressTabKeyAction(uiElement))
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

const Wait = (miliseconds: number) => {
  AutomationCompiler.addAction(new WaitAction(miliseconds))
}

Wait.untilElement = (uiElement: UIElement) => {
  return {
    isRemoved: () => {
      AutomationCompiler.addAction(new WaitUntilElementRemovedAction(uiElement))
    }
  }
}

// TODO add wait action     

export {
  Test,
  RunTest,
  Task,
  Click,
  Assert,
  Select,
  Type,
  TypePassword,
  ClearValue,
  PressEscKey,
  PressDownKey,
  PressTabKey,
  SaveValue,
  Wait,
  DateUtils,
  AutomationEvents,
  EVENT_NAMES,
}
