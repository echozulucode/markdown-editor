@release-0.1.0
Feature: Host integration services
  As an author
  I want to link pages and attach images through the host application
  So that documents connect to the host's content and assets

  The editor delegates page lookup and asset storage to host-provided services
  rather than assuming any storage or network of its own.

  Background:
    Given the author is editing a document
    And the host provides page search and image upload services

  @smoke
  Scenario: Inserting a link to another page from suggestions
    When the author inserts a page link using the host's suggestions
    Then a link to the chosen page is added to the document

  Scenario: Page suggestions are filtered by the search text
    When the author searches for pages by a term
    Then only pages matching that term are suggested

  @smoke
  Scenario: Attaching an uploaded image
    When the author uploads an image through the host
    Then the host stores the image
    And an image reference to it is added to the document

  Scenario: Outdated search results are discarded
    Given the author has started a page search
    When the author changes the search before results arrive
    Then the outdated results are not shown
