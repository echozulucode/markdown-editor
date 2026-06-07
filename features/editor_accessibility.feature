@release-0.1.0 @a11y
Feature: Editor accessibility
  As an author who relies on the keyboard or assistive technology
  I want the editor to be operable without a mouse and to respect my preferences
  So that I can author documents regardless of how I interact

  @smoke @keyboard
  Scenario: The editor is operable with the keyboard alone
    Given the author is editing a document with every mode available
    When the author moves through the controls using the keyboard
    Then the author can reach the editor, switch modes, and format text without a mouse

  @keyboard
  Scenario: Stateful controls announce whether they are active
    Given the author is editing in Rich Text mode
    And a formatting control is currently applied
    Then that control reports itself as active to assistive technology

  Scenario: Controls have meaningful names
    Given the author is editing a document
    Then every control exposes a descriptive name to assistive technology

  @spec-WCAG-2.3.3
  Scenario: A reduced-motion preference is respected
    Given the author prefers reduced motion
    When the author works with the editor
    Then transitions are reduced or removed
