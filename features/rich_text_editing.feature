@release-0.1.0
Feature: Rich text editing
  As an author
  I want a visual editor with familiar formatting controls
  So that I can write without knowing Markdown

  Rich Text editing reads from and writes to the same Markdown source, so visual
  edits stay portable.

  Background:
    Given the author is editing a document in Rich Text mode

  @smoke
  Scenario: Applying a formatting control formats the selection
    Given the author has selected a word
    When the author applies bold formatting
    Then the word is shown in bold
    And the exported Markdown marks the word as bold

  Scenario: Markdown shortcuts are recognized while typing
    When the author types a heading shortcut at the start of a line
    Then the line becomes a heading
    But the shortcut characters are not left as literal text

  Scenario: The host can supply its own toolbar icons
    Given the host provides a set of toolbar icons
    When the author views the formatting toolbar
    Then the toolbar shows the host's icons

  @release-0.2.0
  Scenario: Tables show gridlines while editing
    Given the document contains a table
    Then the table is shown with visible row and column borders
