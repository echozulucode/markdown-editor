@release-0.1.0
Feature: Document properties
  As an author
  I want to edit a document's properties in a structured panel
  So that I can manage metadata without hand-writing frontmatter

  A document's frontmatter is presented as a typed properties panel; every edit
  is written back to the Markdown source.

  Background:
    Given the author is editing a document that has properties
    And the properties follow the host's property schema

  @smoke
  Scenario: Properties are shown using their schema labels
    When the author views the properties panel
    Then each property is shown with its labelled name and value

  Scenario: Editing a property updates the document
    When the author changes the document's owner
    Then the document reflects the new owner

  Scenario: Adding a tag keeps the existing tags
    Given the document already has several tags
    When the author adds a new tag
    Then the new tag appears alongside the existing tags

  Scenario: A new property can be added from the schema
    When the author adds an available property
    Then the property appears in the panel ready for a value

  Scenario: Properties can be reordered
    When the author moves a property above another
    Then the panel shows the properties in the new order

  Scenario: A typed property offers an appropriate editor
    Given the schema marks a property as a yes or no value
    When the author edits that property
    Then it is presented as a yes or no control rather than free text
