@release-0.2.0
Feature: Inline table editing
  As an author
  I want to edit tables directly in the document
  So that I can change tables without writing Markdown pipes by hand

  In Hybrid mode a table is an editable grid: the author edits cells in place and
  performs structural changes from a toolbar or a right-click menu. Every change
  is written back to the Markdown source.

  Background:
    Given the author is editing a document with a table in Hybrid mode

  @smoke
  Scenario: Editing a cell updates the document
    When the author changes the text of a cell
    Then the document reflects the new cell text

  Scenario: Moving between cells with the keyboard
    Given the author is editing a cell
    When the author advances to the next cell
    Then the next cell becomes ready for editing

  @smoke
  Scenario: Inserting a row
    When the author inserts a row below the current row
    Then the table has an additional empty row
    And the document reflects the added row

  Scenario: Inserting a column
    When the author inserts a column beside the current column
    Then the table has an additional empty column
    And the document reflects the added column

  Scenario: Changing a column's alignment
    When the author centers the current column
    Then the column's contents are centered
    And the document records the column as centered

  Scenario: Deleting a row
    Given the table has more than one body row
    When the author deletes the current row
    Then that row is removed from the table and the document

  Scenario: A table always keeps at least one column
    Given the table has a single column
    When the author tries to delete that column
    Then the column remains so the block is still a table

  Scenario: Removing the table
    When the author deletes the table
    Then the table is removed from the document

  Scenario: Structural operations are available from a right-click menu
    When the author opens the context menu on a cell
    Then the menu offers row, column, alignment, and delete operations

  Scenario: Dismissing the context menu changes nothing
    Given the author has opened the context menu on a cell
    When the author dismisses the menu without choosing an operation
    Then the document is unchanged
