@release-0.1.0
Feature: Switching editor modes
  As an author
  I want to switch between editing modes
  So that I can read, write, and visually edit the same document

  Every mode reads from and writes to the same Markdown source, so switching
  modes never loses or rewrites the author's content.

  Background:
    Given the host offers the author every editing mode for a document

  @smoke
  Scenario: Content survives a round trip through every mode
    Given the author is editing in Hybrid mode
    When the author switches through each available mode and back
    Then the document content is unchanged

  Scenario: The host can offer a limited set of modes
    Given the host offers only Markdown and Preview
    When the author opens the mode controls
    Then only Markdown and Preview are available
    But the other modes are not offered

  Scenario: A read-only preview hides editing controls
    Given the document is offered as a read-only preview
    When the author views the document
    Then the rendered output is displayed
    But no editing controls are shown

  Scenario: Switching an unedited document leaves the source identical
    Given the author has made no edits
    When the author switches between modes
    Then saving the document returns the original source unchanged
