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
import { UIUtils } from "./ui-utils"
import { UIElement, setDocument } from './ui-element-builder'
import DateUtils from './date-utils'
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
        console.log(`Dispatch Event ${eventName}:`, data)
        callback(data)
      })
    }
  }
}

const AutomationEvents = new EventDispatcher()

enum TestSpeed {
  SLOW = 2000,
  NORMAL = 1000,
  FAST = 200
}

enum TestPlayStatus {
  PLAYING = 'Playing',
  STOPPED = 'Stopped',
  PAUSED = 'Paused'
}

enum RunMode {
  NORMAL = 'Normal',
  STEPBYSTEP = 'Step By Step',
}


class AutomationRunner {
  static running = false

  static async start (startAction: Action) {
    AutomationRunner.running = true
    AutomationInstance.status = TestPlayStatus.PLAYING
    console.groupCollapsed('Start Action: ', startAction.getDescription())
    AutomationEvents.dispatch(EVENT_NAMES.START, {
      action: startAction?.getJSON(),
    })
    try {
      await startAction?.execute()
    } catch (e: any) {
      AutomationInstance.uiUtils.hideCheckElementContainer()
      console.error(`🤖 Error running task ${startAction.getDescription()}. Reason: ${e.message}`)
      throw e
    } finally {
      console.groupEnd()
      AutomationRunner.running = false
      AutomationEvents.dispatch(EVENT_NAMES.END, {
        action: startAction?.getJSON()
      })
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
      } catch (e: any) {
        console.log('Error running task ' + id + '. ' + e.message)
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

class Automation {
  private _document: Document
  debug: Boolean
  private _uiUtils: UIUtils
  speed: TestSpeed
  status: TestPlayStatus
  runMode: RunMode
  currentAction: (() => {}) | undefined

  constructor(window: Window) {
    this._document = window.document
    this.debug = true
    this._uiUtils = new UIUtils(window)
    this.speed = TestSpeed.NORMAL
    this.status = TestPlayStatus.STOPPED
    this.runMode = RunMode.NORMAL
  }

  public get document() {
    return this._document
  }

  public get uiUtils() {
    return this._uiUtils
  }

  public get isStepByStepMode() {
    return this.runMode == RunMode.STEPBYSTEP
  }

  public get isStopped() {
    return this.status == TestPlayStatus.STOPPED
  }

  public get isPlaying() {
    return this.status == TestPlayStatus.PLAYING
  }


  public get isPaused() {
    return this.status == TestPlayStatus.PAUSED
  }

  public pause() {
    console.log('Pause Test')
    this.status = TestPlayStatus.PAUSED
  }

  public continue() {
    console.log('Continue Test')
    this.status = TestPlayStatus.PLAYING
    if (this.currentAction) {
      this.currentAction()
      this.currentAction = undefined
    }
  }

  public next() {
    console.log('Continue Test to Next Step...')
    this.status = TestPlayStatus.PLAYING
    this.runMode = RunMode.STEPBYSTEP
    if (this.currentAction) {
      this.currentAction()
      this.currentAction = undefined
    }
  }

  public stop() {
    console.log('Stop Test')
    this.status = TestPlayStatus.STOPPED
    if (this.currentAction) {
      this.currentAction()
      this.currentAction = undefined
    }
  }

  public saveCurrentAction(callback: () => {}) {
    this.currentAction = callback
  }

  setDebug(value: Boolean) {
    this.debug = value
  }

  log(value: string) {
    if (this.debug) {
      console.log(value)
    }
  }
}

let AutomationInstance: Automation

const Setup = (window: Window, tests?: Array<any>) => {
  if (AutomationInstance) {
    throw new Error('Automation Setup already executed.')
  }
  AutomationInstance = new Automation(window)
  setDocument(AutomationInstance.document)

  tests?.forEach((installerFn) => installerFn())
  return AutomationInstance
}

export {
  Setup,
  AutomationInstance,
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
  TestSpeed,
}
