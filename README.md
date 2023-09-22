## Tom - Framework for automating tasks in browsers

Tom is an innovative framework designed for streamlining the automation of tasks within a web browser environment.

The core concept behind Tom is its seamless integration as a Chrome extension, offering an efficient solution for test management and execution log handling.

## Installation

Clone project locally and link it to your project.

At `ch-ext-automation-framework` run
```bash
npm link 
```

In your project run
```bash
npm link ch-ext-automation-framework
```

## Usage

Task (or Actions): Are like functions. Is the place to define the steps of the automated task

login-action.ts

```typescript
import UIElements from './ui-elements'
import { Task, Click, Type, TypePassword } from 'ch-ext-automation-framework'

const actions = {
  logout: Task('Logout', () => {
    Click(UIElements.logoutButton)
  }),
  confirmLogout: Task('Confirm Logout', () => {
    Click(UIElements.confirmLogoutButton)
  }),
  login: Task('Login task', (params: any) => {
    Type(params.username).in(UIElements.usernameInput)
    TypePassword(params.password).in(UIElements.passwordInput)
    Click(UIElements.loginButton)
  }),
}

export default actions
```

UI Elements: Identify UI elements using custom selectors and save them to be referenced from the actions.

login-ui-elements.ts
```typescript
import { is, classIs, innerTextIs, titleIs, placeholderIs, isFirstElement, elementIndexIs } from 'ch-ext-automation-framework'

const UIElements = {
  logoutButton: is.BUTTON.where(titleIs('Logout'))
    .as('Logout Button'),
  confirmLogoutButton: is.BUTTON.where(innerTextIs('Log out'))
    .as('Confirm Logout Button'),
  loginButton: is.BUTTON.where(innerTextIs('LOGIN'))
    .as('Login Button'),
  usernameInput: is.INPUT
    .where((elem: HTMLElement) => (elem?.parentElement?.parentElement?.children[1] as HTMLElement)?.innerText === 'Username')
    .as('Username Input'),
  passwordInput: is.INPUT
    .where((elem: HTMLElement) => (elem?.parentElement?.parentElement?.children[1] as HTMLElement)?.innerText === 'Password')
    .as('Password Input'),
}

export default UIElements
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

