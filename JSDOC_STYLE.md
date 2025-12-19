# jsdoc style guide

extracted from amp threads and AGENTS.md configuration.

## core philosophy

documentation lives with code, not in random folders. jsdocs are the source of truth; external docs are pulled from code at build time (ariakit pattern).

### what to document

- only keep notes that explain a non-obvious "why"
- colocate valuable context as jsdocs with the code
- if it simply describes what the code does, delete it
- cut back on examples, use text, be concise

## tone & voice

### formatting rules

- **lowercase prose ONLY** — no sentence case, no title case
- use ALL CAPS for emphasis only
- Initial Letter Capitalization reserved for sarcasm/disrespect
- be terse while conveying substantially all relevant information

### content rules

- make no unsupported claims — if you can't defend it, delete or label as hunch
- avoid absolutist language — prefer "a problem" to "the problem"
- be precise and specific; describe, don't emote or generalize
- avoid hyperbole; adjectives should clarify, not persuade

## jsdoc structure

### basic format

```typescript
/**
 * one-line description of what this does.
 *
 * additional context if needed (keep brief).
 *
 * @prop propName - description
 * @prop anotherProp - description
 *
 * @example basic usage
 * ```tsx
 * <Component>content</Component>
 * ```
 */
```

### real examples

#### context provider

```typescript
/**
 * context provider for collapsible disclosure state.
 * wraps children in an ariakit DisclosureProvider.
 *
 * @prop defaultOpen - initial open state (uncontrolled)
 * @prop open - controlled open state
 * @prop setOpen - callback when open state changes
 *
 * @example
 * ```tsx
 * <Collapsible defaultOpen={false}>
 *   <CollapsibleTrigger>toggle</CollapsibleTrigger>
 *   <CollapsibleContent>hidden content</CollapsibleContent>
 * </Collapsible>
 * ```
 */
```

#### component with warnings

```typescript
/**
 * composite container providing single tab-stop with arrow-key navigation.
 *
 * use cases: inline lists, dropdown menus, context menus, toolbars, navigation, tables.
 *
 * ### context shadowing warning
 * if no store is provided, List will join an existing CompositeContext if one exists.
 * this can cause items to participate in the parent's focus loop unintentionally.
 * for an ISOLATED loop, wrap in ListProvider or ListContextBlocker.
 *
 * @prop store - optional CompositeStore for controlled state
 * @prop className - merged with menuClassname default
 *
 * @example basic list
 * ```tsx
 * <List>
 *   <ListItem>option 1</ListItem>
 *   <ListItem>option 2</ListItem>
 * </List>
 * ```
 */
```

#### internal rationale (the "why")

```typescript
/**
 * blocks the CompositeContext so nested Lists create their own isolated focus loops.
 *
 * used internally by FloatingContent to ensure popover menus don't join
 * the parent's arrow-key navigation.
 *
 * this is essential for our "Simple API" goal.
 * our `List` component is "greedy"—if it sees a parent `CompositeContext`, it joins it.
 * by blocking the context here, we force the nested `List` to see `null`, triggering it
 * to create its own fresh `CompositeStore` (and thus its own isolated focus loop).
 */
```

#### utility function

```typescript
/**
 * creates a zero-size DOMRect at the mouse cursor position.
 * used for positioning context menus at the click location.
 *
 * @example context menu positioning
 * ```tsx
 * const onContextMenu = (e: React.MouseEvent) => {
 *   e.preventDefault();
 *   setAnchorRect(getMouseAnchorRect(e.nativeEvent));
 * };
 * ```
 */
```

## compound components

use `@link` for cross-references in compound component exports:

```typescript
export const Connector = Object.assign(ConnectorProvider, {
  /** diamond-shaped node icon. see {@link ConnectorNode}. */
  Node: ConnectorNode,
  /** tree connector line. see {@link ConnectorLine}. */
  Line: ConnectorLine,
  /** headless render-prop for custom visuals. see {@link ConnectorGeneric}. */
  Generic: ConnectorGeneric,
});
```

## @prop vs @param

- use `@prop` for react component props (matches how we think about them)
- use `@param` for function parameters
- keep descriptions on same line, after the dash

```typescript
// react component
/**
 * @prop store - optional CompositeStore for controlled state
 * @prop className - merged with cn() utility
 * @prop disabled - removes from focus loop
 */

// function
/**
 * @param x - horizontal position
 * @param y - vertical position
 * @returns DOMRect at specified position
 */
```

## examples section

- title examples with `@example description`
- use fenced tsx code blocks
- prefer minimal examples that show one thing
- for complex components, show progression: basic → with options → advanced

```typescript
/**
 * @example basic items
 * ```tsx
 * <List>
 *   <ListItem>clickable item</ListItem>
 *   <ListItem disabled>disabled item</ListItem>
 * </List>
 * ```
 *
 * @example as link
 * ```tsx
 * <List>
 *   <ListItem render={<a href="/dashboard" />}>go to dashboard</ListItem>
 * </List>
 * ```
 */
```

## what NOT to include

- obvious behavior ("renders a button" for a Button component)
- implementation details that aren't needed for usage
- excessive examples (reference existing patterns instead)
- personal preferences disguised as conventions

## css variable documentation

when components use css variables, document them:

```typescript
/**
 * svg element rendering a └ shaped tree connector line.
 * uses CSS var `--connector-stroke-color` (falls back to `currentColor`).
 */
```

## preserving internal notes

keep `@bdsqqq notes` or similar inline comments when they explain non-obvious decisions:

```typescript
/**
 * connector line component.
 *
 * @bdsqqq notes: alpha colors avoided for strokes due to compounding
 * overlap issues at intersection points.
 */
```
