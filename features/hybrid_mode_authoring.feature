@release-0.1.0
Feature: Hybrid mode authoring
  As an author
  I want a document-like view that still lets me edit the raw source
  So that I can write naturally while keeping Markdown control

  In Hybrid mode inactive blocks appear rendered, while the block the author is
  working in reveals its Markdown source for direct editing.

  Background:
    Given the author is editing a document in Hybrid mode

  @smoke
  Scenario: Inactive blocks appear rendered
    Given the document contains a heading, a task list, and a diagram
    When the author is not editing those blocks
    Then each block is shown in its rendered form

  Scenario: The active block reveals its source
    When the author moves into a rendered block
    Then that block shows its Markdown source for editing

  Scenario: Leaving a block restores its rendered form
    Given the author has been editing a block as source
    When the author moves to another part of the document
    Then the edited block returns to its rendered form

  Scenario: Wiki links are shown as readable references
    Given the document links to another page with a wiki link
    When the author is not editing that line
    Then the link is shown as a readable page reference
