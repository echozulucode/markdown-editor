@release-0.1.0
Feature: Diagram rendering
  As a reader
  I want diagrams to render reliably and fail gracefully
  So that a single bad diagram never breaks the document

  Background:
    Given a document is shown in a rendered view

  @smoke
  Scenario: A valid diagram renders as a picture
    Given the document contains a valid diagram
    Then the diagram is shown as a rendered picture
    And its labels are readable

  Scenario: A host-provided diagram renders through the host's service
    Given the host provides its own renderer for a diagram type
    And the document contains a diagram of that type
    Then the diagram is rendered through the host's service

  @release-0.2.0
  Scenario: An invalid diagram fails softly
    Given the document contains a diagram with invalid syntax
    Then the document shows the diagram source as a fallback
    And the reader is told the diagram could not be rendered
    But no diagram error graphic leaks onto the page
    And the rest of the document still renders

  @performance
  Scenario: A diagram that takes too long is abandoned
    Given a diagram takes longer than the diagram render timeout
    Then rendering is abandoned and the source fallback is shown
    But authoring is not blocked

  Scenario: A small diagram is not stretched to fill the view
    Given the document contains a diagram smaller than the available width
    Then the diagram keeps its natural size rather than being enlarged
