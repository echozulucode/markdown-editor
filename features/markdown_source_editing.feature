@release-0.1.0
Feature: Markdown source editing
  As an author
  I want to edit the raw Markdown of a document
  So that I keep full control over the canonical source

  The editor treats Markdown as the single source of truth, so editing the
  source never silently rewrites or reformats content the author did not touch.

  Background:
    Given the author is editing a document in Markdown mode

  @smoke
  Scenario: Typed changes appear in the document
    When the author writes a heading and a paragraph
    Then the document reflects the new heading and paragraph

  @smoke
  Scenario: Untouched content is preserved exactly
    Given the document contains a mix of headings, lists, tables, and code
    When the author makes no changes
    Then saving the document returns the original source unchanged

  Scenario: Reverting an edit restores the previous text
    Given the author has changed a paragraph
    When the author undoes the change
    Then the paragraph returns to its previous wording

  Scenario: A read-only document cannot be edited
    Given the document is opened read-only
    When the author attempts to type into the document
    Then the source remains unchanged
    But the author can still select and read the content
