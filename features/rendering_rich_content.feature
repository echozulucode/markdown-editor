@release-0.1.0
Feature: Rendering rich content
  As a reader
  I want code, tables, callouts, and formatting to render clearly
  So that I can read a document the way the author intended

  Background:
    Given a document is shown in a rendered view

  @smoke
  Scenario: Code blocks are syntax highlighted
    Given the document contains a code block in a supported language
    Then the code is shown with syntax highlighting

  Scenario: An unknown code language falls back to plain code
    Given the document contains a code block in an unrecognized language
    Then the code is shown as plain text
    And the reader is told the language was not recognized

  Scenario: Tables are rendered with visible gridlines
    Given the document contains a table
    Then the table is shown with visible row and column borders

  Scenario: Callouts are visually distinguished
    Given the document contains a callout
    Then the callout is shown as a highlighted note

  Scenario: Inline images are displayed
    Given the document contains an inline image
    Then the image is displayed in place

  @release-0.2.0
  Scenario: Inline emphasis is rendered, not shown as markup
    Given a paragraph contains bold and italic words
    Then those words are shown emphasized rather than wrapped in markup characters
