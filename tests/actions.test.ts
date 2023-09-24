import { AutomationEvents, Click, EVENT_NAMES, Task, Setup, AutomationInstance } from '../src/automation'
import { innerTextIs, is } from '../src/ui-element-builder'
import { expect, test } from 'vitest'
import { JSDOM } from 'jsdom'

const UIElements = {
  button: is.BUTTON.where(innerTextIs('Click me!')).as('Click Me button')
}

const actions = {
  clickButtonTest: Task('Click Button Test', () => {
    Click(UIElements.button)
  })
}

test('Test click button', async () => {
  const { window } = (new JSDOM(`
    <div>
      <button>Click me!</button>
    </div
  `));
  Setup(window)

  actions.clickButtonTest()

  const waitForActionUpadate: any = () => {
    return new Promise((resolve, reject) => {
      AutomationEvents.on(EVENT_NAMES.ACTION_UPDATE, (data: any) => {
        if (data.action.status === 'success') {
          resolve(data.action)
        } else if (data.action.status === 'error') {
          reject('Error running task')
        }
      })
    })
  }

  const actionData = await waitForActionUpadate()
  
  expect(actionData.status).toBe('success')
})

